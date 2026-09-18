import { defineConfig, devices } from '@playwright/test'

// `pnpm e2e`: the app in a real browser against the live Supabase project, as throwaway users
// the suite creates and deletes itself (see e2e/support/people.ts). Needs VITE_SUPABASE_URL,
// VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_KEY — from .env.local, or the environment in CI.
// Kept apart from `pnpm test`, which mocks Supabase, and `pnpm db:test`, which never renders a
// page.
try {
  process.loadEnvFile('.env.local')
} catch {
  // Fine: CI sets the variables directly.
}

// Not the dev server's 5173, so a running `pnpm dev` and the suite never fight over a port.
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  // Each file owns its people and organisations, so files run side by side; the tests inside
  // one are a journey and run in order.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // The dev server transforms modules on first request; give a cold page a moment.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
