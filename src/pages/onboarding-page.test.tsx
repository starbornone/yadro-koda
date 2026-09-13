import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'
import { OnboardingPage } from './onboarding-page'

const createOrganisation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  createOrganisation,
}))

beforeEach(() => {
  createOrganisation.mockReset()
})

describe('OnboardingPage', () => {
  it('derives the URL name from the organisation name until edited', async () => {
    const user = userEvent.setup()
    await renderWithRouter(<OnboardingPage />)

    await user.type(screen.getByLabelText('Organisation name'), 'Acme & Co.')
    expect(screen.getByLabelText('URL name')).toHaveValue('acme-co')

    await user.clear(screen.getByLabelText('URL name'))
    await user.type(screen.getByLabelText('URL name'), 'Acme Custom')
    expect(screen.getByLabelText('URL name')).toHaveValue('acme-custom')

    await user.type(screen.getByLabelText('Organisation name'), ' Ltd')
    expect(screen.getByLabelText('URL name')).toHaveValue('acme-custom')
  })

  it('creates the organisation, refreshes and goes to the app', async () => {
    createOrganisation.mockResolvedValue({ id: 'org-1', name: 'Acme', slug: 'acme' })
    const user = userEvent.setup()
    const { router } = await renderWithRouter(<OnboardingPage />)
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.type(screen.getByLabelText('Organisation name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create organisation' }))

    expect(createOrganisation).toHaveBeenCalledWith({ name: 'Acme', slug: 'acme' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
    expect(invalidate).toHaveBeenCalled()
  })

  it('explains a taken URL name', async () => {
    createOrganisation.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "organisations_slug_key"'),
    )
    const user = userEvent.setup()
    await renderWithRouter(<OnboardingPage />)

    await user.type(screen.getByLabelText('Organisation name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create organisation' }))

    expect(
      await screen.findByText('That URL name is already taken. Choose another.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create organisation' })).toBeEnabled()
  })
})
