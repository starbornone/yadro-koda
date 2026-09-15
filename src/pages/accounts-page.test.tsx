import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Membership } from '@/lib/supabase/organisations'
import type { PlatformRole } from '@/lib/supabase/platform'
import { testMembership, testProfile, testUser } from '@/test/render-authenticated'
import { AccountsPage } from './accounts-page'

const setActiveOrganisation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  setActiveOrganisation,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

const globex: Membership = {
  org_id: 'org-2',
  role: 'member',
  expires_at: null,
  organisation: { id: 'org-2', name: 'Globex', slug: 'globex', created_at: '' },
}

// Mirrors `_authenticated` → `/accounts`, with `/app` and `/staff` as landing stubs.
const renderPage = ({
  memberships = [testMembership, globex],
  platformRole = null as PlatformRole | null,
} = {}) => {
  const rootRoute = createRootRoute()
  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: () => ({ user: testUser }),
    loader: () => ({ profile: testProfile, memberships, platformRole }),
  })
  const accountsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: '/accounts',
    loader: () => ({ memberships, platformRole }),
    component: AccountsPage,
  })
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/app',
    component: () => <div>app landing</div>,
  })
  const staffRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/staff',
    component: () => <div>staff landing</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      authenticatedRoute.addChildren([accountsRoute]),
      appRoute,
      staffRoute,
    ]),
    history: createMemoryHistory({ initialEntries: ['/accounts'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  setActiveOrganisation.mockReset().mockResolvedValue(undefined)
})

describe('AccountsPage', () => {
  it('lists every place the user can go, with their role in each', async () => {
    renderPage({ platformRole: 'support' })

    expect(await screen.findByRole('button', { name: /staff.*Support/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acme.*Owner/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Globex.*Member/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New organisation/ })).toHaveAttribute(
      'href',
      '/app/organisations/new',
    )
  })

  it('remembers the chosen organisation and opens the app', async () => {
    const user = userEvent.setup()
    const router = renderPage()

    await user.click(await screen.findByRole('button', { name: /Globex/ }))

    expect(setActiveOrganisation).toHaveBeenCalledWith('user-1', 'org-2')
    expect(await screen.findByText('app landing')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('skips the write when the chosen organisation is already active', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Acme/ }))

    expect(setActiveOrganisation).not.toHaveBeenCalled()
    expect(await screen.findByText('app landing')).toBeInTheDocument()
  })

  it('opens the staff area', async () => {
    const user = userEvent.setup()
    const router = renderPage({ platformRole: 'admin' })

    await user.click(await screen.findByRole('button', { name: /staff/ }))

    expect(await screen.findByText('staff landing')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/staff')
  })

  it('surfaces a failure to switch', async () => {
    setActiveOrganisation.mockRejectedValue(
      new Error('active_org_id must reference an organisation the user belongs to'),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Globex/ }))

    expect(await screen.findByText(/must reference an organisation/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Globex/ })).toBeEnabled())
  })
})
