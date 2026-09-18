/**
 * The people the suite signs in as, and the back door that makes them: the Auth admin API
 * (create a user, mint a sign-in token, delete the user) and the service role (the rows no
 * client may write, such as the first staff member). Nobody ever has a password — a session
 * comes from a magic-link token exchanged with `verifyOtp`, exactly what clicking the emailed
 * link does — and nothing here is what a test asserts through: the browser is.
 *
 * Every user and organisation is named after the worker that made it (`e2e-<run><worker>-…`),
 * so the worker can delete its own at the end, and an interrupted run's leftovers can be
 * recognised and swept by the next one.
 */
import { createClient, type Session } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/supabase/database.types'

try {
  process.loadEnvFile('.env.local')
} catch {
  // Fine: CI sets the variables directly.
}

const read = (name: string) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. The E2E suite needs it in .env.local (see .env.example).`)
  }
  return value
}

const url = read('VITE_SUPABASE_URL')
const publishableKey = read('VITE_SUPABASE_PUBLISHABLE_KEY')
const secretKey = read('SUPABASE_KEY')

// Node-side clients hold their session in memory and never refresh it: each one lives for a
// few calls.
const inMemory = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

/** The service role: no RLS, and the Auth admin API. Setup and teardown only. */
export const admin = createClient<Database>(url, secretKey, inMemory)

/**
 * Where the app's supabase-js client keeps its session (its default key for this project).
 * Seeding it into a browser context's localStorage is how a page starts signed in.
 */
export const STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export type Person = { id: string; email: string; name: string }
export type PlatformRole = Database['public']['Enums']['platform_role']
export type OrgRole = Database['public']['Enums']['org_role']

const EMAIL_DOMAIN = 'yadro.test'
/** The first thing in every name the suite gives a user or an organisation, whichever run. */
const MARK = 'e2e-'
/** Leftovers older than this belong to an interrupted run, not one still going. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Deletes the organisations whose slug matches; memberships, invitations and the CRM cascade. */
const deleteOrganisations = async (pattern: string, olderThan?: string) => {
  let query = admin.from('organisations').delete().like('slug', pattern)
  if (olderThan) query = query.lt('created_at', olderThan)
  const { error } = await query
  if (error) throw error
}

/** A fresh session for an address: the exchange clicking a magic link performs, minus the email. */
const mintSession = async (email: string): Promise<Session> => {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw link.error

  const client = createClient<Database>(url, publishableKey, inMemory)
  const verified = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.data.properties.hashed_token,
  })
  if (verified.error) throw verified.error
  if (!verified.data.session) throw new Error(`No session came back for ${email}.`)
  return verified.data.session
}

/** Everything one worker creates, and the sessions it has minted. */
export class People {
  readonly prefix: string
  private readonly created: Person[] = []
  // One session per person for the worker's lifetime: the token lasts an hour, a run minutes,
  // and the exchange behind it is rate-limited per IP.
  private readonly sessions = new Map<string, Promise<Session>>()
  private serial = 0

  constructor(workerIndex: number) {
    this.prefix = `${MARK}${Date.now().toString(36)}${workerIndex}`
  }

  /** A slug for an organisation this worker is about to create. */
  slug(name: string) {
    return `${this.prefix}-${slugOf(name)}-${++this.serial}`
  }

  /** A confirmed user with a display name, and no password. */
  async create(name: string): Promise<Person> {
    const email = `${this.prefix}-${++this.serial}-${slugOf(name)}@${EMAIL_DOMAIN}`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: name },
    })
    if (error) throw error

    const person = { id: data.user.id, email, name }
    this.created.push(person)
    return person
  }

  /** The person's session, minted on first use. */
  session(person: Person): Promise<Session> {
    let pending = this.sessions.get(person.id)
    if (!pending) {
      pending = mintSession(person.email)
      this.sessions.set(person.id, pending)
    }
    return pending
  }

  /** After the person signs out in a browser: the next sign-in must start afresh. */
  forget(person: Person) {
    this.sessions.delete(person.id)
  }

  /** A supabase-js client signed in as the person, for setup a test is not about. */
  async client(person: Person) {
    const session = await this.session(person)
    const client = createClient<Database>(url, publishableKey, inMemory)
    const { error } = await client.auth.setSession(session)
    if (error) throw error
    return client
  }

  /** The row no client can create: a staff member, without an invitation. */
  async makeStaff(person: Person, role: PlatformRole) {
    const { error } = await admin.from('platform_members').insert({ user_id: person.id, role })
    if (error) throw error
  }

  /** Creates an organisation as the person, who becomes its owner — the app's own RPC. */
  async createOrganisation(person: Person, name: string) {
    const client = await this.client(person)
    const { data, error } = await client.rpc('create_organisation', {
      name,
      slug: this.slug(name),
    })
    if (error) throw error
    return data
  }

  /** Adds the person to an organisation directly — no invitation, like an operator would. */
  async join(person: Person, orgId: string, role: OrgRole) {
    const { error } = await admin
      .from('memberships')
      .insert({ org_id: orgId, user_id: person.id, role })
    if (error) throw error
  }

  /**
   * Ends a person's access to an organisation as of a moment: what an owner setting an
   * "access ends" date achieves once that date passes, without waiting for it.
   */
  async expireMembership(person: Person, orgId: string, at: Date) {
    const { error } = await admin
      .from('memberships')
      .update({ expires_at: at.toISOString() })
      .eq('org_id', orgId)
      .eq('user_id', person.id)
    if (error) throw error
  }

  /**
   * An earlier run that was interrupted leaves its users and organisations behind. Anything
   * marked as the suite's and old enough not to be a run in progress goes.
   */
  async sweepStale() {
    const before = new Date(Date.now() - STALE_AFTER_MS).toISOString()
    // Organisations first: a user who still owns one cannot be deleted (protect_last_owner).
    await deleteOrganisations(`${MARK}%`, before)

    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .like('email', `${MARK}%@${EMAIL_DOMAIN}`)
      .lt('created_at', before)
    if (error) throw error
    for (const { id } of data) {
      const deleted = await admin.auth.admin.deleteUser(id)
      // Another worker may have got there first.
      if (deleted.error && deleted.error.status !== 404) throw deleted.error
    }
  }

  /** Removes everything this worker made. Organisations first, for the same reason as above. */
  async cleanUp() {
    await deleteOrganisations(`${this.prefix}%`)
    const invitations = await admin
      .from('platform_invitations')
      .delete()
      .like('email', `${this.prefix}%`)
    if (invitations.error) throw invitations.error

    for (const person of this.created) {
      const { error } = await admin.auth.admin.deleteUser(person.id)
      if (error) throw error
    }
  }
}
