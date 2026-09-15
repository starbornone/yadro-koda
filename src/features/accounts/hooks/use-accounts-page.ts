import { useState } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { setActiveOrganisation } from '@/lib/supabase/organisations'

const route = getRouteApi('/_authenticated/accounts')

/**
 * One person can be staff and belong to organisations. This picks where to go: an organisation
 * (remembered as the active one) or the staff area.
 */
export const useAccountsPage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()
  const { memberships, platformRole } = route.useLoaderData()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chooseOrganisation = async (orgId: string) => {
    if (busyId) return

    setBusyId(orgId)
    setError(null)

    try {
      if (profile?.active_org_id !== orgId) {
        await setActiveOrganisation(user.id, orgId)
        await router.invalidate()
      }
      await navigate({ to: '/app' })
    } catch (chooseError) {
      setError(chooseError instanceof Error ? chooseError.message : 'Could not open that account.')
      setBusyId(null)
    }
  }

  const chooseStaff = () => {
    if (busyId) return
    setBusyId('staff')
    void navigate({ to: '/staff' })
  }

  return { memberships, platformRole, busyId, error, chooseOrganisation, chooseStaff }
}
