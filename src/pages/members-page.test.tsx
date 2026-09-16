import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invitation } from '@/lib/supabase/invitations'
import type { OrgRole, OrganisationMember } from '@/lib/supabase/organisations'
import { renderAuthenticated } from '@/test/render-authenticated'
import { MembersPage } from './members-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const organisations = vi.hoisted(() => ({
  updateMembershipRole: vi.fn(),
  removeMember: vi.fn(),
}))
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  ...organisations,
}))

const invitationsApi = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}))
vi.mock('@/lib/supabase/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/invitations')>()),
  ...invitationsApi,
}))

const TOKEN = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

// user-1 (Ada) is the signed-in user in the harness.
const members: OrganisationMember[] = [
  {
    user_id: 'user-1',
    role: 'owner',
    expires_at: null,
    created_at: '2026-01-02T00:00:00Z',
    profile: { id: 'user-1', display_name: 'Ada', email: 'ada@example.com' },
  },
  {
    user_id: 'user-0',
    role: 'owner',
    expires_at: null,
    created_at: '2026-01-03T00:00:00Z',
    profile: { id: 'user-0', display_name: 'Linus', email: 'linus@example.com' },
  },
  {
    user_id: 'user-2',
    role: 'member',
    expires_at: '2026-12-31T00:00:00Z',
    created_at: '2026-06-01T00:00:00Z',
    profile: { id: 'user-2', display_name: null, email: 'grace@example.com' },
  },
]

const invitations: Invitation[] = [
  {
    id: 'inv-1',
    org_id: 'org-1',
    email: 'katherine@example.com',
    role: 'admin',
    token: TOKEN,
    invited_by: 'user-1',
    expires_at: '2999-01-01T00:00:00Z',
    accepted_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    org_id: 'org-1',
    email: 'old@example.com',
    role: 'member',
    token: '11111111-2222-4333-8444-555555555555',
    invited_by: 'user-1',
    expires_at: '2020-01-01T00:00:00Z',
    accepted_at: null,
    created_at: '2019-12-25T00:00:00Z',
  },
]

const renderPage = (role: OrgRole = 'owner') =>
  renderAuthenticated(<MembersPage />, {
    role,
    path: '/app/members',
    loaderData: { members, invitations: role === 'member' ? [] : invitations },
  })

beforeEach(() => {
  for (const fn of Object.values(organisations)) fn.mockReset().mockResolvedValue(undefined)
  invitationsApi.createInvitation.mockReset()
  invitationsApi.revokeInvitation.mockReset().mockResolvedValue(undefined)
})

describe('MembersPage', () => {
  it('lists members with roles and access, marking the current user', async () => {
    renderPage('member')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'People in Acme' }),
    ).toBeInTheDocument()
    const ada = screen.getByText('Ada').closest('tr')!
    expect(within(ada).getByText('you')).toBeInTheDocument()
    expect(ada).toHaveTextContent('Owner')
    expect(ada).toHaveTextContent('Never')
    const grace = screen.getByText('grace@example.com').closest('tr')!
    expect(grace).toHaveTextContent('Member')
    expect(grace).not.toHaveTextContent('Never')
  })

  it('is read-only for members, who see no invitations either', async () => {
    renderPage('member')

    await screen.findByText('Linus')
    expect(screen.getByText(/Only owners and admins can manage members/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Change role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invitations' })).not.toBeInTheDocument()
  })

  it('lets an owner change a role and refreshes, never on their own row', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('owner')
    const invalidate = vi.spyOn(router, 'invalidate')

    await screen.findByText('Linus')
    expect(screen.queryByRole('button', { name: 'Change role for Ada' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change role for Linus' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Owner' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitemradio', { name: 'Member' }))

    expect(organisations.updateMembershipRole).toHaveBeenCalledWith('org-1', 'user-0', 'member')
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('never lets an admin reach an owner or offer the owner role', async () => {
    const user = userEvent.setup()
    renderPage('admin')

    await screen.findByText('Linus')
    expect(screen.queryByRole('button', { name: 'Change role for Linus' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Linus' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change role for grace@example.com' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio', { name: 'Owner' })).not.toBeInTheDocument()
  })

  it('asks before removing, then removes and surfaces a refusal', async () => {
    organisations.removeMember.mockRejectedValue(new Error('cannot remove the last owner'))
    const user = userEvent.setup()
    renderPage('owner')

    await user.click(await screen.findByRole('button', { name: 'Remove Linus' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Remove Linus from the organisation?',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(organisations.removeMember).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove Linus' }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(organisations.removeMember).toHaveBeenCalledWith('org-1', 'user-0')
    expect(await screen.findByText('cannot remove the last owner')).toBeInTheDocument()
  })

  it('shows open invitations, flags expired ones and copies a link', async () => {
    const user = userEvent.setup()
    renderPage('owner')

    const section = within(await screen.findByRole('region', { name: 'Invitations' }))
    const katherine = section.getByText('katherine@example.com').closest('tr')!
    expect(katherine).toHaveTextContent('Admin')
    const old = section.getByText('old@example.com').closest('tr')!
    expect(old).toHaveTextContent('Expired')
    expect(within(old).queryByRole('button', { name: /Copy link/ })).not.toBeInTheDocument()

    await user.click(within(katherine).getByRole('button', { name: /Copy link/ }))
    await expect(navigator.clipboard.readText()).resolves.toBe(
      `${window.location.origin}/invite/${TOKEN}`,
    )
  })

  it('creates an invitation and shows its link', async () => {
    invitationsApi.createInvitation.mockResolvedValue({
      ...invitations[0],
      id: 'inv-3',
      email: 'new@example.com',
      role: 'member',
      token: '22222222-3333-4444-8555-666666666666',
    })
    const user = userEvent.setup()
    const { router } = renderPage('admin')
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.type(await screen.findByLabelText('Email'), 'New@Example.com')
    await user.selectOptions(screen.getByLabelText('Role'), 'member')
    await user.click(screen.getByRole('button', { name: 'Create invitation' }))

    expect(invitationsApi.createInvitation).toHaveBeenCalledWith('org-1', {
      email: 'New@Example.com',
      role: 'member',
    })
    expect(await screen.findByLabelText('Invitation link for new@example.com')).toHaveValue(
      `${window.location.origin}/invite/22222222-3333-4444-8555-666666666666`,
    )
    expect(screen.getByLabelText('Email')).toHaveValue('')
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('surfaces a duplicate invitation', async () => {
    invitationsApi.createInvitation.mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "invitations_one_pending_per_email"',
      ),
    )
    const user = userEvent.setup()
    renderPage('owner')

    await user.type(await screen.findByLabelText('Email'), 'katherine@example.com')
    await user.click(screen.getByRole('button', { name: 'Create invitation' }))

    expect(await screen.findByText(/invitations_one_pending_per_email/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('katherine@example.com')
  })

  it('revokes an invitation within the viewer’s tier', async () => {
    const user = userEvent.setup()
    renderPage('admin')

    const section = within(await screen.findByRole('region', { name: 'Invitations' }))
    // Admins may revoke admin and member invitations; the owner-role select is not offered.
    expect(
      within(section.getByLabelText('Role')).queryByRole('option', { name: 'Owner' }),
    ).not.toBeInTheDocument()

    await user.click(section.getByRole('button', { name: 'Revoke invitation for old@example.com' }))
    await user.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(invitationsApi.revokeInvitation).toHaveBeenCalledWith('inv-2')
  })
})
