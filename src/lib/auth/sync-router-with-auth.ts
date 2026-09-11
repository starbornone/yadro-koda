import { authStore, type AuthState } from './auth-store'

type InvalidatableRouter = {
  invalidate: () => Promise<void>
}

// What the guards care about: who is signed in, and whether they must reset their password.
const identityOf = (auth: AuthState) =>
  auth.status === 'signed-in'
    ? `${auth.user.id}:${auth.passwordRecovery ? 'recovery' : 'normal'}`
    : null

/**
 * Re-runs route guards whenever the signed-in identity changes (sign-in, sign-out, session
 * expiry, another tab, entering or leaving password recovery). `beforeLoad` redirects take it
 * from there, so pages never navigate themselves. Returns a cleanup function.
 */
export const syncRouterWithAuth = (router: InvalidatableRouter) => {
  let cancelled = false
  let unsubscribe: (() => void) | undefined

  void authStore.ready().then(() => {
    if (cancelled) return

    let identity = identityOf(authStore.getSnapshot())

    unsubscribe = authStore.subscribe(() => {
      const nextIdentity = identityOf(authStore.getSnapshot())
      if (nextIdentity === identity) return

      identity = nextIdentity
      void router.invalidate()
    })
  })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
