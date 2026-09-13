// Parses every file in supabase/schemas with PostgreSQL's own parser (libpg_query), so schema
// syntax errors are caught without a database. Run with `pnpm db:check`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'libpg-query'

const dir = 'supabase/schemas'
const files = readdirSync(dir)
  .filter((file) => file.endsWith('.sql'))
  .sort()

let failed = false
let total = 0

for (const file of files) {
  try {
    const { stmts = [] } = await parse(readFileSync(join(dir, file), 'utf8'))
    total += stmts.length
    console.log(`ok    ${file} (${stmts.length} statements)`)
  } catch (error) {
    failed = true
    console.error(`FAIL  ${file}: ${error instanceof Error ? error.message : error}`)
  }
}

console.log(failed ? 'Schema has syntax errors.' : `Schema parses: ${total} statements.`)
process.exit(failed ? 1 : 0)
