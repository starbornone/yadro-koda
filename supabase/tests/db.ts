/**
 * Helpers for the schema tests: one connection per test file, one transaction that is never
 * committed, and a way to run statements as a signed-in user (or anonymously) the way
 * PostgREST does — `set role` plus `request.jwt.claims` — so RLS, column grants, triggers and
 * RPCs are exercised exactly as the app hits them.
 *
 * Needs DATABASE_URL (the session-pooler string; see .env.example). Everything the tests
 * create lives inside the transaction and vanishes with the rollback.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'

let client: pg.Client | null = null

const db = () => {
  if (!client) throw new Error('connect() has not been called')
  return client
}

/** Opens the connection and begins the transaction every test in the file runs inside. */
export const connect = async () => {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // Fine: DATABASE_URL may come from the environment (CI).
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add the session-pooler connection string to .env.local (see .env.example).',
    )
  }
  client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  await client.query('begin')
}

/** Rolls everything back and closes the connection. */
export const disconnect = async () => {
  if (!client) return
  try {
    await client.query('rollback')
  } finally {
    await client.end()
    client = null
  }
}

type Row = Record<string, unknown>

/** Runs one statement as whoever is current (the database owner unless inside `as`). */
export const sql = async <T extends Row = Row>(text: string, params: unknown[] = []) =>
  (await db().query(text, params)).rows as T[]

/** Like `sql`, but returns how many rows an insert/update/delete touched. */
export const affected = async (text: string, params: unknown[] = []) =>
  (await db().query(text, params)).rowCount ?? 0

let savepoints = 0

/**
 * Runs `fn` inside a savepoint. On success the savepoint is released (the changes stay, until
 * the file's rollback); on failure it is rolled back and the error rethrown, so a raised
 * exception does not abort the surrounding transaction.
 */
const savepoint = async <T>(fn: () => Promise<T>): Promise<T> => {
  const name = `sp${++savepoints}`
  await db().query(`savepoint ${name}`)
  try {
    const result = await fn()
    await db().query(`release savepoint ${name}`)
    return result
  } catch (error) {
    await db().query(`rollback to savepoint ${name}`)
    throw error
  }
}

/** Runs `fn` and then undoes whatever it did, whether it succeeded or not. */
export const scratch = async <T>(fn: () => Promise<T>): Promise<T> => {
  const name = `scratch${++savepoints}`
  await db().query(`savepoint ${name}`)
  try {
    return await fn()
  } finally {
    await db().query(`rollback to savepoint ${name}`)
  }
}

export type TestUser = { id: string; email: string }

/**
 * Runs `fn` as a signed-in user (or, with null, as an anonymous visitor). Mirrors what
 * PostgREST does with a JWT: the `authenticated` / `anon` role, and the claims that
 * `auth.uid()` reads. The role is reset afterwards even when `fn` throws.
 */
export const as = async <T>(user: TestUser | null, fn: () => Promise<T>): Promise<T> => {
  try {
    return await savepoint(async () => {
      await db().query(`set local role ${user ? 'authenticated' : 'anon'}`)
      await db().query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(
          user ? { sub: user.id, role: 'authenticated', email: user.email } : { role: 'anon' },
        ),
      ])
      return fn()
    })
  } finally {
    await db().query('reset role')
    await db().query(`select set_config('request.jwt.claims', '', true)`)
  }
}

/** The message of the error `promise` rejects with, or null when it resolves. */
export const failure = async (promise: Promise<unknown>): Promise<string | null> => {
  try {
    await promise
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * Creates an auth user the way sign-up would leave it, so the `on_auth_user_created` trigger
 * fills in the profile. Inside the transaction, so it is gone after the rollback.
 */
export const createUser = async (email: string, displayName: string): Promise<TestUser> => {
  const id = randomUUID()
  await sql(
    `insert into auth.users (id, email, aud, role, raw_user_meta_data, raw_app_meta_data, created_at)
     values ($1, $2, 'authenticated', 'authenticated', $3, '{"provider":"email","providers":["email"]}', now())`,
    [id, email, JSON.stringify({ display_name: displayName })],
  )
  return { id, email }
}

export type Fixtures = {
  /** Owner of Acme. */
  olive: TestUser
  /** Admin of Acme. */
  grace: TestUser
  /** Member of Acme. */
  mia: TestUser
  /** Belongs to nothing. */
  rex: TestUser
  /** Belongs to nothing either; the second invitee. */
  nina: TestUser
  /** Staff: superadmin. */
  sam: TestUser
  /** Staff: admin. */
  pat: TestUser
  /** Staff: support. */
  sue: TestUser
  /** Acme's id. Created through `create_organisation()` as Olive. */
  acme: string
}

/** The cast every test file starts from. */
export const seed = async (): Promise<Fixtures> => {
  // One at a time: a single connection cannot run statements concurrently.
  const olive = await createUser('olive@db.test', 'Olive Owner')
  const grace = await createUser('grace@db.test', 'Grace Admin')
  const mia = await createUser('mia@db.test', 'Mia Member')
  const rex = await createUser('rex@db.test', 'Rex Outsider')
  const nina = await createUser('nina@db.test', 'Nina Newcomer')
  const sam = await createUser('sam@db.test', 'Sam Superadmin')
  const pat = await createUser('pat@db.test', 'Pat Admin')
  const sue = await createUser('sue@db.test', 'Sue Support')

  await sql(
    `insert into public.platform_members (user_id, role) values ($1, 'superadmin'), ($2, 'admin'), ($3, 'support')`,
    [sam.id, pat.id, sue.id],
  )

  const [org] = await as(olive, () =>
    sql<{ id: string }>(`select id from public.create_organisation('Acme', 'acme-db-test')`),
  )
  await sql(
    `insert into public.memberships (org_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')`,
    [org!.id, grace.id, mia.id],
  )

  return { olive, grace, mia, rex, nina, sam, pat, sue, acme: org!.id }
}
