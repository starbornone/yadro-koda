import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAuthenticated, testOrg } from '@/test/render-authenticated'
import { OrgSettingsPage } from './org-settings-page'

const updateOrganisation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  updateOrganisation,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

beforeEach(() => {
  updateOrganisation.mockReset()
})

describe('OrgSettingsPage', () => {
  it('lets an owner rename the organisation and refreshes the loaders', async () => {
    updateOrganisation.mockResolvedValue({ ...testOrg, name: 'Acme Ltd' })
    const user = userEvent.setup()
    const { router } = renderAuthenticated(<OrgSettingsPage />, { role: 'owner' })
    const invalidate = vi.spyOn(router, 'invalidate')

    const name = await screen.findByLabelText('Organisation name')
    expect(name).toHaveValue('Acme')
    expect(screen.getByLabelText('URL name')).toHaveValue('acme')

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()

    await user.clear(name)
    await user.type(name, 'Acme Ltd')
    expect(save).toBeEnabled()
    await user.click(save)

    expect(updateOrganisation).toHaveBeenCalledWith('org-1', { name: 'Acme Ltd' })
    expect(await screen.findByText('Organisation updated.')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalled()
  })

  it('is read-only for members', async () => {
    renderAuthenticated(<OrgSettingsPage />, { role: 'member' })

    const name = await screen.findByLabelText('Organisation name')
    expect(name).toHaveAttribute('readonly')
    expect(screen.getByText(/Only owners and admins can change this/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('surfaces an update error', async () => {
    updateOrganisation.mockRejectedValue(new Error('permission denied for table organisations'))
    const user = userEvent.setup()
    renderAuthenticated(<OrgSettingsPage />, { role: 'admin' })

    const name = await screen.findByLabelText('Organisation name')
    await user.type(name, '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('permission denied for table organisations')).toBeInTheDocument()
  })
})
