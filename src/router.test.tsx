import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth/auth-store'
import { syncRouterWithAuth } from '@/lib/auth/sync-router-with-auth'
import { createAppRouter } from './router'

// Pages are stubbed: these tests are about guards, redirects and the loader, not the UI.
vi.mock('./pages/auth-page', () => ({ AuthPage: () => <div>auth page</div> }))
vi.mock('./pages/dashboard-page', () => ({ DashboardPage: () => <div>dashboard page</div> }))
vi.mock('./pages/profile-page', () => ({ ProfilePage: () => <div>profile page</div> }))

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

const signedIn: AuthState = {
  status: 'signed-in',
  session: { access_token: 'token', user: { id: 'user-1' } } as unknown as Session,
  user: { id: 'user-1' } as Session['user'],
}
const signedOut: AuthState = { status: 'signed-out', session: null, user: null }

const renderAt = (path: string) => {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  getMyProfile.mockReset().mockResolvedValue({ id: 'user-1', display_name: 'Ada' })
})

describe('signed out', () => {
  beforeEach(() => fakeStore.set(signedOut))

  it('renders the auth page at /', async () => {
    const router = renderAt('/')

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('redirects protected routes to / and remembers where the user was going', async () => {
    const router = renderAt('/profile')

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toEqual({ redirect: '/profile' })
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it('drops a redirect target that is not a same-origin path', async () => {
    const router = renderAt('/?redirect=https://evil.example')

    await screen.findByText('auth page')
    expect(router.state.location.search).toEqual({})
  })
})

describe('signed in', () => {
  beforeEach(() => fakeStore.set(signedIn))

  it('sends / to the dashboard', async () => {
    const router = renderAt('/')

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('honours a same-origin redirect target', async () => {
    const router = renderAt('/?redirect=/profile')

    expect(await screen.findByText('profile page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/profile')
  })

  it('loads the profile once for the authenticated layout', async () => {
    renderAt('/dashboard')

    await screen.findByText('dashboard page')
    expect(getMyProfile).toHaveBeenCalledTimes(1)
    expect(getMyProfile).toHaveBeenCalledWith('user-1')
  })

  it('shows the error boundary when the profile fails to load', async () => {
    getMyProfile.mockRejectedValue(new Error('permission denied'))
    renderAt('/dashboard')

    expect(await screen.findByText('Something went wrong!')).toBeInTheDocument()
  })
})

describe('session changes while on a page', () => {
  it('kicks the user back to / when they sign out', async () => {
    fakeStore.set(signedIn)
    const router = renderAt('/dashboard')
    const stopSyncing = syncRouterWithAuth(router)
    await screen.findByText('dashboard page')

    fakeStore.set(signedOut)

    expect(await screen.findByText('auth page')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toEqual({ redirect: '/dashboard' }))
    stopSyncing()
  })

  it('moves the user off / when they sign in', async () => {
    fakeStore.set(signedOut)
    const router = renderAt('/?redirect=/profile')
    const stopSyncing = syncRouterWithAuth(router)
    await screen.findByText('auth page')

    fakeStore.set(signedIn)

    expect(await screen.findByText('profile page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/profile')
    stopSyncing()
  })
})
