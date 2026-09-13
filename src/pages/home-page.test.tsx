import { render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicLayout } from '@/components/layout/public-layout'
import { homeContent } from '@/features/marketing/content'
import type { AuthState } from '@/lib/auth/auth-store'
import { HomePage } from './home-page'

const fakeStore = vi.hoisted(() => {
  let snapshot: AuthState = { status: 'signed-out', session: null, user: null }
  return {
    set(next: AuthState) {
      snapshot = next
    },
    useAuth: () => snapshot,
  }
})
vi.mock('@/lib/auth/auth-store', () => ({ useAuth: fakeStore.useAuth }))

const signedIn: AuthState = {
  status: 'signed-in',
  session: { access_token: 'token' } as Session,
  user: { id: 'user-1' } as Session['user'],
  passwordRecovery: false,
}

// Mirrors the app's `_public` layout + `/` route.
const renderHome = () => {
  const rootRoute = createRootRoute()
  const publicRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_public',
    component: PublicLayout,
  })
  const homeRoute = createRoute({
    getParentRoute: () => publicRoute,
    path: '/',
    component: HomePage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([publicRoute.addChildren([homeRoute])]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  fakeStore.set({ status: 'signed-out', session: null, user: null })
})

describe('HomePage', () => {
  it('renders the placeholder marketing content', async () => {
    renderHome()

    expect(
      await screen.findByRole('heading', { level: 1, name: homeContent.hero.headline }),
    ).toBeInTheDocument()
    for (const feature of homeContent.features.items) {
      expect(screen.getByText(feature.title)).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: homeContent.cta.heading })).toBeInTheDocument()
    expect(screen.getByText(`© ${new Date().getFullYear()} Јадро Кода`)).toBeInTheDocument()
  })

  it('points signed-out visitors at sign-up and login', async () => {
    renderHome()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('link', { name: /get started/i })[0]).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: homeContent.cta.button })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('points signed-in visitors at the dashboard instead', async () => {
    fakeStore.set(signedIn)
    renderHome()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app')
    expect(screen.getByRole('link', { name: homeContent.hero.signedInCta })).toHaveAttribute(
      'href',
      '/app',
    )
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument()
  })

  it('has a theme toggle in the header', async () => {
    renderHome()

    expect(await screen.findByRole('button', { name: 'Change theme' })).toBeInTheDocument()
  })
})
