import type { OrgRole, Organisation } from './organisations'
import { supabase } from './supabase'

/**
 * Invitations: how people join an organisation that already exists. A manager creates one for
 * an email and a role, passes on the link the app builds from its token, and whoever signs in
 * with that email and opens the link becomes a member (`accept_invitation()`). Rows are visible
 * to the organisation's managers and to staff; the invitee reads theirs through
 * `get_invitation()`, which works before they have signed in.
 */

export type Invitation = {
  id: string
  org_id: string
  email: string
  role: OrgRole
  /** The link secret. Only readable by people who may send the link. */
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

/** What `get_invitation()` tells the person holding the link. */
export type InvitationPreview = {
  organisation_name: string
  email: string
  role: OrgRole
  invited_by_name: string | null
  expires_at: string
  accepted_at: string | null
}

export type InvitationStatus = 'pending' | 'expired' | 'accepted'

export const invitationStatus = (
  invitation: Pick<InvitationPreview, 'expires_at' | 'accepted_at'>,
  now = Date.now(),
): InvitationStatus =>
  invitation.accepted_at
    ? 'accepted'
    : Date.parse(invitation.expires_at) <= now
      ? 'expired'
      : 'pending'

/** The URL the invitee opens. Built in the browser so it follows whatever host serves the app. */
export const invitationLink = (token: string, origin = window.location.origin) =>
  `${origin}/invite/${token}`

const INVITATION_SELECT =
  'id, org_id, email, role, token, invited_by, expires_at, accepted_at, created_at'

// Tokens are uuids; anything else cannot be an invitation, so skip the round trip (and the
// database's "invalid input syntax" error) for a mistyped link.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Open invitations for an organisation (pending and expired), oldest first. */
export const listInvitations = async (orgId: string): Promise<Invitation[]> => {
  const { data, error } = await supabase
    .from('invitations')
    .select(INVITATION_SELECT)
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as Invitation[]
}

export type CreateInvitationInput = {
  email: string
  role: OrgRole
}

/** Invites an email address to the organisation. Returns the row, token included, for the link. */
export const createInvitation = async (
  orgId: string,
  input: CreateInvitationInput,
): Promise<Invitation> => {
  const { data, error } = await supabase
    .from('invitations')
    .insert({ org_id: orgId, email: input.email.trim().toLowerCase(), role: input.role })
    .select(INVITATION_SELECT)
    .single()

  if (error) {
    throw error
  }

  return data as unknown as Invitation
}

export const revokeInvitation = async (invitationId: string): Promise<void> => {
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)

  if (error) {
    throw error
  }
}

/** The invitation behind a link, or null when there is none. Works signed out. */
export const getInvitation = async (token: string): Promise<InvitationPreview | null> => {
  if (!UUID.test(token)) return null

  const { data, error } = await supabase.rpc('get_invitation', { token }).maybeSingle()

  if (error) {
    throw error
  }

  return data as InvitationPreview | null
}

/** Joins the organisation as the invited role and makes it the caller's active one. */
export const acceptInvitation = async (token: string): Promise<Organisation> => {
  const { data, error } = await supabase.rpc('accept_invitation', { token })

  if (error) {
    throw error
  }

  return data as Organisation
}
