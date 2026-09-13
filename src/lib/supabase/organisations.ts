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

const MEMBERSHIP_SELECT =
  'org_id, role, expires_at, organisation:organisations(id, name, slug, created_at)'

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
