import { getRouteApi } from '@tanstack/react-router'

/**
 * Typed accessors for the `_staff` layout route: `useLoaderData()` gives the caller's
 * `platformRole` and whether they also belong to any organisation. Kept separate from
 * `router.tsx` so pages and hooks can use it without an import cycle.
 */
export const staffRoute = getRouteApi('/_authenticated/_staff')
