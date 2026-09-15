import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMyPlatformRole,
  getOrganisation,
  getPlatformOverview,
  listOrganisations,
  listPlatformMembers,
  removePlatformMember,
  updatePlatformMemberRole,
} from './platform'

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return { builder, from: vi.fn(() => builder) }
})

vi.mock('@/lib/supabase/supabase', () => ({ supabase: { from: query.from } }))

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of ['select', 'update', 'delete', 'eq', 'or', 'order'] as const) {
    query.builder[fn].mockReset().mockReturnValue(query.builder)
  }
  query.builder.maybeSingle.mockReset()
})

describe('getMyPlatformRole', () => {
  it('returns the role, or null for non-staff', async () => {
    query.builder.maybeSingle.mockResolvedValueOnce({ data: { role: 'support' }, error: null })
    await expect(getMyPlatformRole('user-1')).resolves.toBe('support')
    expect(query.from).toHaveBeenCalledWith('platform_members')
    expect(query.builder.eq).toHaveBeenCalledWith('user_id', 'user-1')

    query.builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(getMyPlatformRole('user-1')).resolves.toBeNull()
  })
})

describe('listOrganisations', () => {
  it('flattens the membership count and searches name or slug', async () => {
    query.builder.order.mockReturnValue(query.builder)
    query.builder.or.mockResolvedValue({
      data: [
        {
          id: 'org-1',
          name: 'Acme',
          slug: 'acme',
          created_at: '',
          memberships: [{ count: 3 }],
          customers: {
            stage: 'active',
            owner: {
              user_id: 'user-2',
              profile: { id: 'user-2', display_name: 'Linus', email: null },
            },
          },
        },
        {
          id: 'org-2',
          name: 'Globex',
          slug: 'globex',
          created_at: '',
          memberships: [],
          customers: { stage: 'lead', owner: null },
        },
      ],
      error: null,
    })

    const result = await listOrganisations({ search: '  ac%me ' })

    expect(query.builder.select).toHaveBeenCalledWith(expect.stringContaining('memberships(count)'))
    expect(query.builder.select).toHaveBeenCalledWith(expect.stringContaining('customers!inner('))
    expect(query.builder.or).toHaveBeenCalledWith('name.ilike.%ac\\%me%,slug.ilike.%ac\\%me%')
    expect(result).toEqual([
      {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        created_at: '',
        member_count: 3,
        stage: 'active',
        owner: { id: 'user-2', display_name: 'Linus', email: null },
      },
      {
        id: 'org-2',
        name: 'Globex',
        slug: 'globex',
        created_at: '',
        member_count: 0,
        stage: 'lead',
        owner: null,
      },
    ])
  })

  it('skips the filter when the search is blank', async () => {
    query.builder.order.mockResolvedValue({ data: [], error: null })

    await expect(listOrganisations({ search: '   ' })).resolves.toEqual([])
    expect(query.builder.or).not.toHaveBeenCalled()
  })

  it('filters on the embedded stage', async () => {
    query.builder.order.mockReturnValue(query.builder)
    query.builder.eq.mockResolvedValue({ data: [], error: null })

    await expect(listOrganisations({ stage: 'trial' })).resolves.toEqual([])
    expect(query.builder.eq).toHaveBeenCalledWith('customers.stage', 'trial')
  })
})

describe('getOrganisation', () => {
  it('embeds members with their profiles', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: { id: 'org-1', members: [] }, error: null })

    await expect(getOrganisation('org-1')).resolves.toEqual({ id: 'org-1', members: [] })
    expect(query.builder.select).toHaveBeenCalledWith(
      expect.stringContaining('members:memberships('),
    )
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'org-1')
  })
})

describe('getPlatformOverview', () => {
  it('counts the three tables without fetching rows', async () => {
    query.builder.select.mockResolvedValue({ count: 7, error: null })

    await expect(getPlatformOverview()).resolves.toEqual({
      organisations: 7,
      memberships: 7,
      staff: 7,
    })
    expect(query.builder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    expect(query.from).toHaveBeenCalledWith('organisations')
    expect(query.from).toHaveBeenCalledWith('memberships')
    expect(query.from).toHaveBeenCalledWith('platform_members')
  })
})

describe('platform team writes', () => {
  it('lists, updates a role and removes by user id', async () => {
    query.builder.order.mockResolvedValue({ data: [{ user_id: 'user-2' }], error: null })
    await expect(listPlatformMembers()).resolves.toEqual([{ user_id: 'user-2' }])

    query.builder.eq.mockResolvedValue({ error: null })
    await updatePlatformMemberRole('user-2', 'admin')
    expect(query.builder.update).toHaveBeenCalledWith({ role: 'admin' })
    expect(query.builder.eq).toHaveBeenCalledWith('user_id', 'user-2')

    await removePlatformMember('user-2')
    expect(query.builder.delete).toHaveBeenCalled()
  })

  it('throws the Supabase error', async () => {
    const error = new Error('cannot remove the last platform admin')
    query.builder.eq.mockResolvedValue({ error })

    await expect(removePlatformMember('user-1')).rejects.toBe(error)
  })
})
