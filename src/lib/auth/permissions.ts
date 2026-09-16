import type { OrgRole } from '@/lib/supabase/organisations'
import type { PlatformRole } from '@/lib/supabase/platform'

/**
 * What each role may do in the UI, for both layers. The database enforces the same rules
 * through RLS — this only decides what to show; it never grants anything.
 */

// --- Tenant layer -----------------------------------------------------------

export type OrgAction = 'org:update' | 'org:manage-members' | 'org:delete'

const ORG_PERMISSIONS: Record<OrgAction, readonly OrgRole[]> = {
  'org:update': ['owner', 'admin'],
  'org:manage-members': ['owner', 'admin'],
  'org:delete': ['owner'],
}

export const canInOrg = (role: OrgRole, action: OrgAction) => ORG_PERMISSIONS[action].includes(role)

/** Highest first. Mirrors the `org_role` enum and `can_manage_org_member()`. */
export const ORG_ROLES: readonly OrgRole[] = ['owner', 'admin', 'member']

/** Owners manage anyone; admins manage anyone below owner; members manage nobody. */
export const canManageOrgMember = (actor: OrgRole, target: OrgRole) =>
  actor === 'owner' || (actor === 'admin' && target !== 'owner')

/** The roles an actor may assign or invite: never above their own tier. */
export const assignableOrgRoles = (actor: OrgRole): readonly OrgRole[] =>
  canInOrg(actor, 'org:manage-members') ? ORG_ROLES.slice(ORG_ROLES.indexOf(actor)) : []

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

// --- Platform layer ---------------------------------------------------------

/** Highest first. Mirrors the `platform_role` enum and `platform_can_manage_member()`. */
export const PLATFORM_ROLES: readonly PlatformRole[] = ['superadmin', 'admin', 'support']

export type PlatformAction =
  | 'platform:view-organisations'
  | 'platform:manage-organisations'
  | 'platform:manage-customers'
  | 'platform:log-activity'
  | 'platform:manage-team'

// `manage-organisations` is writing tenant data on a tenant's behalf (platform_can_manage_org);
// `manage-customers` is moving the CRM pipeline — stage, owner, new leads
// (platform_can_manage_customers); `log-activity` is contacts, notes and tasks.
const PLATFORM_PERMISSIONS: Record<PlatformAction, readonly PlatformRole[]> = {
  'platform:view-organisations': ['superadmin', 'admin', 'support'],
  'platform:manage-organisations': ['superadmin'],
  'platform:manage-customers': ['superadmin', 'admin'],
  'platform:log-activity': ['superadmin', 'admin', 'support'],
  'platform:manage-team': ['superadmin', 'admin'],
}

export const canOnPlatform = (role: PlatformRole, action: PlatformAction) =>
  PLATFORM_PERMISSIONS[action].includes(role)

const tierOf = (role: PlatformRole) => PLATFORM_ROLES.indexOf(role)

/** Superadmins manage anyone; admins manage anyone below superadmin; support manages nobody. */
export const canManagePlatformMember = (actor: PlatformRole, target: PlatformRole) =>
  actor === 'superadmin' || (actor === 'admin' && target !== 'superadmin')

/** The roles an actor may assign: never above their own tier. */
export const assignablePlatformRoles = (actor: PlatformRole): readonly PlatformRole[] =>
  canOnPlatform(actor, 'platform:manage-team') ? PLATFORM_ROLES.slice(tierOf(actor)) : []

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  support: 'Support',
}
