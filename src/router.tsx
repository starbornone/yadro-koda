import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import App from './App'
import { RouteError, RouteNotFound, RoutePending } from '@/components/router/route-fallbacks'
import { authStore } from '@/lib/auth/auth-store'
import { getMyProfile } from '@/lib/supabase/profiles'
import { AuthPage } from './pages/auth-page'

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

// The landing page stays in the main chunk; everything behind the guard is split out so a
// signed-out visitor never downloads the dashboard.
const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  component: lazyRouteComponent(() => import('./pages/dashboard-page'), 'DashboardPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('./pages/profile-page'), 'ProfilePage'),
})

const routeTree = rootRoute.addChildren([
  authRoute,
  authenticatedRoute.addChildren([dashboardRoute, profileRoute]),
])

// Factory so tests can build a router on a memory history; the app uses the default instance.
export const createAppRouter = (options: { history?: RouterHistory } = {}) =>
  createRouter({
    routeTree,
    history: options.history,
    // Fetch a lazy route's chunk when a link to it is hovered or focused.
    defaultPreload: 'intent',
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  })

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
