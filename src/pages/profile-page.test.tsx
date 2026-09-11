import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAuthenticated, testProfile } from '@/test/render-authenticated'
import { ProfilePage } from './profile-page'

const updateMyProfile = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/profiles', () => ({ updateMyProfile }))

const auth = vi.hoisted(() => ({ signOut: vi.fn(), updateUser: vi.fn() }))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth } }))

beforeEach(() => {
  updateMyProfile.mockReset()
  auth.signOut.mockReset().mockResolvedValue({ error: null })
  auth.updateUser.mockReset()
})

describe('ProfilePage', () => {
  it('shows the current profile and account details', async () => {
    renderAuthenticated(<ProfilePage />)

    expect(await screen.findByLabelText('Display name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Phone')).toHaveValue('')
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('falls back gracefully when there is no profile row yet', async () => {
    renderAuthenticated(<ProfilePage />, { profile: null })

    expect(await screen.findByLabelText('Display name')).toHaveValue('')
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('keeps Save disabled until something changes', async () => {
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText('Phone'), '+1 555')
    expect(save).toBeEnabled()

    await user.clear(screen.getByLabelText('Phone'))
    expect(save).toBeDisabled()
  })

  it('saves changes, shows what was stored and refreshes the loader', async () => {
    updateMyProfile.mockResolvedValue({ ...testProfile, display_name: 'Ada L', phone: '+1 555' })
    const user = userEvent.setup()
    const { router } = renderAuthenticated(<ProfilePage />)
    const invalidate = vi.spyOn(router, 'invalidate')

    const name = await screen.findByLabelText('Display name')
    await user.clear(name)
    await user.type(name, '  Ada L  ')
    await user.type(screen.getByLabelText('Phone'), '+1 555')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateMyProfile).toHaveBeenCalledWith('user-1', {
      display_name: '  Ada L  ',
      phone: '+1 555',
    })
    expect(await screen.findByText('Profile updated.')).toBeInTheDocument()
    expect(name).toHaveValue('Ada L')
    expect(invalidate).toHaveBeenCalled()
  })

  it('surfaces a save error', async () => {
    updateMyProfile.mockRejectedValue(new Error('permission denied for table profiles'))
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.type(await screen.findByLabelText('Phone'), '+1 555')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('permission denied for table profiles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('keeps Update password disabled until both fields are filled', async () => {
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    const update = await screen.findByRole('button', { name: 'Update password' })
    expect(update).toBeDisabled()

    await user.type(screen.getByLabelText('New password'), 'hunter22')
    expect(update).toBeDisabled()

    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22')
    expect(update).toBeEnabled()
  })

  it('rejects mismatched passwords without calling Supabase', async () => {
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.type(await screen.findByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter23')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('changes the password, confirms, and clears the fields', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.type(await screen.findByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'hunter22' })
    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled()

    // Editing again dismisses the confirmation.
    await user.type(screen.getByLabelText('New password'), 'x')
    expect(screen.queryByText('Password updated.')).not.toBeInTheDocument()
  })

  it('surfaces a password update error', async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { message: 'New password should be different from the old password.' },
    })
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.type(await screen.findByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(
      await screen.findByText('New password should be different from the old password.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveValue('hunter22')
  })

  it('signs out from the session section', async () => {
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(auth.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled())
  })

  it('shows a sign-out error and re-enables the button', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    renderAuthenticated(<ProfilePage />)

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })
})
