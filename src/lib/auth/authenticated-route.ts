import { getRouteApi } from '@tanstack/react-router'

/**
 * Typed accessors for the `_authenticated` layout route: `useRouteContext()` gives the
 * signed-in `user`, `useLoaderData()` gives their `profile` and `memberships`. Kept separate
 * from `router.tsx` so page hooks can use it without an import cycle.
 */
export const authenticatedRoute = getRouteApi('/_authenticated')
