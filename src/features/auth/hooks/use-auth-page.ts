import { useState } from 'react'
import type { FormEvent } from 'react'
import { requestPasswordReset } from '@/lib/auth/password-reset'
import { supabase } from '@/lib/supabase/supabase'

type AuthFormState = {
  displayName: string
  email: string
  password: string
}

export type AuthView = 'login' | 'sign-up' | 'forgot-password'

// Session state lives in `authStore`; this hook only owns the form. On a successful sign-in the
// store emits, the router re-runs the `/` guard, and that redirects to the destination.
export const useAuthPage = (initialView: AuthView = 'login') => {
  const [authView, setAuthView] = useState<AuthView>(initialView)
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

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    resetFeedback()
    setLoading(true)

    try {
      const { error: resetError } = await requestPasswordReset(formState.email)

      if (resetError) {
        setError(resetError.message)
        return
      }

      setMessage('Check your email for a link to reset your password.')
    } finally {
      setLoading(false)
    }
  }

  const showView = (view: AuthView) => {
    resetFeedback()
    setAuthView(view)
  }

  const showLogIn = () => showView('login')
  const showSignUp = () => showView('sign-up')
  const showForgotPassword = () => showView('forgot-password')

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
    handleForgotPassword,
    showLogIn,
    showSignUp,
    showForgotPassword,
  }
}
