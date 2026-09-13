import { getRouteApi } from '@tanstack/react-router'

/**
 * Typed accessors for the `_app` layout route: `useLoaderData()` gives the active `org`, the
 * caller's `role` in it, and all their `memberships`. Kept separate from `router.tsx` so
 * pages and hooks can use it without an import cycle.
 */
export const appRoute = getRouteApi('/_authenticated/_app')
