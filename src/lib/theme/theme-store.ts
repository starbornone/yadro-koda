import { useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export type ThemeState = {
  /** What the user chose. `system` follows the OS setting. */
  preference: ThemePreference
  /** What is actually applied right now. */
  resolved: ResolvedTheme
}

/** Must match the inline script in index.html, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const readStoredPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const writeStoredPreference = (preference: ThemePreference) => {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode, blocked); the choice just won't persist.
  }
}

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light') : preference

const applyToDocument = (resolved: ResolvedTheme) => {
  // `.dark` drives the Tailwind `dark:` variant and the token overrides in index.css.
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

let preference = readStoredPreference()
let state: ThemeState = { preference, resolved: resolve(preference) }
let initialised = false
const listeners = new Set<() => void>()

const update = () => {
  const next: ThemeState = { preference, resolved: resolve(preference) }
  if (next.preference === state.preference && next.resolved === state.resolved) return

  state = next
  applyToDocument(state.resolved)
  for (const listener of listeners) listener()
}

export const themeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): ThemeState {
    return state
  },

  setPreference(next: ThemePreference) {
    preference = next
    writeStoredPreference(next)
    update()
  },

  /**
   * Applies the current theme and starts following OS changes (while on `system`) and other
   * tabs' choices. Call once at startup. Idempotent.
   */
  init() {
    if (initialised) return
    initialised = true

    applyToDocument(state.resolved)

    window.matchMedia(DARK_QUERY).addEventListener('change', () => {
      if (preference === 'system') update()
    })

    window.addEventListener('storage', (event) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
      preference = readStoredPreference()
      update()
    })
  },
}

export const useTheme = () => useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
