import { authStore } from './auth-store'

type InvalidatableRouter = {
  invalidate: () => Promise<void>
}

/**
 * Re-runs route guards whenever the signed-in user changes (sign-in, sign-out, session expiry,
 * another tab). `beforeLoad` redirects take it from there, so pages never navigate themselves.
 * Returns a cleanup function.
 */
export const syncRouterWithAuth = (router: InvalidatableRouter) => {
  let cancelled = false
  let unsubscribe: (() => void) | undefined

  void authStore.ready().then(() => {
    if (cancelled) return

    let userId = authStore.getSnapshot().user?.id ?? null

    unsubscribe = authStore.subscribe(() => {
      const nextUserId = authStore.getSnapshot().user?.id ?? null
      if (nextUserId === userId) return

      userId = nextUserId
      void router.invalidate()
    })
  })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
