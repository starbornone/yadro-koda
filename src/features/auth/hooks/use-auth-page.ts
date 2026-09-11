import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '@/lib/supabase/supabase'

type AuthFormState = {
  displayName: string
  email: string
  password: string
}

type AuthView = 'login' | 'sign-up'

// Session state lives in `authStore`; this hook only owns the form. On a successful sign-in the
// store emits, the router re-runs the `/` guard, and that redirects to the destination.
export const useAuthPage = () => {
  const [authView, setAuthView] = useState<AuthView>('login')
  const [formState, setFormState] = useState<AuthFormState>({
    displayName: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    resetFeedback()
    setLoading(true)

    try {
      // `display_name` lands in `auth.users.raw_user_meta_data`; the `on_auth_user_created`
      // trigger copies it into `profiles`.
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

      if (data.user && !data.session) {
        setMessage('Check your email to confirm your account.')
        return
      }

      setMessage('Account created and signed in.')
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
    showLogIn,
    showSignUp,
  }
}
