import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '@/lib/supabase/supabase'

/**
 * New-password + confirmation form state around `updateUser({ password })`. Used by the reset
 * page (recovery session) and the profile page (normal session). On success the fields are
 * cleared and `isDone` is set until the user edits again.
 */
export const usePasswordUpdate = () => {
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPasswordValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const setPassword = (value: string) => {
    setPasswordValue(value)
    setIsDone(false)
  }

  const setConfirmPassword = (value: string) => {
    setConfirmPasswordValue(value)
    setIsDone(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setError(null)
    setIsDone(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setPasswordValue('')
      setConfirmPasswordValue('')
      setIsDone(true)
    } finally {
      setLoading(false)
    }
  }

  return {
    password,
    confirmPassword,
    loading,
    error,
    isDone,
    setPassword,
    setConfirmPassword,
    handleSubmit,
  }
}
