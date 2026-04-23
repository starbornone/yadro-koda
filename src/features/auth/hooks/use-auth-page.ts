import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/profiles'
import { getMyProfile, upsertProfileFromUser } from '@/lib/supabase/profiles'
import { supabase } from '@/lib/supabase/supabase'

type AuthFormState = {
  displayName: string
  email: string
  password: string
}

type AuthView = 'login' | 'sign-up'

export const useAuthPage = () => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [formState, setFormState] = useState<AuthFormState>({
    displayName: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const nextProfile = await getMyProfile()
        if (active) {
          setProfile(nextProfile)
        }
      } catch (loadError) {
        if (active && loadError instanceof Error) {
          setError(loadError.message)
        }
      }
    }

    const syncProfile = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }

      const { error: upsertError } = await upsertProfileFromUser(nextSession.user)
      if (upsertError && active) {
        setError(upsertError.message)
        return
      }

      await loadProfile()
    }

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      await syncProfile(currentSession)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncProfile(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null

  const resetFeedback = () => {
    setError(null)
    setMessage(null)
  }

  const setDisplayName = (displayName: string) => {
    setFormState((prev) => ({ ...prev, displayName }))
  }

  const setEmail = (email: string) => {
    setFormState((prev) => ({ ...prev, email }))
  }

  const setPassword = (password: string) => {
    setFormState((prev) => ({ ...prev, password }))
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    resetFeedback()
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formState.email.trim(),
        password: formState.password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      setMessage('Signed in.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (loading) return

    resetFeedback()
    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formState.email.trim(),
        password: formState.password,
        options: {
          data: {
            display_name: formState.displayName.trim() || undefined,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.user) {
        const { error: profileError } = await upsertProfileFromUser(
          data.user,
          formState.displayName,
        )
        if (profileError) {
          setError(profileError.message)
          return
        }
      }

      if (data.user && !data.session) {
        setMessage('Check your email to confirm your account.')
        return
      }

      setMessage('Account created and signed in.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    if (loading) return

    resetFeedback()
    setLoading(true)

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError(signOutError.message)
        return
      }

      setMessage('Signed out.')
    } finally {
      setLoading(false)
    }
  }

  const showLogIn = () => {
    setAuthView('login')
  }

  const showSignUp = () => {
    setAuthView('sign-up')
  }

  return {
    user,
    profile,
    authView,
    loading,
    error,
    message,
    formState,
    setDisplayName,
    setEmail,
    setPassword,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    showLogIn,
    showSignUp,
  }
}
