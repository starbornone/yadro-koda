import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import App from './App'
import { PublicLayout } from '@/components/layout/public-layout'
import { RouteError, RouteNotFound, RoutePending } from '@/components/router/route-fallbacks'
import { authStore } from '@/lib/auth/auth-store'
import { readResetLinkError } from '@/lib/auth/password-reset'
import { canInOrg, canOnPlatform } from '@/lib/auth/permissions'
import {
  getCustomerRecord,
  getStageCounts,
  isCustomerStage,
  listMyOpenTasks,
  listRecentActivities,
  type CustomerStage,
} from '@/lib/supabase/crm'
import { getInvitation, listInvitations } from '@/lib/supabase/invitations'
import { getMyMemberships, listMembers } from '@/lib/supabase/organisations'
import {
  getMyPlatformRole,
  getOrganisation,
  getPlatformOverview,
  listOrganisations,
  listPlatformInvitations,
  listPlatformMembers,
} from '@/lib/supabase/platform'
import { getMyProfile } from '@/lib/supabase/profiles'
import { homeContent } from '@/features/marketing/content'
import { HomePage } from './pages/home-page'

// The account chooser dispatches: one place to go → straight there; several → pick.
const DEFAULT_SIGNED_IN_PATH = '/accounts'

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

// The landing page for an invitation link. Anyone may open it — the invitee usually has no
// account yet — so it sits outside `_authenticated` and reads the session itself: signed out,
// it explains what the link is for and which address to sign in with; signed in with that
// address, it offers to join. Accepting is a button, never a side effect of loading, because
// links are prefetched on hover.
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  beforeLoad: async () => {
    await authStore.ready()
    const auth = authStore.getSnapshot()

    if (auth.status === 'signed-in' && auth.passwordRecovery) {
      throw redirect({ to: '/reset-password' })
    }

    return { user: auth.status === 'signed-in' ? auth.user : null }
  },
  loader: ({ params }) => getInvitation(params.token),
  head: () => ({ meta: [{ title: 'Invitation' }] }),
  component: lazyRouteComponent(() => import('./pages/invite-page'), 'InvitePage'),
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
    const [profile, memberships, platformRole] = await Promise.all([
      getMyProfile(context.user.id),
      getMyMemberships(context.user.id),
      getMyPlatformRole(context.user.id),
    ])
    return { profile, memberships, platformRole }
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

// Loaders run in parallel by default, so a child under a guard layout must wait for the guard
// before fetching anything — otherwise its request goes out even when the parent redirects.
// Rethrows the parent's redirect/error; returns its data.
const guardedBy = async <T,>(parentMatchPromise: Promise<{ loaderData?: T; error?: unknown }>) =>
  loaderDataOf(await parentMatchPromise)

// Where to after signing in. One person can be staff and belong to organisations, so with
// more than one place to go the user picks; with exactly one they go straight there.
const accountsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/accounts',
  loader: async ({ parentMatchPromise }) => {
    const { memberships, platformRole } = loaderDataOf(await parentMatchPromise)
    const places = memberships.length + (platformRole ? 1 : 0)

    if (places === 0) throw redirect({ to: '/onboarding' })
    if (places === 1) throw redirect({ to: platformRole ? '/staff' : '/app' })

    return { memberships, platformRole }
  },
  staleTime: Infinity,
  head: () => ({ meta: [{ title: 'Choose an account' }] }),
  component: lazyRouteComponent(() => import('./pages/accounts-page'), 'AccountsPage'),
})

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
    const { profile, memberships, platformRole } = loaderDataOf(await parentMatchPromise)

    // Nowhere to go inside the tenant app: staff have their own home, everyone else needs an
    // organisation first.
    if (memberships.length === 0) {
      throw redirect({ to: platformRole ? '/staff' : '/onboarding' })
    }

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

// Everyone sees who belongs; only managers see the open invitations (RLS would hide them
// anyway, so this just saves the request).
const membersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/app/members',
  loader: async ({ parentMatchPromise }) => {
    const { org, role } = await guardedBy(parentMatchPromise)
    const [members, invitations] = await Promise.all([
      listMembers(org.id),
      canInOrg(role, 'org:manage-members') ? listInvitations(org.id) : [],
    ])
    return { members, invitations }
  },
  head: () => ({ meta: [{ title: 'Members' }] }),
  component: lazyRouteComponent(() => import('./pages/members-page'), 'MembersPage'),
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

// ---------------------------------------------------------------------------
// Staff area: the platform's own people, looking across every tenant
// ---------------------------------------------------------------------------

// Pathless layout: requires a platform role. A non-staff user who lands here is sent to their
// own app — it is the wrong door, not a missing page.
const staffRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: '_staff',
  loader: async ({ parentMatchPromise }) => {
    const { platformRole, memberships } = loaderDataOf(await parentMatchPromise)

    if (!platformRole) throw redirect({ to: '/app' })

    return { platformRole, hasOrganisations: memberships.length > 0 }
  },
  staleTime: Infinity,
  component: lazyRouteComponent(() => import('@/components/layout/staff-shell'), 'StaffShell'),
})

const staffOverviewRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff',
  loader: async ({ context, parentMatchPromise }) => {
    await guardedBy(parentMatchPromise)
    const [overview, stages, tasks, activities] = await Promise.all([
      getPlatformOverview(),
      getStageCounts(),
      listMyOpenTasks(context.user.id),
      listRecentActivities(),
    ])
    return { ...overview, stages, tasks, activities }
  },
  head: () => ({ meta: [{ title: 'Staff' }] }),
  component: lazyRouteComponent(
    () => import('./pages/staff/staff-overview-page'),
    'StaffOverviewPage',
  ),
})

// The organisations list doubles as the CRM pipeline: `?stage=` narrows it to one stage.
const staffOrganisationsRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff/organisations',
  validateSearch: (search: Record<string, unknown>): { q?: string; stage?: CustomerStage } => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
    stage: isCustomerStage(search.stage) ? search.stage : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '', stage: search.stage }),
  loader: async ({ deps, parentMatchPromise }) => {
    await guardedBy(parentMatchPromise)
    return listOrganisations({ search: deps.q, stage: deps.stage })
  },
  head: () => ({ meta: [{ title: 'Organisations' }] }),
  component: lazyRouteComponent(
    () => import('./pages/staff/staff-organisations-page'),
    'StaffOrganisationsPage',
  ),
})

// Staff enter an organisation before it has any users (a lead). Only the tiers that move the
// pipeline may; anyone else is sent back to the list.
const staffNewOrganisationRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff/organisations/new',
  loader: async ({ parentMatchPromise }) => {
    const { platformRole } = await guardedBy(parentMatchPromise)
    if (!canOnPlatform(platformRole, 'platform:manage-customers')) {
      throw redirect({ to: '/staff/organisations' })
    }
  },
  head: () => ({ meta: [{ title: 'New organisation' }] }),
  component: lazyRouteComponent(
    () => import('./pages/staff/staff-new-organisation-page'),
    'StaffNewOrganisationPage',
  ),
})

// One organisation as staff see it: the tenant (members, open invitations) plus its whole CRM
// record, and the staff list for owner/assignee choices.
const staffOrganisationRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff/organisations/$orgId',
  loader: async ({ params, parentMatchPromise }) => {
    await guardedBy(parentMatchPromise)
    const [organisation, record, staff, invitations] = await Promise.all([
      getOrganisation(params.orgId),
      getCustomerRecord(params.orgId),
      listPlatformMembers(),
      listInvitations(params.orgId),
    ])
    if (!organisation || !record) throw notFound()
    return { organisation, ...record, staff, invitations }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.organisation.name ?? 'Organisation' }],
  }),
  component: lazyRouteComponent(
    () => import('./pages/staff/staff-organisation-page'),
    'StaffOrganisationPage',
  ),
})

// Everyone on staff sees the team; only the tiers that manage it see the open invitations
// (they are the only ones who can act on them).
const staffTeamRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff/team',
  loader: async ({ parentMatchPromise }) => {
    const { platformRole } = await guardedBy(parentMatchPromise)
    const [members, invitations] = await Promise.all([
      listPlatformMembers(),
      canOnPlatform(platformRole, 'platform:manage-team') ? listPlatformInvitations() : [],
    ])
    return { members, invitations }
  },
  head: () => ({ meta: [{ title: 'Team' }] }),
  component: lazyRouteComponent(() => import('./pages/staff/staff-team-page'), 'StaffTeamPage'),
})

const staffProfileRoute = createRoute({
  getParentRoute: () => staffRoute,
  path: '/staff/profile',
  head: () => ({ meta: [{ title: 'Profile' }] }),
  component: lazyRouteComponent(() => import('./pages/profile-page'), 'StaffProfilePage'),
})

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([homeRoute]),
  loginRoute,
  signUpRoute,
  resetPasswordRoute,
  inviteRoute,
  authenticatedRoute.addChildren([
    accountsRoute,
    onboardingRoute,
    appRoute.addChildren([
      dashboardRoute,
      orgSettingsRoute,
      membersRoute,
      newOrganisationRoute,
      profileRoute,
    ]),
    staffRoute.addChildren([
      staffOverviewRoute,
      staffOrganisationsRoute,
      staffNewOrganisationRoute,
      staffOrganisationRoute,
      staffTeamRoute,
      staffProfileRoute,
    ]),
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
