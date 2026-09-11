import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { updateMyProfile } from '@/lib/supabase/profiles'

export const useProfilePage = () => {
  const router = useRouter()
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (isSaving) return

      setIsSaving(true)
      setError(null)
      setMessage(null)

      try {
        await updateMyProfile(user.id, { display_name: displayName })
        // The `_authenticated` loader owns `profile`; invalidating re-runs it with the new row.
        await router.invalidate()
        setMessage('Profile updated.')
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : 'Failed to update profile.')
      } finally {
        setIsSaving(false)
      }
    },
    [isSaving, router, user.id],
  )

  return {
    user,
    profile,
    isSaving,
    error,
    message,
    updateDisplayName,
  }
}
