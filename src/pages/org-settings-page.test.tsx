import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAuthenticated, testOrg } from '@/test/render-authenticated'
import { OrgSettingsPage } from './org-settings-page'

const organisations = vi.hoisted(() => ({
  updateOrganisation: vi.fn(),
  deleteOrganisation: vi.fn(),
}))
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  ...organisations,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))
const { updateOrganisation, deleteOrganisation } = organisations

beforeEach(() => {
  updateOrganisation.mockReset()
  deleteOrganisation.mockReset()
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

  it('lets only owners delete, after typing the URL name back', async () => {
    deleteOrganisation.mockResolvedValue(testOrg)
    const user = userEvent.setup()
    const { router } = renderAuthenticated(<OrgSettingsPage />, { role: 'owner' })
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: 'Delete organisation' }))
    const dialog = within(await screen.findByRole('alertdialog'))
    expect(dialog.getByRole('heading', { name: 'Delete Acme?' })).toBeInTheDocument()
    const confirm = dialog.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()

    await user.type(dialog.getByLabelText('URL name'), 'acme-ltd')
    expect(confirm).toBeDisabled()
    await user.clear(dialog.getByLabelText('URL name'))
    await user.type(dialog.getByLabelText('URL name'), 'acme')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(deleteOrganisation).toHaveBeenCalledWith('org-1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
    expect(invalidate).toHaveBeenCalled()
  })

  it('keeps the dialog open and explains when nothing was deleted', async () => {
    deleteOrganisation.mockResolvedValue(null)
    const user = userEvent.setup()
    renderAuthenticated(<OrgSettingsPage />, { role: 'owner' })

    await user.click(await screen.findByRole('button', { name: 'Delete organisation' }))
    const dialog = within(await screen.findByRole('alertdialog'))
    await user.type(dialog.getByLabelText('URL name'), 'acme')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(await dialog.findByText(/Nothing was deleted/)).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('offers no deletion to admins', async () => {
    renderAuthenticated(<OrgSettingsPage />, { role: 'admin' })

    await screen.findByLabelText('Organisation name')
    expect(screen.queryByRole('button', { name: 'Delete organisation' })).not.toBeInTheDocument()
  })
})
