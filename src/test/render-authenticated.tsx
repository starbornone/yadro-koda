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
}

/**
 * Renders `ui` inside a throwaway router whose layout route has the same id, context and loader
 * data as the app's `_authenticated` route — so `authenticatedRoute.useRouteContext()` and
 * `useLoaderData()` resolve without the real guards or Supabase. Pages are wrapped in a
 * `SidebarProvider` as the app shell would. The page renders once the loader settles; await a
 * `findBy…` query for its content.
 */
export const renderAuthenticated = (
  ui: ReactNode,
  { user = testUser, profile = testProfile }: { user?: User; profile?: Profile | null } = {},
) => {
  const rootRoute = createRootRoute()
  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: () => ({ user }),
    loader: () => ({ profile }),
  })
  const pageRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: '/page',
    component: () => <SidebarProvider>{ui}</SidebarProvider>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([layoutRoute.addChildren([pageRoute])]),
    history: createMemoryHistory({ initialEntries: ['/page'] }),
  })

  return { ...render(<RouterProvider router={router} />), router }
}
