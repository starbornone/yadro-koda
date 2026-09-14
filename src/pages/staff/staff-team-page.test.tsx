import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlatformMember } from '@/lib/supabase/platform'
import { renderStaff } from '@/test/render-authenticated'
import { StaffTeamPage } from './staff-team-page'

const platform = vi.hoisted(() => ({
  updatePlatformMemberRole: vi.fn(),
  removePlatformMember: vi.fn(),
}))
vi.mock('@/lib/supabase/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/platform')>()),
  ...platform,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const members: PlatformMember[] = [
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

const renderPage = (platformRole: 'admin' | 'support' = 'admin') =>
  renderStaff(<StaffTeamPage />, { path: '/staff/team', loaderData: members, platformRole })

beforeEach(() => {
  platform.updatePlatformMemberRole.mockReset().mockResolvedValue(undefined)
  platform.removePlatformMember.mockReset().mockResolvedValue(undefined)
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

  it('is read-only for support staff', async () => {
    renderPage('support')

    await screen.findByText('Grace')
    expect(screen.queryByRole('button', { name: /Change role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
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
