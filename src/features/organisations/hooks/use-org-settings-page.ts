import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { appRoute } from '@/lib/auth/app-route'
import { canInOrg } from '@/lib/auth/permissions'
import { updateOrganisation } from '@/lib/supabase/organisations'

export const useOrgSettingsPage = () => {
  const router = useRouter()
  const { org, role } = appRoute.useLoaderData()
  const [name, setName] = useState(org.name)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const canEdit = canInOrg(role, 'org:update')
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

  return { org, role, canEdit, name, setName, isDirty, isSaving, error, message, handleSave }
}
