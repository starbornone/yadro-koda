import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Testing Library only auto-cleans when test globals are enabled; we import explicitly.
afterEach(() => {
  cleanup()
})

// jsdom has no matchMedia; `useIsMobile` needs it. Default to desktop.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// jsdom has no scrollTo; TanStack Router's scroll restoration calls it on navigation.
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })

// jsdom has no ResizeObserver; Radix (Checkbox, and others) measures with it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub })
