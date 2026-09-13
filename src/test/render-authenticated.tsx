import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { Membership, OrgRole, Organisation } from '@/lib/supabase/organisations'
import type { Profile } from '@/lib/supabase/profiles'

export const testUser = {
  id: 'user-1',
  email: 'ada@example.com',
  created_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-09-10T08:30:00Z',
  user_metadata: {},
  app_metadata: {},
} as unknown as User

export const testProfile: Profile = {
  id: 'user-1',
  display_name: 'Ada',
  email: 'ada@example.com',
  phone: null,
  provider: 'email',
  providers: ['email'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-09-10T08:30:00Z',
  active_org_id: 'org-1',
}

export const testOrg: Organisation = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  created_at: '2026-01-02T00:00:00Z',
}

export const testMembership: Membership = {
  org_id: 'org-1',
  role: 'owner',
  expires_at: null,
  organisation: testOrg,
}

type RenderOptions = {
  user?: User
  profile?: Profile | null
  memberships?: Membership[]
  org?: Organisation
  role?: OrgRole
}

/**
 * Renders `ui` inside a throwaway router that mirrors the app's `_authenticated` → `_app`
 * layout chain (same ids, context and loader data), so `authenticatedRoute.*` and
 * `appRoute.useLoaderData()` resolve without the real guards or Supabase. Pages are wrapped in
 * a `SidebarProvider` as the app shell would. The page renders once the loaders settle; await a
 * `findBy…` query for its content.
 */
export const renderAuthenticated = (
  ui: ReactNode,
  {
    user = testUser,
    profile = testProfile,
    memberships = [testMembership],
    org = testOrg,
    role = 'owner',
  }: RenderOptions = {},
) => {
  const rootRoute = createRootRoute()
  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: () => ({ user }),
    loader: () => ({ profile, memberships }),
  })
  const appRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    id: '_app',
    loader: () => ({ org, role, memberships }),
  })
  const pageRoute = createRoute({
    getParentRoute: () => appRoute,
    path: '/page',
    component: () => <SidebarProvider>{ui}</SidebarProvider>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      authenticatedRoute.addChildren([appRoute.addChildren([pageRoute])]),
    ]),
    history: createMemoryHistory({ initialEntries: ['/page'] }),
  })

  return { ...render(<RouterProvider router={router} />), router }
}
