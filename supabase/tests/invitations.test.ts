import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { affected, as, connect, disconnect, failure, scratch, seed, sql, type Fixtures } from './db'

let f: Fixtures

beforeAll(async () => {
  await connect()
  f = await seed()
})
afterAll(disconnect)

type Invitation = { id: string; token: string; email: string; role: string }

const invite = (
  actor: Fixtures['rex'],
  email: string,
  role: string,
  accessExpiresAt: string | null = null,
) =>
  as(actor, () =>
    sql<Invitation>(
      `insert into public.invitations (org_id, email, role, access_expires_at)
       values ($1, $2, $3, $4) returning id, token, email, role`,
      [f.acme, email, role, accessExpiresAt],
    ),
  )

const accept = (user: Fixtures['rex'] | null, token: string) =>
  as(user, () => sql(`select public.accept_invitation($1)`, [token]))

describe('creating invitations', () => {
  it('follows the member tier rule: admins invite below owner, members nobody', async () => {
    expect(await failure(invite(f.grace, 'a@db.test', 'owner'))).toMatch(/row-level security/)
    expect(await failure(invite(f.mia, 'a@db.test', 'member'))).toMatch(/row-level security/)
    expect(await failure(invite(f.pat, 'a@db.test', 'member'))).toMatch(/row-level security/)
    await scratch(async () => {
      expect(await invite(f.grace, 'a@db.test', 'admin')).toHaveLength(1)
      expect(await invite(f.olive, 'b@db.test', 'owner')).toHaveLength(1)
      expect(await invite(f.sam, 'c@db.test', 'owner')).toHaveLength(1)
    })
  })

  it('wants a lower-cased address and allows one open invitation per address', async () => {
    expect(await failure(invite(f.olive, 'Mixed@DB.test', 'member'))).toMatch(/check constraint/)
    await scratch(async () => {
      await invite(f.olive, 'twice@db.test', 'member')
      expect(await failure(invite(f.olive, 'twice@db.test', 'member'))).toMatch(
        /invitations_one_pending_per_email/,
      )
    })
  })

  it('is readable by the organisation’s managers and by staff, not by members or outsiders', async () => {
    await scratch(async () => {
      await invite(f.olive, 'seen@db.test', 'member')
      const seenBy = (user: Fixtures['rex']) =>
        as(user, () => sql(`select id from public.invitations where org_id = $1`, [f.acme]))
      expect(await seenBy(f.grace)).toHaveLength(1)
      expect(await seenBy(f.sue)).toHaveLength(1)
      expect(await seenBy(f.mia)).toHaveLength(0)
      expect(await seenBy(f.rex)).toHaveLength(0)
    })
  })

  it('can be revoked within the same tier', async () => {
    await scratch(async () => {
      const [owner] = await invite(f.olive, 'o@db.test', 'owner')
      const [member] = await invite(f.olive, 'm@db.test', 'member')
      const revoke = (user: Fixtures['rex'], id: string) =>
        as(user, () => affected(`delete from public.invitations where id = $1`, [id]))
      expect(await revoke(f.grace, owner!.id)).toBe(0)
      expect(await revoke(f.mia, member!.id)).toBe(0)
      expect(await revoke(f.grace, member!.id)).toBe(1)
      expect(await revoke(f.olive, owner!.id)).toBe(1)
    })
  })
})

describe('get_invitation()', () => {
  it('shows anyone holding the link what it is, and no more', async () => {
    await scratch(async () => {
      const until = '2030-01-01T00:00:00.000Z'
      const [row] = await invite(f.olive, 'rex@db.test', 'admin', until)
      const preview = await as(null, () =>
        sql(`select * from public.get_invitation($1)`, [row!.token]),
      )
      expect(preview).toHaveLength(1)
      expect(preview[0]).toMatchObject({
        kind: 'organisation',
        organisation_name: 'Acme',
        email: 'rex@db.test',
        role: 'admin',
        invited_by_name: 'Olive Owner',
        accepted_at: null,
      })
      expect(new Date(preview[0]!.access_expires_at as string).toISOString()).toBe(until)
      expect(Object.keys(preview[0]!)).not.toContain('token')
      expect(
        await as(null, () => sql(`select * from public.get_invitation($1)`, [randomUUID()])),
      ).toHaveLength(0)
    })
  })
})

describe('accept_invitation()', () => {
  it('needs a session with the invited email, an unused link and an unexpired one', async () => {
    await scratch(async () => {
      const [row] = await invite(f.olive, 'rex@db.test', 'member')
      expect(await failure(accept(null, row!.token))).toMatch(/permission denied/)
      expect(await failure(accept(f.nina, row!.token))).toMatch(/different email/)
      expect(await failure(accept(f.rex, randomUUID()))).toMatch(/not found/)

      await sql(
        `update public.invitations set expires_at = now() - interval '1 minute' where id = $1`,
        [row!.id],
      )
      expect(await failure(accept(f.rex, row!.token))).toMatch(/expired/)
    })
  })

  it('joins with the invited role and access end, marks the link used and links the contact', async () => {
    await scratch(async () => {
      // Staff already know Rex as a contact; joining should attach the account to it.
      await as(f.sue, () =>
        sql(`insert into public.contacts (org_id, name, email) values ($1, 'Rex', 'REX@db.test')`, [
          f.acme,
        ]),
      )
      const until = '2030-06-30T13:59:59.999Z'
      const [row] = await invite(f.grace, 'rex@db.test', 'member', until)

      await accept(f.rex, row!.token)

      const [membership] = await sql<{ role: string; expires_at: Date }>(
        `select role, expires_at from public.memberships where org_id = $1 and user_id = $2`,
        [f.acme, f.rex.id],
      )
      expect(membership?.role).toBe('member')
      expect(membership?.expires_at.toISOString()).toBe(until)
      const [profile] = await sql<{ active_org_id: string }>(
        `select active_org_id from public.profiles where id = $1`,
        [f.rex.id],
      )
      expect(profile?.active_org_id).toBe(f.acme)
      const [invitation] = await sql<{ accepted_by: string; accepted: boolean }>(
        `select accepted_by, accepted_at is not null as accepted from public.invitations where id = $1`,
        [row!.id],
      )
      expect(invitation).toEqual({ accepted_by: f.rex.id, accepted: true })
      const [contact] = await sql<{ id: string; user_id: string }>(
        `select id, user_id from public.contacts where org_id = $1 and email ilike 'rex@db.test'`,
        [f.acme],
      )
      expect(contact?.user_id).toBe(f.rex.id)

      // …and the timeline says so, as Rex, against the contact staff already had for him.
      const [joined] = await sql<{ body: string; created_by: string; contact_id: string }>(
        `select body, created_by, contact_id from public.activities
         where org_id = $1 and kind = 'joined' and created_by = $2`,
        [f.acme, f.rex.id],
      )
      expect(joined).toEqual({
        body: 'Accepted an invitation as member',
        created_by: f.rex.id,
        contact_id: contact!.id,
      })

      expect(await failure(accept(f.rex, row!.token))).toMatch(/already been used/)
    })
  })

  it('keeps an existing member’s role and takes the invitation’s access end', async () => {
    await scratch(async () => {
      await sql(
        `update public.memberships set expires_at = now() - interval '1 day' where user_id = $1`,
        [f.grace.id],
      )
      const [row] = await invite(f.olive, 'grace@db.test', 'member')
      await accept(f.grace, row!.token)
      const [membership] = await sql<{ role: string; expires_at: Date | null }>(
        `select role, expires_at from public.memberships where org_id = $1 and user_id = $2`,
        [f.acme, f.grace.id],
      )
      expect(membership).toEqual({ role: 'admin', expires_at: null })
    })
  })
})
