import { useState } from 'react'
import type { FormEvent } from 'react'
import { requestPasswordReset } from '@/lib/auth/password-reset'

/** Standalone "send me a reset link" form state, for screens outside the main auth page. */
export const useForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const { error: resetError } = await requestPasswordReset(email)

      if (resetError) {
        setError(resetError.message)
        return
      }

      setMessage('Check your email for a link to reset your password.')
    } finally {
      setLoading(false)
    }
  }

  return { email, setEmail, loading, error, message, handleSubmit }
}
