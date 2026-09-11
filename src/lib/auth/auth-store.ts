import { useSyncExternalStore } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/supabase'

export type AuthState =
  | { status: 'loading'; session: null; user: null }
  | { status: 'signed-out'; session: null; user: null }
  | {
      status: 'signed-in'
      session: Session
      user: User
      /**
       * True after arriving via a password-reset link, until `updateUser` succeeds. Routes use it
       * to keep the user on `/reset-password`. In-memory only: a fresh page load starts false.
       */
      passwordRecovery: boolean
    }

const LOADING: AuthState = { status: 'loading', session: null, user: null }
const SIGNED_OUT: AuthState = { status: 'signed-out', session: null, user: null }

let state: AuthState = LOADING
let readyPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

const isSameState = (a: AuthState, b: AuthState) =>
  a.status === b.status &&
  a.session?.access_token === b.session?.access_token &&
  (a.status !== 'signed-in' ||
    b.status !== 'signed-in' ||
    a.passwordRecovery === b.passwordRecovery)

const handleAuthEvent = (event: AuthChangeEvent, session: Session | null) => {
  let next: AuthState

  if (!session) {
    next = SIGNED_OUT
  } else {
    const passwordRecovery =
      event === 'PASSWORD_RECOVERY'
        ? true
        : event === 'USER_UPDATED'
          ? false
          : state.status === 'signed-in' && state.passwordRecovery
    next = { status: 'signed-in', session, user: session.user, passwordRecovery }
  }

  // Supabase re-emits SIGNED_IN on tab focus with an unchanged session; skip the no-op.
  if (isSameState(state, next)) return

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

  /**
   * Resolves once the persisted session (if any) has been restored. Idempotent. Without a
   * configured Supabase project there is nothing to restore: the store reports signed-out so
   * public pages still render.
   */
  ready(): Promise<void> {
    readyPromise ??= new Promise<void>((resolve) => {
      if (!isSupabaseConfigured) {
        handleAuthEvent('INITIAL_SESSION', null)
        resolve()
        return
      }

      supabase.auth.onAuthStateChange((event, session) => {
        // Keep this callback synchronous: supabase-js holds its auth lock while notifying
        // subscribers, so awaiting another Supabase call in here can deadlock.
        handleAuthEvent(event, session)
        if (event === 'INITIAL_SESSION') resolve()
      })
    })

    return readyPromise
  },
}

export const useAuth = () => useSyncExternalStore(authStore.subscribe, authStore.getSnapshot)
