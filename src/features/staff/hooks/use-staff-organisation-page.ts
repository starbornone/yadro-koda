import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { ORG_ROLES, canOnPlatform } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import { updateOrganisation } from '@/lib/supabase/organisations'

const route = getRouteApi('/_authenticated/_staff/staff/organisations/$orgId')

/**
 * The customer record: the organisation, its CRM data and who may do what. Each section owns
 * its own writes (`useRouteAction`); renaming the organisation is tenant data and stays here.
 */
export const useStaffOrganisationPage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { user } = authenticatedRoute.useRouteContext()
  const { platformRole } = staffRoute.useLoaderData()
  const { organisation, customer, contacts, activities, tasks, staff, invitations } =
    route.useLoaderData()
  const [name, setName] = useState(organisation.name)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Only the full-access tier writes tenant data — the name, and who belongs (roles,
  // removals, invitations). RLS enforces the same via platform_can_manage_org().
  const canManageOrganisation = canOnPlatform(platformRole, 'platform:manage-organisations')
  const isDirty = name.trim() !== organisation.name

  const handleRename = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isSaving || !isDirty || !canManageOrganisation) return

      setIsSaving(true)
      setError(null)
      setMessage(null)

      try {
        const updated = await updateOrganisation(organisation.id, { name })
        setName(updated?.name ?? name.trim())
        await router.invalidate()
        setMessage('Organisation renamed.')
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : 'Failed to rename.')
      } finally {
        setIsSaving(false)
      }
    },
    [canManageOrganisation, isDirty, isSaving, name, organisation.id, router],
  )

  // Leave the record before refreshing: its loader would report the organisation missing.
  // The list fetches fresh on arrival; the invalidate is for `_authenticated` (the viewer may
  // have been a member too).
  const afterDelete = useCallback(async () => {
    await navigate({ to: '/staff/organisations' })
    await router.invalidate()
  }, [navigate, router])

  return {
    organisation,
    customer,
    contacts,
    activities,
    tasks,
    staff,
    invitations,
    currentUserId: user.id,
    canRename: canManageOrganisation,
    canDelete: canManageOrganisation,
    afterDelete,
    // Staff who may write for the tenant act as an owner would: any member, any role.
    canManageMember: () => canManageOrganisation,
    assignableRoles: canManageOrganisation ? ORG_ROLES : [],
    canManageCustomers: canOnPlatform(platformRole, 'platform:manage-customers'),
    canLogActivity: canOnPlatform(platformRole, 'platform:log-activity'),
    rename: { name, setName, isDirty, isSaving, error, message, handleRename },
  }
}
