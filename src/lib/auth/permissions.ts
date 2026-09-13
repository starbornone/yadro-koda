import type { OrgRole } from '@/lib/supabase/organisations'

/**
 * What each tenant role may do in the UI. The database enforces the same rules through RLS —
 * this only decides what to show; it never grants anything.
 */
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
