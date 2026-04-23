import { useCallback, useEffect, useState } from 'react'
import { getAuthSnapshot } from '@/lib/supabase/auth'
import { upsertProfileFromUser } from '@/lib/supabase/profiles'
import { supabase } from '@/lib/supabase/supabase'

type SignUpFormState = {
  displayName: string
  email: string
  password: string
}

const initialFormState: SignUpFormState = {
  displayName: '',
  email: '',
  password: '',
}

export const useSignUpPage = () => {
  const [formState, setFormState] = useState<SignUpFormState>(initialFormState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const setDisplayName = useCallback((displayName: string) => {
    setFormState((prev) => ({ ...prev, displayName }))
  }, [])

  const setEmail = useCallback((email: string) => {
    setFormState((prev) => ({ ...prev, email }))
  }, [])

  const setPassword = useCallback((password: string) => {
    setFormState((prev) => ({ ...prev, password }))
  }, [])

  const refreshAuthState = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { user } = await getAuthSnapshot()
      setIsAuthenticated(Boolean(user))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load auth state.')
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!isMounted) return
      await refreshAuthState()
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [refreshAuthState])

  const submitSignUp = useCallback(async () => {
    if (isSubmitting) return

    setError(null)
    setMessage(null)
    setIsSubmitting(true)

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

      setIsAuthenticated(true)
      setMessage('Account created and signed in.')
    } finally {
      setIsSubmitting(false)
    }
  }, [formState.displayName, formState.email, formState.password, isSubmitting])

  return {
    formState,
    isLoading,
    isSubmitting,
    isAuthenticated,
    error,
    message,
    setDisplayName,
    setEmail,
    setPassword,
    refreshAuthState,
    submitSignUp,
  }
}
