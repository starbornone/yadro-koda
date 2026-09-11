import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import App from './App'
import { authStore } from '@/lib/auth/auth-store'
import { getMyProfile } from '@/lib/supabase/profiles'
import { AuthPage } from './pages/auth-page'
import { DashboardPage } from './pages/dashboard-page'
import { ProfilePage } from './pages/profile-page'

const DEFAULT_SIGNED_IN_PATH = '/dashboard'

// Only accept same-origin paths as a post-login destination (blocks `?redirect=https://…`).
const isSafeRedirect = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

const rootRoute = createRootRoute({
  component: App,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: isSafeRedirect(search.redirect) ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await authStore.ready()

    if (authStore.getSnapshot().status === 'signed-in') {
      throw redirect({ href: search.redirect ?? DEFAULT_SIGNED_IN_PATH })
    }
  },
  component: AuthPage,
})

// Pathless layout: every route under it requires a session. The guard runs once here instead
// of per-route, and the profile is loaded once for all children.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ location }) => {
    await authStore.ready()
    const auth = authStore.getSnapshot()

    if (auth.status !== 'signed-in') {
      throw redirect({ to: '/', search: { redirect: location.href } })
    }

    return { user: auth.user }
  },
  loader: async ({ context }) => ({
    profile: await getMyProfile(context.user.id),
  }),
  // Profile only changes through this app; refetch on explicit `router.invalidate()`, not on
  // every navigation.
  staleTime: Infinity,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/profile',
  component: ProfilePage,
})

const routeTree = rootRoute.addChildren([
  authRoute,
  authenticatedRoute.addChildren([dashboardRoute, profileRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
