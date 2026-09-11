import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A matchMedia whose `matches` and change listeners the tests control.
const media = {
  matches: false,
  listeners: new Set<() => void>(),
  setDark(dark: boolean) {
    media.matches = dark
    for (const listener of media.listeners) listener()
  },
}

const originalMatchMedia = window.matchMedia

const loadStore = async () => {
  vi.resetModules()
  return import('./theme-store')
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  media.matches = false
  media.listeners.clear()
  window.matchMedia = vi.fn((query: string) => ({
    matches: media.matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: () => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => media.listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('themeStore', () => {
  it('defaults to system and resolves from the OS setting', async () => {
    media.matches = true
    const { themeStore } = await loadStore()

    expect(themeStore.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
  })

  it('reads a stored preference, ignoring junk', async () => {
    localStorage.setItem('theme', 'dark')
    expect((await loadStore()).themeStore.getSnapshot().preference).toBe('dark')

    localStorage.setItem('theme', 'purple')
    expect((await loadStore()).themeStore.getSnapshot().preference).toBe('system')
  })

  it('init() applies the resolved theme to the document', async () => {
    localStorage.setItem('theme', 'dark')
    const { themeStore } = await loadStore()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    themeStore.init()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setPreference persists, applies and notifies', async () => {
    const { themeStore } = await loadStore()
    themeStore.init()
    const listener = vi.fn()
    themeStore.subscribe(listener)

    themeStore.setPreference('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(themeStore.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' })
    expect(listener).toHaveBeenCalledTimes(1)

    themeStore.setPreference('system')
    expect(localStorage.getItem('theme')).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('follows OS changes only while on system', async () => {
    const { themeStore } = await loadStore()
    themeStore.init()

    media.setDark(true)
    expect(themeStore.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    themeStore.setPreference('light')
    media.setDark(false)
    media.setDark(true)
    expect(themeStore.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('picks up a choice made in another tab', async () => {
    const { themeStore } = await loadStore()
    themeStore.init()

    localStorage.setItem('theme', 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))

    expect(themeStore.getSnapshot().preference).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not notify when nothing changed', async () => {
    const { themeStore } = await loadStore()
    themeStore.init()
    const listener = vi.fn()
    themeStore.subscribe(listener)

    themeStore.setPreference('system')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('useTheme', () => {
  it('re-renders with the latest snapshot', async () => {
    const { themeStore, useTheme } = await loadStore()
    const { result } = renderHook(() => useTheme())

    expect(result.current.resolved).toBe('light')
    act(() => themeStore.setPreference('dark'))
    expect(result.current).toEqual({ preference: 'dark', resolved: 'dark' })
  })
})
