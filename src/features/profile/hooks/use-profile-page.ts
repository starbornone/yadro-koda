import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { usePasswordUpdate } from '@/features/auth/hooks/use-password-update'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { updateMyProfile, type Profile } from '@/lib/supabase/profiles'

type ProfileFormState = {
  displayName: string
  phone: string
}

const formFromProfile = (profile: Profile | null): ProfileFormState => ({
  displayName: profile?.display_name ?? '',
  phone: profile?.phone ?? '',
})

export const useProfilePage = () => {
  const router = useRouter()
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()
  const [form, setForm] = useState<ProfileFormState>(() => formFromProfile(profile))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { signOut, isSigningOut, error: signOutError } = useSignOut()
  const passwordForm = usePasswordUpdate()

  const saved = formFromProfile(profile)
  const isDirty = form.displayName.trim() !== saved.displayName || form.phone.trim() !== saved.phone

  const setDisplayName = (displayName: string) => {
    setForm((prev) => ({ ...prev, displayName }))
  }

  const setPhone = (phone: string) => {
    setForm((prev) => ({ ...prev, phone }))
  }

  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isSaving || !isDirty) return

      setIsSaving(true)
      setError(null)
      setMessage(null)

      try {
        const updated = await updateMyProfile(user.id, {
          display_name: form.displayName,
          phone: form.phone,
        })
        // Show exactly what was stored (trimmed, blanks nulled), and refresh the loader so the
        // rest of the shell picks up the new name.
        setForm(formFromProfile(updated))
        await router.invalidate()
        setMessage('Profile updated.')
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : 'Failed to update profile.')
      } finally {
        setIsSaving(false)
      }
    },
    [form.displayName, form.phone, isDirty, isSaving, router, user.id],
  )

  return {
    user,
    profile,
    form,
    isDirty,
    isSaving,
    error,
    message,
    setDisplayName,
    setPhone,
    handleSave,
    passwordForm,
    signOut,
    isSigningOut,
    signOutError,
  }
}
