import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOrganisation,
  getMyMemberships,
  setActiveOrganisation,
  slugify,
  updateOrganisation,
} from './organisations'

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  return { builder, from: vi.fn(() => builder), rpc: vi.fn() }
})

vi.mock('@/lib/supabase/supabase', () => ({
  supabase: { from: query.from, rpc: query.rpc },
}))

const org = { id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  query.builder.select.mockReturnValue(query.builder)
  query.builder.update.mockReturnValue(query.builder)
  query.builder.eq.mockReturnValue(query.builder)
  query.builder.order.mockReset()
  query.builder.maybeSingle.mockReset()
  query.rpc.mockReset()
})

describe('getMyMemberships', () => {
  it('embeds the organisation and drops expired memberships', async () => {
    query.builder.order.mockResolvedValue({
      data: [
        { org_id: 'org-1', role: 'owner', expires_at: null, organisation: org },
        { org_id: 'org-2', role: 'member', expires_at: '2000-01-01T00:00:00Z', organisation: org },
        { org_id: 'org-3', role: 'member', expires_at: '2999-01-01T00:00:00Z', organisation: org },
      ],
      error: null,
    })

    const memberships = await getMyMemberships('user-1')

    expect(query.from).toHaveBeenCalledWith('memberships')
    expect(query.builder.select).toHaveBeenCalledWith(
      expect.stringContaining('organisation:organisations('),
    )
    expect(query.builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(memberships.map((m) => m.org_id)).toEqual(['org-1', 'org-3'])
  })

  it('throws the Supabase error', async () => {
    const error = new Error('boom')
    query.builder.order.mockResolvedValue({ data: null, error })

    await expect(getMyMemberships('user-1')).rejects.toBe(error)
  })
})

describe('createOrganisation', () => {
  it('calls the RPC with a trimmed name', async () => {
    query.rpc.mockResolvedValue({ data: org, error: null })

    await expect(createOrganisation({ name: '  Acme ', slug: 'acme' })).resolves.toEqual(org)
    expect(query.rpc).toHaveBeenCalledWith('create_organisation', { name: 'Acme', slug: 'acme' })
  })

  it('throws the Supabase error', async () => {
    const error = new Error(
      'duplicate key value violates unique constraint "organisations_slug_key"',
    )
    query.rpc.mockResolvedValue({ data: null, error })

    await expect(createOrganisation({ name: 'Acme', slug: 'acme' })).rejects.toBe(error)
  })
})

describe('updateOrganisation', () => {
  it('updates the name for one organisation', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: { ...org, name: 'Acme Ltd' }, error: null })

    await expect(updateOrganisation('org-1', { name: ' Acme Ltd ' })).resolves.toMatchObject({
      name: 'Acme Ltd',
    })
    expect(query.from).toHaveBeenCalledWith('organisations')
    expect(query.builder.update).toHaveBeenCalledWith({ name: 'Acme Ltd' })
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'org-1')
  })
})

describe('setActiveOrganisation', () => {
  it("writes the user's active_org_id", async () => {
    query.builder.eq.mockResolvedValue({ error: null })

    await setActiveOrganisation('user-1', 'org-2')

    expect(query.from).toHaveBeenCalledWith('profiles')
    expect(query.builder.update).toHaveBeenCalledWith({ active_org_id: 'org-2' })
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'user-1')
  })
})

describe('slugify', () => {
  it('produces a URL-safe identifier', () => {
    expect(slugify('Acme & Co.')).toBe('acme-co')
    expect(slugify('  Über   Café ')).toBe('uber-cafe')
    expect(slugify('---')).toBe('')
    expect(slugify('a'.repeat(60))).toHaveLength(50)
    expect(slugify('a'.repeat(49) + '-b')).toBe('a'.repeat(49))
  })
})
