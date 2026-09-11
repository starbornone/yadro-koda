import { useSyncExternalStore } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/supabase'

export type AuthState =
  | { status: 'loading'; session: null; user: null }
  | { status: 'signed-out'; session: null; user: null }
  | { status: 'signed-in'; session: Session; user: User }

const LOADING: AuthState = { status: 'loading', session: null, user: null }
const SIGNED_OUT: AuthState = { status: 'signed-out', session: null, user: null }

let state: AuthState = LOADING
let readyPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

const setSession = (session: Session | null) => {
  const next: AuthState = session
    ? { status: 'signed-in', session, user: session.user }
    : SIGNED_OUT

  // Supabase re-emits SIGNED_IN on tab focus with an unchanged session; skip the no-op.
  if (next.status === state.status && next.session?.access_token === state.session?.access_token) {
    return
  }

  state = next
  for (const listener of listeners) listener()
}

/**
 * Single source of truth for the Supabase session. One `onAuthStateChange` subscription for
 * the whole app; everything else reads the snapshot or subscribes to it.
 */
export const authStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): AuthState {
    return state
  },

  /** Resolves once the persisted session (if any) has been restored. Idempotent. */
  ready(): Promise<void> {
    readyPromise ??= new Promise<void>((resolve) => {
      supabase.auth.onAuthStateChange((event, session) => {
        // Keep this callback synchronous: supabase-js holds its auth lock while notifying
        // subscribers, so awaiting another Supabase call in here can deadlock.
        setSession(session)
        if (event === 'INITIAL_SESSION') resolve()
      })
    })

    return readyPromise
  },
}

export const useAuth = () => useSyncExternalStore(authStore.subscribe, authStore.getSnapshot)
