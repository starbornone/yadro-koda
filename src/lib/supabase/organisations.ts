import { supabase } from './supabase'

export type OrgRole = 'owner' | 'admin' | 'member'

export type Organisation = {
  id: string
  name: string
  slug: string
  created_at: string
}

/** A user's membership of one organisation, with the organisation embedded. */
export type Membership = {
  org_id: string
  role: OrgRole
  expires_at: string | null
  organisation: Organisation
}

/** The subset of another person's profile that colleagues may see. */
export type PublicProfile = {
  id: string
  display_name: string | null
  email: string | null
}

/** One organisation's membership as its members (and staff) see it, with the person embedded. */
export type OrganisationMember = {
  user_id: string
  role: OrgRole
  expires_at: string | null
  created_at: string
  profile: PublicProfile
}

const MEMBERSHIP_SELECT =
  'org_id, role, expires_at, organisation:organisations(id, name, slug, created_at)'
export const MEMBER_SELECT =
  'user_id, role, expires_at, created_at, profile:profiles(id, display_name, email)'

/**
 * The caller's memberships (RLS hides expired ones from `org_role()` checks, but they are still
 * rows the user can see, so filter here too).
 */
export const getMyMemberships = async (userId: string): Promise<Membership[]> => {
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBERSHIP_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const now = Date.now()
  return (data as unknown as Membership[]).filter(
    (membership) => !membership.expires_at || Date.parse(membership.expires_at) > now,
  )
}

export type CreateOrganisationInput = {
  name: string
  slug: string
}

/** Creates the organisation, makes the caller its owner and marks it active — one transaction. */
export const createOrganisation = async (input: CreateOrganisationInput): Promise<Organisation> => {
  const { data, error } = await supabase.rpc('create_organisation', {
    name: input.name.trim(),
    slug: input.slug,
  })

  if (error) {
    throw error
  }

  return data as Organisation
}

export type UpdateOrganisationInput = {
  name: string
}

export const updateOrganisation = async (
  orgId: string,
  updates: UpdateOrganisationInput,
): Promise<Organisation | null> => {
  const { data, error } = await supabase
    .from('organisations')
    .update({ name: updates.name.trim() })
    .eq('id', orgId)
    .select('id, name, slug, created_at')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

/**
 * Deletes the organisation and everything it owns (memberships, invitations, the CRM record).
 * Owners only, or a superadmin on the tenant's behalf (RLS). Returns null when nothing was
 * deleted — RLS hid the row — so the caller can say so rather than assume.
 */
export const deleteOrganisation = async (orgId: string): Promise<Organisation | null> => {
  const { data, error } = await supabase
    .from('organisations')
    .delete()
    .eq('id', orgId)
    .select('id, name, slug, created_at')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

// ---------------------------------------------------------------------------
// Members. Every member sees the list; owners and admins change roles and remove people, never
// above their own tier, and the database keeps at least one owner (RLS + trigger).
// ---------------------------------------------------------------------------

/** Owners first, then by when they joined. */
export const listMembers = async (orgId: string): Promise<OrganisationMember[]> => {
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBER_SELECT)
    .eq('org_id', orgId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as OrganisationMember[]
}

export const updateMembershipRole = async (
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<void> => {
  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

/** Time-boxed access: when this membership stops working, or null for no expiry. */
export const updateMembershipExpiry = async (
  orgId: string,
  userId: string,
  expiresAt: string | null,
): Promise<void> => {
  const { error } = await supabase
    .from('memberships')
    .update({ expires_at: expiresAt })
    .eq('org_id', orgId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

export const removeMember = async (orgId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

/** Remembers which organisation the user is working in. The DB rejects orgs they don't belong to. */
export const setActiveOrganisation = async (userId: string, orgId: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ active_org_id: orgId })
    .eq('id', userId)

  if (error) {
    throw error
  }
}

/**
 * Light normalisation of a slug while it is being typed: a trailing hyphen must survive so
 * "acme-" can become "acme-co". Run `slugify` on submit.
 */
export const normaliseSlugInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .slice(0, 50)

/** URL-safe identifier from a display name: "Acme & Co." → "acme-co". */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
