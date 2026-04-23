import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import App from './App'
import { AuthPage } from './pages/auth-page'
import { DashboardPage } from './pages/dashboard-page'
import { ProfilePage } from './pages/profile-page'

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
