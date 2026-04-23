import { useCallback, useEffect, useState } from 'react'
import { getAuthSnapshot } from '@/lib/supabase/auth'
import { updateMyProfile, type Profile } from '@/lib/supabase/profiles'
import { supabase } from '@/lib/supabase/supabase'

type ProfileState = {
  isLoading: boolean
  isSaving: boolean
  isAuthenticated: boolean
  userId: string | null
  profile: Profile | null
  error: string | null
  message: string | null
}

const initialState: ProfileState = {
  isLoading: true,
  isSaving: false,
  isAuthenticated: false,
  userId: null,
  profile: null,
  error: null,
  message: null,
}

export const useProfilePage = () => {
  const [state, setState] = useState<ProfileState>(initialState)

  const refreshProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const { user, profile } = await getAuthSnapshot()
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
        profile,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        userId: null,
        profile: null,
        error: error instanceof Error ? error.message : 'Failed to load profile.',
      }))
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!isMounted) return
      await refreshProfile()
    }

    void load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return
      void refreshProfile()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [refreshProfile])

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (state.isSaving) return

      setState((prev) => ({ ...prev, isSaving: true, error: null, message: null }))

      try {
        const profile = await updateMyProfile({ display_name: displayName })
        setState((prev) => ({
          ...prev,
          isSaving: false,
          profile,
          message: 'Profile updated.',
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: error instanceof Error ? error.message : 'Failed to update profile.',
        }))
      }
    },
    [state.isSaving],
  )

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isSaving: true, error: null, message: null }))

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setState((prev) => ({ ...prev, isSaving: false, error: error.message }))
        return
      }

      setState({
        ...initialState,
        isLoading: false,
        message: 'Signed out.',
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to sign out.',
      }))
    }
  }, [])

  return {
    ...state,
    refreshProfile,
    updateDisplayName,
    signOut,
  }
}
