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

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

// --- Platform layer ---------------------------------------------------------

export type PlatformAction = 'platform:view-organisations' | 'platform:manage-team'

const PLATFORM_PERMISSIONS: Record<PlatformAction, readonly PlatformRole[]> = {
  'platform:view-organisations': ['admin', 'support'],
  'platform:manage-team': ['admin'],
}

export const canOnPlatform = (role: PlatformRole, action: PlatformAction) =>
  PLATFORM_PERMISSIONS[action].includes(role)

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  admin: 'Admin',
  support: 'Support',
}
