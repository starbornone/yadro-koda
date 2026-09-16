import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlatformInvitation, PlatformMember } from '@/lib/supabase/platform'
import { renderStaff } from '@/test/render-authenticated'
import { StaffTeamPage } from './staff-team-page'

const platform = vi.hoisted(() => ({
  updatePlatformMemberRole: vi.fn(),
  removePlatformMember: vi.fn(),
  createPlatformInvitation: vi.fn(),
  revokePlatformInvitation: vi.fn(),
}))
vi.mock('@/lib/supabase/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/platform')>()),
  ...platform,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const members: PlatformMember[] = [
  {
    user_id: 'user-0',
    role: 'superadmin',
    created_at: '2025-12-01T00:00:00Z',
    profile: { id: 'user-0', display_name: 'Linus', email: 'linus@example.com' },
  },
  {
    user_id: 'user-1',
    role: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    profile: { id: 'user-1', display_name: 'Ada', email: 'ada@example.com' },
  },
  {
    user_id: 'user-2',
    role: 'support',
    created_at: '2026-02-01T00:00:00Z',
    profile: { id: 'user-2', display_name: 'Grace', email: 'grace@example.com' },
  },
]

const TOKEN = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

const invitations: PlatformInvitation[] = [
  {
    id: 'inv-1',
    email: 'margaret@example.com',
    role: 'superadmin',
    token: TOKEN,
    invited_by: 'user-0',
    expires_at: '2999-01-01T00:00:00Z',
    accepted_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    email: 'katherine@example.com',
    role: 'support',
    token: '11111111-2222-4333-8444-555555555555',
    invited_by: 'user-1',
    expires_at: '2999-01-02T00:00:00Z',
    accepted_at: null,
    created_at: '2026-09-02T00:00:00Z',
  },
]

const renderPage = (platformRole: 'superadmin' | 'admin' | 'support' = 'admin') =>
  renderStaff(<StaffTeamPage />, {
    path: '/staff/team',
    loaderData: { members, invitations: platformRole === 'support' ? [] : invitations },
    platformRole,
  })

beforeEach(() => {
  for (const fn of Object.values(platform)) fn.mockReset().mockResolvedValue(undefined)
})

describe('StaffTeamPage', () => {
  it('lists the team and marks the current user', async () => {
    renderPage()

    const ada = (await screen.findByText('Ada')).closest('tr')!
    expect(within(ada).getByText('you')).toBeInTheDocument()
    expect(within(ada).getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Grace').closest('tr')).toHaveTextContent('Support')
  })

  it('lets an admin change a colleague’s role and refreshes', async () => {
    const user = userEvent.setup()
    const { router } = renderPage()
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: 'Change role for Grace' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Admin' }))

    expect(platform.updatePlatformMemberRole).toHaveBeenCalledWith('user-2', 'admin')
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('never lets an admin reach a superadmin, or offer the superadmin role', async () => {
    const user = userEvent.setup()
    renderPage('admin')

    await screen.findByText('Linus')
    expect(screen.queryByRole('button', { name: 'Change role for Linus' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Linus' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change role for Grace' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio', { name: 'Superadmin' })).not.toBeInTheDocument()
  })

  it('lets a superadmin manage everyone and assign any role', async () => {
    const user = userEvent.setup()
    renderPage('superadmin')

    // user-1 is the current user in the harness; Linus is another superadmin.
    expect(await screen.findByRole('button', { name: 'Change role for Linus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Linus' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change role for Grace' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Superadmin' })).toBeInTheDocument()
  })

  it('asks before removing, then removes', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Grace' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Remove Grace from the team?')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(platform.removePlatformMember).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove Grace' }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(platform.removePlatformMember).toHaveBeenCalledWith('user-2')
  })

  it('never offers controls on the current user', async () => {
    renderPage()

    await screen.findByText('Ada')
    expect(screen.queryByRole('button', { name: 'Change role for Ada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Ada' })).not.toBeInTheDocument()
  })

  it('is read-only for support staff, who see no invitations either', async () => {
    renderPage('support')

    await screen.findByText('Grace')
    expect(screen.queryByRole('button', { name: /Change role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invitations' })).not.toBeInTheDocument()
  })

  it('lets an admin invite below superadmin and revoke only within that tier', async () => {
    platform.createPlatformInvitation.mockResolvedValue({
      ...invitations[1],
      id: 'inv-3',
      email: 'new@example.com',
      role: 'admin',
      token: '22222222-3333-4444-8555-666666666666',
    })
    const user = userEvent.setup()
    const { router } = renderPage('admin')
    const invalidate = vi.spyOn(router, 'invalidate')

    const section = within(await screen.findByRole('region', { name: 'Invitations' }))
    const role = section.getByLabelText('Role')
    expect(within(role).getByRole('option', { name: 'Admin' })).toBeInTheDocument()
    expect(within(role).queryByRole('option', { name: 'Superadmin' })).not.toBeInTheDocument()
    // A pending superadmin invitation is visible but out of an admin's reach.
    expect(section.getByText('margaret@example.com').closest('tr')).toHaveTextContent('Superadmin')
    expect(
      section.queryByRole('button', { name: 'Revoke invitation for margaret@example.com' }),
    ).not.toBeInTheDocument()
    expect(
      section.getByRole('button', { name: 'Revoke invitation for katherine@example.com' }),
    ).toBeInTheDocument()

    await user.type(section.getByLabelText('Email'), 'new@example.com')
    await user.selectOptions(role, 'admin')
    await user.click(section.getByRole('button', { name: 'Create invitation' }))

    expect(platform.createPlatformInvitation).toHaveBeenCalledWith({
      email: 'new@example.com',
      role: 'admin',
    })
    expect(await screen.findByLabelText('Invitation link for new@example.com')).toHaveValue(
      `${window.location.origin}/invite/22222222-3333-4444-8555-666666666666`,
    )
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('lets a superadmin invite as any role and revoke anything', async () => {
    const user = userEvent.setup()
    renderPage('superadmin')

    const section = within(await screen.findByRole('region', { name: 'Invitations' }))
    expect(
      within(section.getByLabelText('Role')).getByRole('option', { name: 'Superadmin' }),
    ).toBeInTheDocument()

    await user.click(
      section.getByRole('button', { name: 'Revoke invitation for margaret@example.com' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(platform.revokePlatformInvitation).toHaveBeenCalledWith('inv-1')
  })

  it('surfaces a failure, such as removing the last admin', async () => {
    platform.removePlatformMember.mockRejectedValue(
      new Error('cannot remove the last platform admin'),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Grace' }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('cannot remove the last platform admin')).toBeInTheDocument()
  })
})
