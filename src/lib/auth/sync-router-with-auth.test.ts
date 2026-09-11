import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from './auth-store'

const fakeStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let snapshot: AuthState = { status: 'loading', session: null, user: null }

  return {
    listeners,
    set(next: AuthState) {
      snapshot = next
    },
    emit() {
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

vi.mock('./auth-store', () => ({ authStore: fakeStore.authStore }))

const signedIn = (userId: string): Extract<AuthState, { status: 'signed-in' }> => ({
  status: 'signed-in',
  session: { access_token: `token-${userId}`, user: { id: userId } } as unknown as Session,
  user: { id: userId } as Session['user'],
})
const signedOut: AuthState = { status: 'signed-out', session: null, user: null }

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

let syncRouterWithAuth: typeof import('./sync-router-with-auth').syncRouterWithAuth

beforeEach(async () => {
  fakeStore.listeners.clear()
  fakeStore.set(signedOut)
  fakeStore.authStore.ready.mockClear()
  fakeStore.authStore.subscribe.mockClear()
  ;({ syncRouterWithAuth } = await import('./sync-router-with-auth'))
})

describe('syncRouterWithAuth', () => {
  it('waits for the session to be restored before subscribing', async () => {
    const router = { invalidate: vi.fn(() => Promise.resolve()) }
    let resolveReady!: () => void
    fakeStore.authStore.ready.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveReady = resolve
      }),
    )

    syncRouterWithAuth(router)
    expect(fakeStore.authStore.subscribe).not.toHaveBeenCalled()

    resolveReady()
    await flush()
    expect(fakeStore.authStore.subscribe).toHaveBeenCalledTimes(1)
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('invalidates the router when the user signs in or out', async () => {
    const router = { invalidate: vi.fn(() => Promise.resolve()) }
    syncRouterWithAuth(router)
    await flush()

    fakeStore.set(signedIn('user-1'))
    fakeStore.emit()
    expect(router.invalidate).toHaveBeenCalledTimes(1)

    fakeStore.set(signedOut)
    fakeStore.emit()
    expect(router.invalidate).toHaveBeenCalledTimes(2)
  })

  it('invalidates when a different user signs in', async () => {
    fakeStore.set(signedIn('user-1'))
    const router = { invalidate: vi.fn(() => Promise.resolve()) }
    syncRouterWithAuth(router)
    await flush()

    fakeStore.set(signedIn('user-2'))
    fakeStore.emit()
    expect(router.invalidate).toHaveBeenCalledTimes(1)
  })

  it('does not invalidate on a token refresh for the same user', async () => {
    fakeStore.set(signedIn('user-1'))
    const router = { invalidate: vi.fn(() => Promise.resolve()) }
    syncRouterWithAuth(router)
    await flush()

    fakeStore.set({ ...signedIn('user-1'), session: { access_token: 'rotated' } as Session })
    fakeStore.emit()
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('stops after cleanup, even if ready() resolves later', async () => {
    const router = { invalidate: vi.fn(() => Promise.resolve()) }
    let resolveReady!: () => void
    fakeStore.authStore.ready.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveReady = resolve
      }),
    )

    const cleanup = syncRouterWithAuth(router)
    cleanup()
    resolveReady()
    await flush()

    expect(fakeStore.authStore.subscribe).not.toHaveBeenCalled()

    fakeStore.set(signedIn('user-1'))
    fakeStore.emit()
    expect(router.invalidate).not.toHaveBeenCalled()
  })
})
