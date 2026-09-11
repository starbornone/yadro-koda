import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import App from './App'
import { PublicLayout } from '@/components/layout/public-layout'
import { RouteError, RouteNotFound, RoutePending } from '@/components/router/route-fallbacks'
import { authStore } from '@/lib/auth/auth-store'
import { readResetLinkError } from '@/lib/auth/password-reset'
import { getMyProfile } from '@/lib/supabase/profiles'
import { homeContent } from '@/features/marketing/content'
import { HomePage } from './pages/home-page'

const DEFAULT_SIGNED_IN_PATH = '/dashboard'

// Only accept same-origin paths as a post-login destination (blocks `?redirect=https://…`).
const isSafeRedirect = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

const validateRedirectSearch = (search: Record<string, unknown>): { redirect?: string } => ({
  redirect: isSafeRedirect(search.redirect) ? search.redirect : undefined,
})

// Login and sign-up are for signed-out visitors; a session goes where it was headed, or to
// the reset page if it is a password-recovery session.
const redirectSignedInAway = async ({ search }: { search: { redirect?: string } }) => {
  await authStore.ready()
  const auth = authStore.getSnapshot()

  if (auth.status === 'signed-in') {
    throw auth.passwordRecovery
      ? redirect({ to: '/reset-password' })
      : redirect({ href: search.redirect ?? DEFAULT_SIGNED_IN_PATH })
  }
}

const rootRoute = createRootRoute({
  component: App,
})

// ---------------------------------------------------------------------------
// Public (marketing) site
// ---------------------------------------------------------------------------

// Pathless layout: header, footer, and a resolved session so the header can show the right
// call to action on first render. Signed-in visitors are welcome here.
const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_public',
  beforeLoad: () => authStore.ready(),
  component: PublicLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/',
  head: () => ({
    meta: [
      { title: homeContent.meta.title },
      { name: 'description', content: homeContent.meta.description },
    ],
  }),
  component: HomePage,
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateRedirectSearch,
  beforeLoad: redirectSignedInAway,
  head: () => ({ meta: [{ title: 'Sign in' }] }),
  component: lazyRouteComponent(() => import('./pages/auth-page'), 'AuthPage'),
})

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: validateRedirectSearch,
  beforeLoad: redirectSignedInAway,
  head: () => ({ meta: [{ title: 'Create your account' }] }),
  component: lazyRouteComponent(() => import('./pages/auth-page'), 'SignUpPage'),
})

// Landing page for the email link. Supabase's redirect either carries a session (consumed by
// the client before `ready()` resolves) or error params when the link is bad.
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  validateSearch: (
    search: Record<string, unknown>,
  ): { error_code?: string; error_description?: string } => ({
    error_code: typeof search.error_code === 'string' ? search.error_code : undefined,
    error_description:
      typeof search.error_description === 'string' ? search.error_description : undefined,
  }),
  beforeLoad: async ({ location, search }) => {
    await authStore.ready()
    const linkError = readResetLinkError(search, location.hash)

    if (authStore.getSnapshot().status !== 'signed-in') {
      if (!linkError) throw redirect({ to: '/login' })
      return { linkError }
    }

    return { linkError: null }
  },
  head: () => ({ meta: [{ title: 'Reset your password' }] }),
  component: lazyRouteComponent(() => import('./pages/reset-password-page'), 'ResetPasswordPage'),
})

// ---------------------------------------------------------------------------
// App (requires a session)
// ---------------------------------------------------------------------------

// Pathless layout: every route under it requires a session. The guard runs once here instead
// of per-route, and the profile is loaded once for all children.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ location }) => {
    await authStore.ready()
    const auth = authStore.getSnapshot()

    if (auth.status !== 'signed-in') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    // A recovery session may only be used to set a new password.
    if (auth.passwordRecovery) {
      throw redirect({ to: '/reset-password' })
    }

    return { user: auth.user }
  },
  loader: async ({ context }) => ({
    profile: await getMyProfile(context.user.id),
  }),
  // Profile only changes through this app; refetch on explicit `router.invalidate()`, not on
  // every navigation.
  staleTime: Infinity,
  // The marketing page stays in the main chunk; everything behind the guard (including the
  // shell) is split out so a visitor never downloads the dashboard.
  component: lazyRouteComponent(() => import('@/components/layout/app-shell'), 'AppShell'),
})

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  head: () => ({ meta: [{ title: 'Dashboard' }] }),
  component: lazyRouteComponent(() => import('./pages/dashboard-page'), 'DashboardPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/profile',
  head: () => ({ meta: [{ title: 'Profile' }] }),
  component: lazyRouteComponent(() => import('./pages/profile-page'), 'ProfilePage'),
})

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([homeRoute]),
  loginRoute,
  signUpRoute,
  resetPasswordRoute,
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
