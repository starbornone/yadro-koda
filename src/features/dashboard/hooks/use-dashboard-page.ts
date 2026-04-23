import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getAuthSnapshot } from '@/lib/supabase/auth'
import type { Profile } from '@/lib/supabase/profiles'
import { supabase } from '@/lib/supabase/supabase'

type DashboardState = {
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  userId: string | null
  user: User | null
  profile: Profile | null
}

const initialState: DashboardState = {
  isLoading: true,
  error: null,
  isAuthenticated: false,
  userId: null,
  user: null,
  profile: null,
}

export const useDashboardPage = () => {
  const [state, setState] = useState<DashboardState>(initialState)

  const refreshDashboard = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const { user, profile } = await getAuthSnapshot()
      setState({
        isLoading: false,
        error: null,
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
        user,
        profile,
      })
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data.',
        isAuthenticated: false,
        userId: null,
        user: null,
        profile: null,
      })
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!isMounted) return
      await refreshDashboard()
    }

    void load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return
      void refreshDashboard()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [refreshDashboard])

  return {
    ...state,
    refreshDashboard,
  }
}
