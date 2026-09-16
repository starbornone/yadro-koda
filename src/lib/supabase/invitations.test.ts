import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptInvitation,
  createInvitation,
  getInvitation,
  invitationLink,
  invitationStatus,
  listInvitations,
  revokeInvitation,
} from './invitations'

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return { builder, from: vi.fn(() => builder), rpc: vi.fn() }
})

vi.mock('@/lib/supabase/supabase', () => ({
  supabase: { from: query.from, rpc: query.rpc },
}))

const TOKEN = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

const invitation = {
  id: 'inv-1',
  org_id: 'org-1',
  email: 'grace@acme.test',
  role: 'member',
  token: TOKEN,
  invited_by: 'user-1',
  expires_at: '2999-01-01T00:00:00Z',
  accepted_at: null,
  created_at: '2026-09-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of ['select', 'insert', 'delete', 'eq', 'is', 'order'] as const) {
    query.builder[fn].mockReset().mockReturnValue(query.builder)
  }
  query.builder.single.mockReset()
  query.builder.maybeSingle.mockReset()
  query.rpc.mockReset().mockReturnValue(query.builder)
})

describe('invitationStatus', () => {
  it('is accepted, expired or pending', () => {
    const now = Date.parse('2026-09-16T00:00:00Z')
    expect(invitationStatus({ expires_at: '2999-01-01T00:00:00Z', accepted_at: null }, now)).toBe(
      'pending',
    )
    expect(invitationStatus({ expires_at: '2026-09-15T00:00:00Z', accepted_at: null }, now)).toBe(
      'expired',
    )
    // Accepted wins even after the link would have expired.
    expect(
      invitationStatus({ expires_at: '2026-09-15T00:00:00Z', accepted_at: '2026-09-10' }, now),
    ).toBe('accepted')
  })
})

describe('invitationLink', () => {
  it('points at the invite page on the given origin', () => {
    expect(invitationLink(TOKEN, 'https://app.example.com')).toBe(
      `https://app.example.com/invite/${TOKEN}`,
    )
    expect(invitationLink(TOKEN)).toBe(`${window.location.origin}/invite/${TOKEN}`)
  })
})

describe('listInvitations', () => {
  it('returns the open invitations for an organisation', async () => {
    query.builder.order.mockResolvedValue({ data: [invitation], error: null })

    await expect(listInvitations('org-1')).resolves.toEqual([invitation])
    expect(query.from).toHaveBeenCalledWith('invitations')
    expect(query.builder.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(query.builder.is).toHaveBeenCalledWith('accepted_at', null)
  })

  it('throws the Supabase error', async () => {
    const error = new Error('boom')
    query.builder.order.mockResolvedValue({ data: null, error })

    await expect(listInvitations('org-1')).rejects.toBe(error)
  })
})

describe('createInvitation', () => {
  it('inserts a normalised email and returns the row with its token', async () => {
    query.builder.single.mockResolvedValue({ data: invitation, error: null })

    await expect(
      createInvitation('org-1', { email: '  Grace@Acme.test ', role: 'member' }),
    ).resolves.toEqual(invitation)
    expect(query.builder.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
    })
    expect(query.builder.select).toHaveBeenCalledWith(expect.stringContaining('token'))
  })

  it('throws the Supabase error, such as a duplicate pending invitation', async () => {
    const error = new Error(
      'duplicate key value violates unique constraint "invitations_one_pending_per_email"',
    )
    query.builder.single.mockResolvedValue({ data: null, error })

    await expect(
      createInvitation('org-1', { email: 'grace@acme.test', role: 'member' }),
    ).rejects.toBe(error)
  })
})

describe('revokeInvitation', () => {
  it('deletes the row', async () => {
    query.builder.eq.mockResolvedValue({ error: null })

    await revokeInvitation('inv-1')

    expect(query.from).toHaveBeenCalledWith('invitations')
    expect(query.builder.delete).toHaveBeenCalled()
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'inv-1')
  })
})

describe('getInvitation', () => {
  it('asks the database for the preview behind a token', async () => {
    const preview = {
      organisation_name: 'Acme',
      email: 'grace@acme.test',
      role: 'member',
      invited_by_name: 'Ada',
      expires_at: '2999-01-01T00:00:00Z',
      accepted_at: null,
    }
    query.builder.maybeSingle.mockResolvedValue({ data: preview, error: null })

    await expect(getInvitation(TOKEN)).resolves.toEqual(preview)
    expect(query.rpc).toHaveBeenCalledWith('get_invitation', { token: TOKEN })
  })

  it('is null for an unknown token, without a round trip for a malformed one', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getInvitation(TOKEN)).resolves.toBeNull()

    query.rpc.mockClear()
    await expect(getInvitation('not-a-token')).resolves.toBeNull()
    expect(query.rpc).not.toHaveBeenCalled()
  })
})

describe('acceptInvitation', () => {
  it('returns the organisation joined', async () => {
    const org = { id: 'org-1', name: 'Acme', slug: 'acme', created_at: '' }
    query.rpc.mockResolvedValue({ data: org, error: null })

    await expect(acceptInvitation(TOKEN)).resolves.toEqual(org)
    expect(query.rpc).toHaveBeenCalledWith('accept_invitation', { token: TOKEN })
  })

  it('throws the database’s refusal', async () => {
    const error = new Error('invitation was sent to a different email address')
    query.rpc.mockResolvedValue({ data: null, error })

    await expect(acceptInvitation(TOKEN)).rejects.toBe(error)
  })
})
