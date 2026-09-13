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
import { getMyMemberships } from '@/lib/supabase/organisations'
import { getMyProfile } from '@/lib/supabase/profiles'
import { homeContent } from '@/features/marketing/content'
import { HomePage } from './pages/home-page'

const DEFAULT_SIGNED_IN_PATH = '/app'

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
// Signed in
// ---------------------------------------------------------------------------

// Pathless layout: every route under it requires a session. The guard runs once here instead
// of per-route, and the profile and memberships are loaded once for all children. Guards that
// need that data (below) live in child *loaders* and read it via `parentMatchPromise`, so the
// query is shared rather than repeated.
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
  loader: async ({ context }) => {
    const [profile, memberships] = await Promise.all([
      getMyProfile(context.user.id),
      getMyMemberships(context.user.id),
    ])
    return { profile, memberships }
  },
  // These only change through this app; refetch on explicit `router.invalidate()`, not on
  // every navigation.
  staleTime: Infinity,
})

// A child loader reads its parent's data through `parentMatchPromise`. If the parent loader
// failed there is no data — surface that error rather than guessing (an empty fallback would
// send a user whose profile failed to load into onboarding).
const loaderDataOf = <T,>(match: { loaderData?: T; error?: unknown }): T => {
  if (match.loaderData === undefined) {
    throw match.error ?? new Error('Route data is unavailable.')
  }
  return match.loaderData
}

// A signed-in user with no organisation yet. Once they have one, this sends them into the app.
const onboardingRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/onboarding',
  loader: async ({ parentMatchPromise }) => {
    const { memberships } = loaderDataOf(await parentMatchPromise)
    if (memberships.length > 0) throw redirect({ to: '/app' })
  },
  head: () => ({ meta: [{ title: 'Create your organisation' }] }),
  component: lazyRouteComponent(() => import('./pages/onboarding-page'), 'OnboardingPage'),
})

// ---------------------------------------------------------------------------
// Tenant app: everything under /app happens inside one active organisation
// ---------------------------------------------------------------------------

// Pathless layout: requires at least one membership and resolves the active organisation
// (the profile's remembered choice, else the first). Children read `org`, `role` and
// `memberships` from this route's loader data.
const appRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: '_app',
  loader: async ({ parentMatchPromise }) => {
    const { profile, memberships } = loaderDataOf(await parentMatchPromise)

    if (memberships.length === 0) throw redirect({ to: '/onboarding' })

    const active =
      memberships.find((membership) => membership.org_id === profile?.active_org_id) ??
      memberships[0]!

    return { memberships, org: active.organisation, role: active.role }
  },
  staleTime: Infinity,
  // The marketing page stays in the main chunk; everything behind the guard (including the
  // shell) is split out so a visitor never downloads the app.
  component: lazyRouteComponent(() => import('@/components/layout/app-shell'), 'AppShell'),
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/app',
  head: () => ({ meta: [{ title: 'Dashboard' }] }),
  component: lazyRouteComponent(() => import('./pages/dashboard-page'), 'DashboardPage'),
})

const orgSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/app/settings',
  head: () => ({ meta: [{ title: 'Organisation settings' }] }),
  component: lazyRouteComponent(() => import('./pages/org-settings-page'), 'OrgSettingsPage'),
})

const newOrganisationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/app/organisations/new',
  head: () => ({ meta: [{ title: 'New organisation' }] }),
  component: lazyRouteComponent(
    () => import('./pages/new-organisation-page'),
    'NewOrganisationPage',
  ),
})

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/app/profile',
  head: () => ({ meta: [{ title: 'Profile' }] }),
  component: lazyRouteComponent(() => import('./pages/profile-page'), 'ProfilePage'),
})

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([homeRoute]),
  loginRoute,
  signUpRoute,
  resetPasswordRoute,
  authenticatedRoute.addChildren([
    onboardingRoute,
    appRoute.addChildren([dashboardRoute, orgSettingsRoute, newOrganisationRoute, profileRoute]),
  ]),
])

// Factory so tests can build a router on a memory history; the app uses the default instance.
export const createAppRouter = (options: { history?: RouterHistory } = {}) =>
  createRouter({
    routeTree,
    history: options.history,
    // Fetch a lazy route's chunk when a link to it is hovered or focused.
    defaultPreload: 'intent',
    // Loaders here use `staleTime: Infinity` and refresh only via `router.invalidate()`, i.e.
    // when data has changed and guards must see it. The default 'background' mode would hand
    // child loaders (and `parentMatchPromise`) the stale data first.
    defaultStaleReloadMode: 'blocking',
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
