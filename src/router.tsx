import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import App from './App'
import { AuthPage } from './pages/auth-page'
import { DashboardPage } from './pages/dashboard-page'
import { ProfilePage } from './pages/profile-page'
import { supabase } from './lib/supabase/supabase'

const rootRoute = createRootRoute({
  component: App,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AuthPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      throw redirect({ to: '/' })
    }
  },
  component: DashboardPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
})

const routeTree = rootRoute.addChildren([authRoute, dashboardRoute, profileRoute])

export const router = createRouter({ routeTree } as unknown as Parameters<typeof createRouter>[0])

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
