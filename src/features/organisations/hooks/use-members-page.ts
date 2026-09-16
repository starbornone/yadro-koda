import { useCallback, useState } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { appRoute } from '@/lib/auth/app-route'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { assignableOrgRoles, canInOrg, canManageOrgMember } from '@/lib/auth/permissions'
import { removeMember, type OrganisationMember } from '@/lib/supabase/organisations'

const route = getRouteApi('/_authenticated/_app/app/members')

const isActive = (member: OrganisationMember, now = Date.now()) =>
  !member.expires_at || Date.parse(member.expires_at) > now

/**
 * The active organisation's members and open invitations, and what the viewer may do about
 * them. The sections own their writes; this only decides who may press what — and owns the
 * one write that is about the viewer themselves: leaving.
 */
export const useMembersPage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { user } = authenticatedRoute.useRouteContext()
  const { org, role } = appRoute.useLoaderData()
  const { members, invitations } = route.useLoaderData()
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const canManage = canInOrg(role, 'org:manage-members')

  const canManageMember = useCallback(
    (member: OrganisationMember) => canManageOrgMember(role, member.role),
    [role],
  )

  // The database refuses to let the last owner go (protect_last_owner); say so up front
  // instead of after a click.
  const isLastOwner =
    role === 'owner' &&
    members.filter((member) => member.role === 'owner' && isActive(member)).length <= 1

  const leave = useCallback(async () => {
    if (isLeaving || isLastOwner) return

    setIsLeaving(true)
    setLeaveError(null)

    try {
      await removeMember(org.id, user.id)
      // The `_authenticated` loader owns memberships; once refreshed, `_app` resolves another
      // organisation as active, or sends the user to onboarding when none is left.
      await router.invalidate()
      await navigate({ to: '/app' })
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : 'Could not leave the organisation.')
      setIsLeaving(false)
    }
  }, [isLastOwner, isLeaving, navigate, org.id, router, user.id])

  return {
    org,
    role,
    members,
    invitations,
    currentUserId: user.id,
    canManage,
    canManageMember,
    assignableRoles: assignableOrgRoles(role),
    leave: { isLastOwner, isLeaving, error: leaveError, leave },
  }
}
