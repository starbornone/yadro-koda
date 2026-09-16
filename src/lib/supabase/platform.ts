import type { CustomerStage } from './crm'
import {
  MEMBER_SELECT,
  type Organisation,
  type OrganisationMember,
  type PublicProfile,
} from './organisations'
import { supabase } from './supabase'

export type PlatformRole = 'superadmin' | 'admin' | 'support'

export type PlatformMember = {
  user_id: string
  role: PlatformRole
  created_at: string
  profile: PublicProfile
}

/** An invitation to the staff team. Same shape as an organisation's, minus the organisation. */
export type PlatformInvitation = {
  id: string
  email: string
  role: PlatformRole
  /** The link secret. */
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

/** An organisation in the staff list: the tenant plus its CRM stage and account manager. */
export type OrganisationSummary = Organisation & {
  member_count: number
  stage: CustomerStage
  owner: PublicProfile | null
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

export type ListOrganisationsOptions = {
  /** Matches name or slug, case-insensitively. */
  search?: string
  /** Only organisations at this CRM stage. */
  stage?: CustomerStage
}

export const listOrganisations = async ({
  search = '',
  stage,
}: ListOrganisationsOptions = {}): Promise<OrganisationSummary[]> => {
  // `!inner` so the stage filter applies (every organisation has a customers row, by trigger).
  let query = supabase
    .from('organisations')
    .select(
      'id, name, slug, created_at, memberships(count), customers!inner(stage, owner:platform_members(user_id, profile:profiles(id, display_name, email)))',
    )
    .order('created_at', { ascending: false })

  const term = search.trim()
  if (term) {
    query = query.or(`name.ilike.%${escapeLike(term)}%,slug.ilike.%${escapeLike(term)}%`)
  }
  if (stage) {
    query = query.eq('customers.stage', stage)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  type Row = Organisation & {
    memberships: Array<{ count: number }>
    customers: { stage: CustomerStage; owner: { profile: PublicProfile } | null }
  }
  return ((data ?? []) as unknown as Row[]).map(({ memberships, customers, ...organisation }) => ({
    ...organisation,
    member_count: memberships[0]?.count ?? 0,
    stage: customers.stage,
    owner: customers.owner?.profile ?? null,
  }))
}

export const getOrganisation = async (orgId: string): Promise<OrganisationDetail | null> => {
  const { data, error } = await supabase
    .from('organisations')
    .select(`id, name, slug, created_at, members:memberships(${MEMBER_SELECT})`)
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

// Invitations to the team. Any staff member may read them; creating and revoking follow the
// same tier rule as the team itself (RLS). The link and the accept screen are shared with
// organisation invitations — see `invitations.ts`.

const PLATFORM_INVITATION_SELECT =
  'id, email, role, token, invited_by, expires_at, accepted_at, created_at'

/** Open invitations to the team (pending and expired), oldest first. */
export const listPlatformInvitations = async (): Promise<PlatformInvitation[]> => {
  const { data, error } = await supabase
    .from('platform_invitations')
    .select(PLATFORM_INVITATION_SELECT)
    .is('accepted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as PlatformInvitation[]
}

export type CreatePlatformInvitationInput = {
  email: string
  role: PlatformRole
}

/** Invites an email address to the team. Returns the row, token included, for the link. */
export const createPlatformInvitation = async (
  input: CreatePlatformInvitationInput,
): Promise<PlatformInvitation> => {
  const { data, error } = await supabase
    .from('platform_invitations')
    .insert({ email: input.email.trim().toLowerCase(), role: input.role })
    .select(PLATFORM_INVITATION_SELECT)
    .single()

  if (error) {
    throw error
  }

  return data as unknown as PlatformInvitation
}

export const revokePlatformInvitation = async (invitationId: string): Promise<void> => {
  const { error } = await supabase.from('platform_invitations').delete().eq('id', invitationId)

  if (error) {
    throw error
  }
}

// PostgREST `ilike` patterns: escape the wildcards and the filter-list separators.
const escapeLike = (value: string) => value.replace(/[%_\\,()]/g, (char) => `\\${char}`)
