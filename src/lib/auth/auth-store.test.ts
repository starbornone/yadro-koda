import { act, renderHook } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type AuthCallback = (event: string, session: Session | null) => void

const fakeAuth = vi.hoisted(() => {
  const callbacks: AuthCallback[] = []
  return {
    callbacks,
    onAuthStateChange: vi.fn((callback: AuthCallback) => {
      callbacks.push(callback)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  }
})

vi.mock('@/lib/supabase/supabase', () => ({
  supabase: { auth: { onAuthStateChange: fakeAuth.onAuthStateChange } },
}))

const session = (accessToken: string, userId = 'user-1') =>
  ({ access_token: accessToken, user: { id: userId } }) as unknown as Session

const emit = (event: string, value: Session | null) => {
  for (const callback of fakeAuth.callbacks) callback(event, value)
}

// The store keeps module-level state, so every test gets a fresh copy.
const loadStore = async () => {
  vi.resetModules()
  fakeAuth.callbacks.length = 0
  fakeAuth.onAuthStateChange.mockClear()
  return import('./auth-store')
}

describe('authStore', () => {
  let store: Awaited<ReturnType<typeof loadStore>>

  beforeEach(async () => {
    store = await loadStore()
  })

  it('starts in the loading state without touching Supabase', () => {
    expect(store.authStore.getSnapshot()).toEqual({ status: 'loading', session: null, user: null })
    expect(fakeAuth.onAuthStateChange).not.toHaveBeenCalled()
  })

  it('ready() subscribes once and resolves on INITIAL_SESSION', async () => {
    const first = store.authStore.ready()
    const second = store.authStore.ready()

    expect(first).toBe(second)
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledTimes(1)

    emit('INITIAL_SESSION', null)
    await expect(first).resolves.toBeUndefined()
    expect(store.authStore.getSnapshot().status).toBe('signed-out')
  })

  it('restores a persisted session as signed-in', async () => {
    const ready = store.authStore.ready()
    const persisted = session('token-1')

    emit('INITIAL_SESSION', persisted)
    await ready

    expect(store.authStore.getSnapshot()).toEqual({
      status: 'signed-in',
      session: persisted,
      user: persisted.user,
    })
  })

  it('notifies subscribers on sign-in and sign-out', async () => {
    const listener = vi.fn()
    store.authStore.subscribe(listener)
    void store.authStore.ready()
    emit('INITIAL_SESSION', null)
    listener.mockClear()

    emit('SIGNED_IN', session('token-1'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.authStore.getSnapshot().user?.id).toBe('user-1')

    emit('SIGNED_OUT', null)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.authStore.getSnapshot().status).toBe('signed-out')
  })

  it('ignores a re-emitted session with the same access token', () => {
    const listener = vi.fn()
    store.authStore.subscribe(listener)
    void store.authStore.ready()

    emit('INITIAL_SESSION', session('token-1'))
    emit('SIGNED_IN', session('token-1'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('emits on token refresh so consumers see the new access token', () => {
    const listener = vi.fn()
    store.authStore.subscribe(listener)
    void store.authStore.ready()

    emit('INITIAL_SESSION', session('token-1'))
    emit('TOKEN_REFRESHED', session('token-2'))

    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.authStore.getSnapshot().session?.access_token).toBe('token-2')
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = store.authStore.subscribe(listener)
    void store.authStore.ready()

    emit('INITIAL_SESSION', null)
    unsubscribe()
    emit('SIGNED_IN', session('token-1'))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('useAuth', () => {
  it('re-renders with the latest snapshot', async () => {
    const store = await loadStore()
    void store.authStore.ready()

    const { result } = renderHook(() => store.useAuth())
    expect(result.current.status).toBe('loading')

    act(() => emit('INITIAL_SESSION', session('token-1')))
    expect(result.current.status).toBe('signed-in')
    expect(result.current.user?.id).toBe('user-1')

    act(() => emit('SIGNED_OUT', null))
    expect(result.current.status).toBe('signed-out')
  })
})
