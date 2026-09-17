import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { appRoute } from '@/lib/auth/app-route'
import { canInOrg } from '@/lib/auth/permissions'
import { updateOrganisation } from '@/lib/supabase/organisations'

export const useOrgSettingsPage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { org, role } = appRoute.useLoaderData()
  const [name, setName] = useState(org.name)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const canEdit = canInOrg(role, 'org:update')
  const canDelete = canInOrg(role, 'org:delete')
  const isDirty = name.trim() !== org.name

  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isSaving || !isDirty || !canEdit) return

      setIsSaving(true)
      setError(null)
      setMessage(null)

      try {
        const updated = await updateOrganisation(org.id, { name })
        setName(updated?.name ?? name.trim())
        // The `_app` loader owns `org`; invalidating refreshes the switcher and everything else.
        await router.invalidate()
        setMessage('Organisation updated.')
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : 'Failed to update the organisation.',
        )
      } finally {
        setIsSaving(false)
      }
    },
    [canEdit, isDirty, isSaving, name, org.id, router],
  )

  // Once the organisation is gone, refreshing the `_authenticated` loader lets `_app` settle on
  // another organisation — or send the user to onboarding — before the dashboard opens.
  const afterDelete = useCallback(async () => {
    await router.invalidate()
    await navigate({ to: '/app' })
  }, [navigate, router])

  return {
    org,
    role,
    canEdit,
    canDelete,
    name,
    setName,
    isDirty,
    isSaving,
    error,
    message,
    handleSave,
    afterDelete,
  }
}
