import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'

// No navigation here: the auth store emits SIGNED_OUT, the router re-runs the `_authenticated`
// guard, and that redirects to `/`.
export const useSignOut = () => {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signOut = useCallback(async () => {
    if (isSigningOut) return

    setError(null)
    setIsSigningOut(true)

    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(signOutError.message)
      setIsSigningOut(false)
    }
  }, [isSigningOut])

  return { signOut, isSigningOut, error }
}
