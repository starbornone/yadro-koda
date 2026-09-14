import type { OrgRole, Organisation } from './organisations'
import { supabase } from './supabase'

export type PlatformRole = 'admin' | 'support'

/** The subset of a colleague's profile other people may see. */
export type PublicProfile = {
  id: string
  display_name: string | null
  email: string | null
}

export type PlatformMember = {
  user_id: string
  role: PlatformRole
  created_at: string
  profile: PublicProfile
}

export type OrganisationSummary = Organisation & {
  member_count: number
}

export type OrganisationMember = {
  user_id: string
  role: OrgRole
  expires_at: string | null
  created_at: string
  profile: PublicProfile
}

export type OrganisationDetail = Organisation & {
  members: OrganisationMember[]
}

export type PlatformOverview = {
  organisations: number
  memberships: number
  staff: number
}

/** The caller's platform role, or null for everyone who is not staff. */
export const getMyPlatformRole = async (userId: string): Promise<PlatformRole | null> => {
  const { data, error } = await supabase
    .from('platform_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data?.role as PlatformRole | undefined) ?? null
}

// ---------------------------------------------------------------------------
// Staff views over tenants. RLS lets staff read every organisation and membership.
// ---------------------------------------------------------------------------

export const listOrganisations = async (search = ''): Promise<OrganisationSummary[]> => {
  let query = supabase
    .from('organisations')
    .select('id, name, slug, created_at, memberships(count)')
    .order('created_at', { ascending: false })

  const term = search.trim()
  if (term) {
    query = query.or(`name.ilike.%${escapeLike(term)}%,slug.ilike.%${escapeLike(term)}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  type Row = Organisation & { memberships: Array<{ count: number }> }
  return ((data ?? []) as unknown as Row[]).map(({ memberships, ...organisation }) => ({
    ...organisation,
    member_count: memberships[0]?.count ?? 0,
  }))
}

export const getOrganisation = async (orgId: string): Promise<OrganisationDetail | null> => {
  const { data, error } = await supabase
    .from('organisations')
    .select(
      'id, name, slug, created_at, members:memberships(user_id, role, expires_at, created_at, profile:profiles(id, display_name, email))',
    )
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as unknown as OrganisationDetail | null
}

export const getPlatformOverview = async (): Promise<PlatformOverview> => {
  const count = async (table: 'organisations' | 'memberships' | 'platform_members') => {
    const { count: n, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      throw error
    }
    return n ?? 0
  }

  const [organisations, memberships, staff] = await Promise.all([
    count('organisations'),
    count('memberships'),
    count('platform_members'),
  ])

  return { organisations, memberships, staff }
}

// ---------------------------------------------------------------------------
// The platform team itself. Reads need any staff role; writes need `admin` (RLS).
// ---------------------------------------------------------------------------

export const listPlatformMembers = async (): Promise<PlatformMember[]> => {
  const { data, error } = await supabase
    .from('platform_members')
    .select('user_id, role, created_at, profile:profiles(id, display_name, email)')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as PlatformMember[]
}

export const updatePlatformMemberRole = async (
  userId: string,
  role: PlatformRole,
): Promise<void> => {
  const { error } = await supabase.from('platform_members').update({ role }).eq('user_id', userId)

  if (error) {
    throw error
  }
}

export const removePlatformMember = async (userId: string): Promise<void> => {
  const { error } = await supabase.from('platform_members').delete().eq('user_id', userId)

  if (error) {
    throw error
  }
}

// PostgREST `ilike` patterns: escape the wildcards and the filter-list separators.
const escapeLike = (value: string) => value.replace(/[%_\\,()]/g, (char) => `\\${char}`)
