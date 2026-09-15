import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderStaff } from '@/test/render-authenticated'
import { StaffNewOrganisationPage } from './staff-new-organisation-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const createLead = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/crm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/crm')>()),
  createLead,
}))

beforeEach(() => {
  createLead.mockReset()
})

const renderPage = () =>
  renderStaff(<StaffNewOrganisationPage />, {
    path: '/staff/organisations/new',
    platformRole: 'admin',
  })

describe('StaffNewOrganisationPage', () => {
  it('derives the URL name and opens the new record on success', async () => {
    createLead.mockResolvedValue({ id: 'org-9', name: 'Initech', slug: 'initech', created_at: '' })
    const user = userEvent.setup()
    const { router } = renderPage()

    await user.type(await screen.findByLabelText('Organisation name'), 'Initech Pty Ltd')
    expect(screen.getByLabelText('URL name')).toHaveValue('initech-pty-ltd')
    await user.type(screen.getByLabelText('Source'), 'Referral')
    await user.click(screen.getByRole('button', { name: 'Create lead' }))

    expect(createLead).toHaveBeenCalledWith({
      name: 'Initech Pty Ltd',
      slug: 'initech-pty-ltd',
      source: 'Referral',
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/organisations/org-9'))
  })

  it('explains a taken URL name', async () => {
    createLead.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "organisations_slug_key"'),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Organisation name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create lead' }))

    expect(await screen.findByText(/already taken/)).toBeInTheDocument()
  })
})
