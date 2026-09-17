// Generates src/lib/supabase/database.types.ts from a live database, so queries and RPC calls
// are checked against the real schema. Same output as `supabase gen types typescript` — it is
// the same generator — but it only needs a connection string, not Docker or an access token.
// Run with `pnpm db:types`; reads DATABASE_URL from the environment or `.env.local`.
import { writeFileSync } from 'node:fs'
import { generateTypescript, introspect, sortGeneratorMetadata } from '@supabase/postgrest-typegen'
import pg from 'pg'

const out = 'src/lib/supabase/database.types.ts'

try {
  process.loadEnvFile('.env.local')
} catch {
  // No .env.local; DATABASE_URL may still be set in the environment.
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Add the session-pooler connection string from the Supabase ' +
      'dashboard (Connect → Session pooler) to .env.local.',
  )
  process.exit(1)
}

// A pool, not a client: the introspection runs its queries concurrently.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
})

try {
  const queryable = { query: async (sql) => ({ rows: (await pool.query(sql)).rows }) }
  const metadata = sortGeneratorMetadata(
    await introspect(queryable, { includedSchemas: ['public'], excludedSchemas: [] }),
  )
  // Prettier formats the result via `pnpm format`; skip the generator's own formatter.
  const code = await generateTypescript(metadata, {
    defaultSchema: 'public',
    format: async (source) => source,
  })
  writeFileSync(out, code)
  console.log(`Wrote ${out}. Run \`pnpm format\` to tidy it.`)
} finally {
  await pool.end()
}
