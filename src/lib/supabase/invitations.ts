import type { OrgRole, Organisation } from './organisations'
import type { PlatformRole } from './platform'
import { supabase } from './supabase'

/**
 * Invitations: how people join an organisation that already exists, or the staff team. A
 * manager creates one for an email and a role, passes on the link the app builds from its
 * token, and whoever signs in with that email and opens the link joins (`accept_invitation()`
 * / `accept_platform_invitation()`). The invitee reads theirs through `get_invitation()`,
 * which works before they have signed in and says which kind the link is.
 *
 * Organisation invitations are managed here; the staff team's are in `platform.ts` alongside
 * the rest of the team. Both kinds share the link and the accept screen.
 */

export type Invitation = {
  id: string
  org_id: string
  email: string
  role: OrgRole
  /** The link secret. Only readable by people who may send the link. */
  token: string
  invited_by: string | null
  /** When the link stops working. */
  expires_at: string
  /** When the membership it creates stops working; null for no expiry. */
  access_expires_at: string | null
  accepted_at: string | null
  created_at: string
}

type InvitationPreviewBase = {
  email: string
  invited_by_name: string | null
  expires_at: string
  /** Organisation invitations only: when the access being offered ends. */
  access_expires_at: string | null
  accepted_at: string | null
}

/** What `get_invitation()` tells the person holding the link: which kind it is, and its facts. */
export type InvitationPreview =
  | (InvitationPreviewBase & { kind: 'organisation'; organisation_name: string; role: OrgRole })
  | (InvitationPreviewBase & { kind: 'platform'; organisation_name: null; role: PlatformRole })

export type InvitationStatus = 'pending' | 'expired' | 'accepted'

export const invitationStatus = (
  invitation: { expires_at: string; accepted_at?: string | null },
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
  'id, org_id, email, role, token, invited_by, expires_at, access_expires_at, accepted_at, created_at'

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
  /** Time-boxed access: when the membership should end. Omit or null for no expiry. */
  access_expires_at?: string | null
}

/** Invites an email address to the organisation. Returns the row, token included, for the link. */
export const createInvitation = async (
  orgId: string,
  input: CreateInvitationInput,
): Promise<Invitation> => {
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      org_id: orgId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      access_expires_at: input.access_expires_at ?? null,
    })
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

/** Joins the staff team as the invited role. */
export const acceptPlatformInvitation = async (token: string): Promise<void> => {
  const { error } = await supabase.rpc('accept_platform_invitation', { token })

  if (error) {
    throw error
  }
}
