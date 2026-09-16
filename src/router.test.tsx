import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth/auth-store'
import { syncRouterWithAuth } from '@/lib/auth/sync-router-with-auth'
import { createAppRouter } from './router'

// Pages and layouts are stubbed: these tests are about guards, redirects and the loader.
vi.mock('@/components/layout/app-shell', () => ({ AppShell: () => <Outlet /> }))
vi.mock('@/components/layout/public-layout', () => ({ PublicLayout: () => <Outlet /> }))
vi.mock('./pages/home-page', () => ({ HomePage: () => <div>home page</div> }))
vi.mock('./pages/auth-page', () => ({
  AuthPage: () => <div>auth page</div>,
  SignUpPage: () => <div>sign-up page</div>,
}))
vi.mock('./pages/dashboard-page', () => ({ DashboardPage: () => <div>dashboard page</div> }))
vi.mock('./pages/profile-page', () => ({
  ProfilePage: () => <div>profile page</div>,
  StaffProfilePage: () => <div>profile page</div>,
}))
vi.mock('./pages/reset-password-page', () => ({
  ResetPasswordPage: () => <div>reset page</div>,
}))
vi.mock('./pages/onboarding-page', () => ({ OnboardingPage: () => <div>onboarding page</div> }))
vi.mock('./pages/org-settings-page', () => ({ OrgSettingsPage: () => <div>settings page</div> }))
vi.mock('./pages/members-page', () => ({ MembersPage: () => <div>members page</div> }))
vi.mock('./pages/invite-page', () => ({ InvitePage: () => <div>invite page</div> }))
vi.mock('./pages/new-organisation-page', () => ({
  NewOrganisationPage: () => <div>new org page</div>,
}))
vi.mock('@/components/layout/staff-shell', () => ({ StaffShell: () => <Outlet /> }))
vi.mock('./pages/staff/staff-overview-page', () => ({
  StaffOverviewPage: () => <div>staff overview</div>,
}))
vi.mock('./pages/staff/staff-organisations-page', () => ({
  StaffOrganisationsPage: () => <div>staff organisations</div>,
}))
vi.mock('./pages/staff/staff-organisation-page', () => ({
  StaffOrganisationPage: () => <div>staff organisation</div>,
}))
vi.mock('./pages/staff/staff-team-page', () => ({ StaffTeamPage: () => <div>staff team</div> }))
vi.mock('./pages/staff/staff-new-organisation-page', () => ({
  StaffNewOrganisationPage: () => <div>staff new organisation</div>,
}))
vi.mock('./pages/accounts-page', () => ({ AccountsPage: () => <div>accounts page</div> }))

const fakeStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let snapshot: AuthState = { status: 'loading', session: null, user: null }

  return {
    set(next: AuthState) {
      snapshot = next
      for (const listener of listeners) listener()
    },
    authStore: {
      ready: vi.fn(() => Promise.resolve()),
      getSnapshot: vi.fn(() => snapshot),
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }),
    },
  }
})

vi.mock('@/lib/auth/auth-store', () => ({ authStore: fakeStore.authStore }))

const getMyProfile = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/profiles', () => ({ getMyProfile }))

const organisations = vi.hoisted(() => ({ getMyMemberships: vi.fn(), listMembers: vi.fn() }))
vi.mock('@/lib/supabase/organisations', () => organisations)
const { getMyMemberships } = organisations

const invitations = vi.hoisted(() => ({ getInvitation: vi.fn(), listInvitations: vi.fn() }))
vi.mock('@/lib/supabase/invitations', () => invitations)

const platform = vi.hoisted(() => ({
  getMyPlatformRole: vi.fn(),
  getPlatformOverview: vi.fn(),
  listOrganisations: vi.fn(),
  getOrganisation: vi.fn(),
  listPlatformMembers: vi.fn(),
  listPlatformInvitations: vi.fn(),
}))
vi.mock('@/lib/supabase/platform', () => platform)

const crm = vi.hoisted(() => ({
  getCustomerRecord: vi.fn(),
  getStageCounts: vi.fn(),
  listMyOpenTasks: vi.fn(),
}))
vi.mock('@/lib/supabase/crm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/crm')>()),
  ...crm,
}))

const membership = (orgId: string, role = 'owner') => ({
  org_id: orgId,
  role,
  expires_at: null,
  organisation: { id: orgId, name: `Org ${orgId}`, slug: orgId, created_at: '' },
})

const signedIn: AuthState = {
  status: 'signed-in',
  session: { access_token: 'token', user: { id: 'user-1' } } as unknown as Session,
  user: { id: 'user-1' } as Session['user'],
  passwordRecovery: false,
}
const signedOut: AuthState = { status: 'signed-out', session: null, user: null }
const inRecovery: AuthState = { ...signedIn, passwordRecovery: true }

const renderAt = (path: string) => {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  getMyProfile
    .mockReset()
    .mockResolvedValue({ id: 'user-1', display_name: 'Ada', active_org_id: null })
  getMyMemberships.mockReset().mockResolvedValue([membership('org-1')])
  organisations.listMembers.mockReset().mockResolvedValue([])
  invitations.getInvitation.mockReset().mockResolvedValue(null)
  invitations.listInvitations.mockReset().mockResolvedValue([])
  platform.getMyPlatformRole.mockReset().mockResolvedValue(null)
  platform.getPlatformOverview
    .mockReset()
    .mockResolvedValue({ organisations: 1, memberships: 1, staff: 1 })
  platform.listOrganisations.mockReset().mockResolvedValue([])
  platform.getOrganisation.mockReset().mockResolvedValue(null)
  platform.listPlatformMembers.mockReset().mockResolvedValue([])
  platform.listPlatformInvitations.mockReset().mockResolvedValue([])
  crm.getCustomerRecord.mockReset().mockResolvedValue(null)
  crm.getStageCounts.mockReset().mockResolvedValue({})
  crm.listMyOpenTasks.mockReset().mockResolvedValue([])
})

describe('public site', () => {
  it('shows the home page to signed-out visitors', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/')

    expect(await screen.findByText('home page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the home page to signed-in visitors too', async () => {
    fakeStore.set(signedIn)
    const router = renderAt('/')

    expect(await screen.findByText('home page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(getMyProfile).not.toHaveBeenCalled()
  })
})

describe('signed out', () => {
  beforeEach(() => fakeStore.set(signedOut))

  it('renders login at /login and sign-up at /signup', async () => {
    renderAt('/login')
    expect(await screen.findByText('auth page')).toBeInTheDocument()

    renderAt('/signup')
    expect(await screen.findByText('sign-up page')).toBeInTheDocument()
  })

  it('redirects protected routes to /login and remembers where the user was going', async () => {
    const router = renderAt('/app/profile')

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ redirect: '/app/profile' })
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it('drops a redirect target that is not a same-origin path', async () => {
    const router = renderAt('/login?redirect=https://evil.example')

    await screen.findByText('auth page')
    expect(router.state.location.search).toEqual({})
  })
})

describe('signed in', () => {
  beforeEach(() => fakeStore.set(signedIn))

  it('sends /login and /signup through the account chooser into the app', async () => {
    const login = renderAt('/login')
    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(login.state.location.pathname).toBe('/app')

    const signup = renderAt('/signup')
    await waitFor(() => expect(signup.state.location.pathname).toBe('/app'))
  })

  it('honours a same-origin redirect target', async () => {
    const router = renderAt('/login?redirect=/app/profile')

    expect(await screen.findByText('profile page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app/profile')
  })

  it('loads the profile and memberships once for the authenticated layout', async () => {
    renderAt('/app')

    await screen.findByText('dashboard page')
    expect(getMyProfile).toHaveBeenCalledTimes(1)
    expect(getMyProfile).toHaveBeenCalledWith('user-1')
    expect(getMyMemberships).toHaveBeenCalledTimes(1)
    expect(getMyMemberships).toHaveBeenCalledWith('user-1')
  })

  it('shows the error boundary when the profile fails to load, and can retry', async () => {
    getMyProfile.mockRejectedValueOnce(new Error('permission denied'))
    renderAt('/app')

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('permission denied')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(getMyProfile).toHaveBeenCalledTimes(2)
  })

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/nope')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })
})

describe('organisations', () => {
  beforeEach(() => fakeStore.set(signedIn))

  it('sends a user with no organisation to onboarding', async () => {
    getMyMemberships.mockResolvedValue([])
    const router = renderAt('/app')

    expect(await screen.findByText('onboarding page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('keeps a user with an organisation out of onboarding', async () => {
    const router = renderAt('/onboarding')

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('lets a user with an organisation create another one', async () => {
    const router = renderAt('/app/organisations/new')

    expect(await screen.findByText('new org page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app/organisations/new')
  })

  it('moves into the app once an organisation exists, on invalidate', async () => {
    getMyMemberships.mockResolvedValue([])
    const router = renderAt('/app')
    await screen.findByText('onboarding page')

    // What creating an organisation does: fresh data, then invalidate.
    getMyMemberships.mockResolvedValue([membership('org-1')])
    await router.invalidate()

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('re-resolves the active organisation on invalidate', async () => {
    getMyMemberships.mockResolvedValue([membership('org-1'), membership('org-2', 'member')])
    const router = renderAt('/app')
    await screen.findByText('dashboard page')
    const appMatch = () =>
      router.state.matches.find((match) => match.routeId === '/_authenticated/_app')
    expect(appMatch()?.loaderData).toMatchObject({ org: { id: 'org-1' } })

    // What switching does: the profile now remembers org-2, then invalidate.
    getMyProfile.mockResolvedValue({ id: 'user-1', active_org_id: 'org-2' })
    await router.invalidate()

    await waitFor(() =>
      expect(appMatch()?.loaderData).toMatchObject({ org: { id: 'org-2' }, role: 'member' }),
    )
  })

  it('makes the remembered organisation active', async () => {
    getMyProfile.mockResolvedValue({ id: 'user-1', active_org_id: 'org-2' })
    getMyMemberships.mockResolvedValue([membership('org-1'), membership('org-2', 'member')])
    const router = renderAt('/app')

    await screen.findByText('dashboard page')
    const app = router.state.matches.find((match) => match.routeId === '/_authenticated/_app')
    expect(app?.loaderData).toMatchObject({ org: { id: 'org-2' }, role: 'member' })
  })

  it('falls back to the first organisation when the remembered one is gone', async () => {
    getMyProfile.mockResolvedValue({ id: 'user-1', active_org_id: 'org-gone' })
    getMyMemberships.mockResolvedValue([membership('org-1'), membership('org-2')])
    const router = renderAt('/app')

    await screen.findByText('dashboard page')
    const app = router.state.matches.find((match) => match.routeId === '/_authenticated/_app')
    expect(app?.loaderData).toMatchObject({ org: { id: 'org-1' }, role: 'owner' })
  })

  it('loads members for everyone but invitations only for managers', async () => {
    renderAt('/app/members')
    expect(await screen.findByText('members page')).toBeInTheDocument()
    expect(organisations.listMembers).toHaveBeenCalledWith('org-1')
    expect(invitations.listInvitations).toHaveBeenCalledWith('org-1')

    cleanup()
    invitations.listInvitations.mockClear()
    getMyMemberships.mockResolvedValue([membership('org-1', 'member')])
    renderAt('/app/members')
    expect(await screen.findByText('members page')).toBeInTheDocument()
    expect(invitations.listInvitations).not.toHaveBeenCalled()
  })
})

describe('invitation links', () => {
  const token = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

  it('opens for a signed-out visitor without touching their profile', async () => {
    fakeStore.set(signedOut)
    const router = renderAt(`/invite/${token}`)

    expect(await screen.findByText('invite page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/invite/${token}`)
    expect(invitations.getInvitation).toHaveBeenCalledWith(token)
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it('opens for a signed-in visitor too', async () => {
    fakeStore.set(signedIn)
    renderAt(`/invite/${token}`)

    expect(await screen.findByText('invite page')).toBeInTheDocument()
    expect(invitations.getInvitation).toHaveBeenCalledWith(token)
  })

  it('sends a recovery session to the reset page first', async () => {
    fakeStore.set(inRecovery)
    const router = renderAt(`/invite/${token}`)

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
    expect(invitations.getInvitation).not.toHaveBeenCalled()
  })
})

describe('account chooser', () => {
  beforeEach(() => fakeStore.set(signedIn))

  it('sends a user with nowhere to go to onboarding', async () => {
    getMyMemberships.mockResolvedValue([])
    const router = renderAt('/accounts')

    expect(await screen.findByText('onboarding page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('goes straight to the only organisation', async () => {
    const router = renderAt('/accounts')

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('goes straight to the staff area for staff with no organisation', async () => {
    getMyMemberships.mockResolvedValue([])
    platform.getMyPlatformRole.mockResolvedValue('support')
    const router = renderAt('/accounts')

    expect(await screen.findByText('staff overview')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/staff')
  })

  it('lets staff who also belong to an organisation choose', async () => {
    platform.getMyPlatformRole.mockResolvedValue('admin')
    const router = renderAt('/accounts')

    expect(await screen.findByText('accounts page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/accounts')
  })

  it('lets a member of several organisations choose', async () => {
    getMyMemberships.mockResolvedValue([membership('org-1'), membership('org-2')])
    const router = renderAt('/accounts')

    expect(await screen.findByText('accounts page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/accounts')
  })
})

describe('staff', () => {
  beforeEach(() => fakeStore.set(signedIn))

  it('serves the profile page inside the staff shell too', async () => {
    getMyMemberships.mockResolvedValue([])
    platform.getMyPlatformRole.mockResolvedValue('support')
    const router = renderAt('/staff/profile')

    expect(await screen.findByText('profile page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/staff/profile')
  })

  it('sends staff with no organisation to the staff area instead of onboarding', async () => {
    getMyMemberships.mockResolvedValue([])
    platform.getMyPlatformRole.mockResolvedValue('support')
    const router = renderAt('/app')

    expect(await screen.findByText('staff overview')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/staff')
  })

  it('keeps staff who also belong to an organisation in their app by default', async () => {
    platform.getMyPlatformRole.mockResolvedValue('admin')
    const router = renderAt('/app')

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('sends non-staff who open /staff to their app', async () => {
    const router = renderAt('/staff/team')

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
    expect(platform.listPlatformMembers).not.toHaveBeenCalled()
  })

  it('serves the staff pages to staff, passing search and stage to the list', async () => {
    platform.getMyPlatformRole.mockResolvedValue('support')
    renderAt('/staff/organisations?q=acme&stage=trial')

    expect(await screen.findByText('staff organisations')).toBeInTheDocument()
    expect(platform.listOrganisations).toHaveBeenCalledWith({ search: 'acme', stage: 'trial' })
  })

  it('drops an unknown stage from the URL', async () => {
    platform.getMyPlatformRole.mockResolvedValue('support')
    const router = renderAt('/staff/organisations?stage=bogus')

    await screen.findByText('staff organisations')
    expect(router.state.location.search).toEqual({})
    expect(platform.listOrganisations).toHaveBeenCalledWith({ search: '', stage: undefined })
  })

  it('renders not-found for an organisation that does not exist', async () => {
    platform.getMyPlatformRole.mockResolvedValue('support')
    renderAt('/staff/organisations/nope')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(platform.getOrganisation).toHaveBeenCalledWith('nope')
    expect(crm.getCustomerRecord).toHaveBeenCalledWith('nope')
  })

  it('loads the customer record and open invitations alongside the organisation', async () => {
    platform.getMyPlatformRole.mockResolvedValue('support')
    platform.getOrganisation.mockResolvedValue({ id: 'org-1', name: 'Acme', members: [] })
    crm.getCustomerRecord.mockResolvedValue({
      customer: { org_id: 'org-1', stage: 'lead' },
      contacts: [],
      activities: [],
      tasks: [],
    })
    renderAt('/staff/organisations/org-1')

    expect(await screen.findByText('staff organisation')).toBeInTheDocument()
    expect(platform.listPlatformMembers).toHaveBeenCalled()
    expect(invitations.listInvitations).toHaveBeenCalledWith('org-1')
  })

  it('loads team invitations for the tiers that manage the team', async () => {
    platform.getMyPlatformRole.mockResolvedValue('admin')
    renderAt('/staff/team')
    expect(await screen.findByText('staff team')).toBeInTheDocument()
    expect(platform.listPlatformMembers).toHaveBeenCalled()
    expect(platform.listPlatformInvitations).toHaveBeenCalled()

    cleanup()
    platform.listPlatformInvitations.mockClear()
    platform.getMyPlatformRole.mockResolvedValue('support')
    renderAt('/staff/team')
    expect(await screen.findByText('staff team')).toBeInTheDocument()
    expect(platform.listPlatformInvitations).not.toHaveBeenCalled()
  })

  it('loads the pipeline and the viewer’s tasks for the overview', async () => {
    platform.getMyPlatformRole.mockResolvedValue('support')
    renderAt('/staff')

    expect(await screen.findByText('staff overview')).toBeInTheDocument()
    expect(crm.getStageCounts).toHaveBeenCalled()
    expect(crm.listMyOpenTasks).toHaveBeenCalledWith('user-1')
  })

  it('lets admins enter a new organisation but sends support back to the list', async () => {
    platform.getMyPlatformRole.mockResolvedValue('admin')
    const admin = renderAt('/staff/organisations/new')
    expect(await screen.findByText('staff new organisation')).toBeInTheDocument()
    expect(admin.state.location.pathname).toBe('/staff/organisations/new')

    cleanup()
    platform.getMyPlatformRole.mockResolvedValue('support')
    const support = renderAt('/staff/organisations/new')
    expect(await screen.findByText('staff organisations')).toBeInTheDocument()
    expect(support.state.location.pathname).toBe('/staff/organisations')
  })
})

describe('password recovery', () => {
  it('sends a recovery session from /login to the reset page', async () => {
    fakeStore.set(inRecovery)
    const router = renderAt('/login')

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
  })

  it('keeps a recovery session out of the app until the password is set', async () => {
    fakeStore.set(inRecovery)
    const router = renderAt('/app')

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it('lets the user into the app once recovery is cleared', async () => {
    fakeStore.set(inRecovery)
    const router = renderAt('/reset-password')
    const stopSyncing = syncRouterWithAuth(router)
    await screen.findByText('reset page')

    // USER_UPDATED clears the flag in the real store; the page then links to the dashboard.
    fakeStore.set(signedIn)
    await waitFor(() => expect(router.state.location.pathname).toBe('/reset-password'))
    await router.navigate({ to: '/app' })

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    stopSyncing()
  })

  it('shows the reset page for a signed-in user without recovery too', async () => {
    fakeStore.set(signedIn)
    const router = renderAt('/reset-password')

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
  })

  it('sends a signed-out visitor with no link error to /login', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/reset-password')

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('keeps a signed-out visitor on the page when the link carried an error (query)', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/reset-password?error_code=otp_expired&error=access_denied')

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
  })

  it('keeps a signed-out visitor on the page when the link carried an error (hash)', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/reset-password#error=access_denied&error_code=otp_expired')

    expect(await screen.findByText('reset page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reset-password')
  })
})

describe('session changes while on a page', () => {
  it('kicks the user back to /login when they sign out', async () => {
    fakeStore.set(signedIn)
    const router = renderAt('/app')
    const stopSyncing = syncRouterWithAuth(router)
    await screen.findByText('dashboard page')

    fakeStore.set(signedOut)

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toEqual({ redirect: '/app' }))
    stopSyncing()
  })

  it('moves the user off /login when they sign in', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/login?redirect=/app/profile')
    const stopSyncing = syncRouterWithAuth(router)
    await screen.findByText('auth page')

    fakeStore.set(signedIn)

    expect(await screen.findByText('profile page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app/profile')
    stopSyncing()
  })
})
