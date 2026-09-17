import { defineConfig } from 'vitest/config'

// `pnpm db:test`: the schema's policies, triggers and RPCs, exercised against a real database
// (DATABASE_URL) inside transactions that are always rolled back. Kept apart from `pnpm test`,
// which mocks Supabase and needs no credentials.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    // One connection at a time: each file owns a transaction and impersonates roles on it.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
