import { useCallback } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { appRoute } from '@/lib/auth/app-route'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { assignableOrgRoles, canInOrg, canManageOrgMember } from '@/lib/auth/permissions'
import type { OrganisationMember } from '@/lib/supabase/organisations'

const route = getRouteApi('/_authenticated/_app/app/members')

/**
 * The active organisation's members and open invitations, and what the viewer may do about
 * them. The sections own their writes; this only decides who may press what.
 */
export const useMembersPage = () => {
  const { user } = authenticatedRoute.useRouteContext()
  const { org, role } = appRoute.useLoaderData()
  const { members, invitations } = route.useLoaderData()

  const canManage = canInOrg(role, 'org:manage-members')

  const canManageMember = useCallback(
    (member: OrganisationMember) => canManageOrgMember(role, member.role),
    [role],
  )

  return {
    org,
    role,
    members,
    invitations,
    currentUserId: user.id,
    canManage,
    canManageMember,
    assignableRoles: assignableOrgRoles(role),
  }
}
