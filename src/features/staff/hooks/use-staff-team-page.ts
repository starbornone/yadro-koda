import { useCallback, useState } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import {
  assignablePlatformRoles,
  canManagePlatformMember,
  canOnPlatform,
} from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import {
  removePlatformMember,
  updatePlatformMemberRole,
  type PlatformMember,
  type PlatformRole,
} from '@/lib/supabase/platform'

const route = getRouteApi('/_authenticated/_staff/staff/team')

export const useStaffTeamPage = () => {
  const router = useRouter()
  const { user } = authenticatedRoute.useRouteContext()
  const { platformRole } = staffRoute.useLoaderData()
  const { members, invitations } = route.useLoaderData()
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canManage = canOnPlatform(platformRole, 'platform:manage-team')

  /** Whether the current user may change or remove this row — never their own. */
  const canManageMember = useCallback(
    (member: PlatformMember) =>
      member.user_id !== user.id && canManagePlatformMember(platformRole, member.role),
    [platformRole, user.id],
  )

  const run = useCallback(
    async (userId: string, action: () => Promise<void>) => {
      if (busyUserId) return

      setBusyUserId(userId)
      setError(null)

      try {
        await action()
        // The route loader owns the list; invalidating refreshes it (and our own role).
        await router.invalidate()
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Something went wrong.')
      } finally {
        setBusyUserId(null)
      }
    },
    [busyUserId, router],
  )

  const changeRole = useCallback(
    (userId: string, role: PlatformRole) =>
      run(userId, () => updatePlatformMemberRole(userId, role)),
    [run],
  )

  const remove = useCallback(
    (userId: string) => run(userId, () => removePlatformMember(userId)),
    [run],
  )

  return {
    members,
    invitations,
    currentUserId: user.id,
    canManage,
    canManageMember,
    assignableRoles: assignablePlatformRoles(platformRole),
    busyUserId,
    error,
    changeRole,
    remove,
  }
}
