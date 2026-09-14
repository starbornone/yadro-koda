import { useCallback, useState } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { canOnPlatform } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import {
  removePlatformMember,
  updatePlatformMemberRole,
  type PlatformRole,
} from '@/lib/supabase/platform'

const route = getRouteApi('/_authenticated/_staff/staff/team')

export const useStaffTeamPage = () => {
  const router = useRouter()
  const { user } = authenticatedRoute.useRouteContext()
  const { platformRole } = staffRoute.useLoaderData()
  const members = route.useLoaderData()
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canManage = canOnPlatform(platformRole, 'platform:manage-team')

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
    currentUserId: user.id,
    canManage,
    busyUserId,
    error,
    changeRole,
    remove,
  }
}
