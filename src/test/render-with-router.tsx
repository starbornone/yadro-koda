import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'

/**
 * Renders `ui` as the root of a throwaway router so components that use `<Link>` or router
 * hooks work. The router is loaded before rendering, so the UI is on screen synchronously.
 */
export const renderWithRouter = async (ui: ReactNode, { path = '/' } = {}) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()

  return { ...render(<RouterProvider router={router} />), router }
}
