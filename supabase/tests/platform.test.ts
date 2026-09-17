import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { affected, as, connect, disconnect, failure, scratch, seed, sql, type Fixtures } from './db'

let f: Fixtures

beforeAll(async () => {
  await connect()
  f = await seed()
})
afterAll(disconnect)

const setRole = (actor: Fixtures['rex'], target: Fixtures['rex'], role: string) =>
  as(actor, () =>
    affected(`update public.platform_members set role = $2 where user_id = $1`, [target.id, role]),
  )

const remove = (actor: Fixtures['rex'], target: Fixtures['rex']) =>
  as(actor, () => affected(`delete from public.platform_members where user_id = $1`, [target.id]))

describe('the staff team', () => {
  // The project may have real staff too; only count the seeded ones.
  const team = (viewer: Fixtures['rex']) =>
    as(viewer, () =>
      sql(`select user_id from public.platform_members where user_id = any($1)`, [
        [f.sam.id, f.pat.id, f.sue.id],
      ]),
    )

  it('is visible to staff only', async () => {
    expect(await team(f.sue)).toHaveLength(3)
    expect(await team(f.olive)).toHaveLength(0)
  })

  it('is managed by tier: superadmins anyone, admins below superadmin, support nobody', async () => {
    expect(await setRole(f.pat, f.sam, 'support')).toBe(0)
    expect(await failure(setRole(f.pat, f.sue, 'superadmin'))).toMatch(/row-level security/)
    expect(await setRole(f.sue, f.pat, 'support')).toBe(0)
    expect(await remove(f.sue, f.pat)).toBe(0)
    await scratch(async () => {
      expect(await setRole(f.pat, f.sue, 'admin')).toBe(1)
      expect(await setRole(f.sam, f.pat, 'superadmin')).toBe(1)
      expect(await remove(f.pat, f.sue)).toBe(1)
    })
  })

  it('keeps its last superadmin', async () => {
    await scratch(async () => {
      // Make Sam the only superadmin, whatever the project already has.
      await sql(
        `update public.platform_members set role = 'admin' where role = 'superadmin' and user_id <> $1`,
        [f.sam.id],
      )
      expect(await failure(setRole(f.sam, f.sam, 'admin'))).toMatch(/last superadmin/)
      expect(await failure(remove(f.sam, f.sam))).toMatch(/last superadmin/)
      expect(await setRole(f.sam, f.pat, 'superadmin')).toBe(1)
      expect(await setRole(f.sam, f.sam, 'admin')).toBe(1)
    })
  })

  it('cannot be joined by inserting a row', async () => {
    expect(
      await failure(
        as(f.sam, () =>
          affected(`insert into public.platform_members (user_id, role) values ($1, 'support')`, [
            f.rex.id,
          ]),
        ),
      ),
    ).toMatch(/permission denied/)
  })
})

describe('platform invitations', () => {
  type Invitation = { id: string; token: string }
  const invite = (actor: Fixtures['rex'], email: string, role: string) =>
    as(actor, () =>
      sql<Invitation>(
        `insert into public.platform_invitations (email, role) values ($1, $2) returning id, token`,
        [email, role],
      ),
    )
  const accept = (user: Fixtures['rex'] | null, token: string) =>
    as(user, () => sql(`select public.accept_platform_invitation($1)`, [token]))

  it('follow the same tier rule', async () => {
    expect(await failure(invite(f.sue, 'x@db.test', 'support'))).toMatch(/row-level security/)
    expect(await failure(invite(f.pat, 'x@db.test', 'superadmin'))).toMatch(/row-level security/)
    expect(await failure(invite(f.olive, 'x@db.test', 'support'))).toMatch(/row-level security/)
    await scratch(async () => {
      expect(await invite(f.pat, 'x@db.test', 'admin')).toHaveLength(1)
      expect(await invite(f.sam, 'y@db.test', 'superadmin')).toHaveLength(1)
      const revoke = (user: Fixtures['rex'], email: string) =>
        as(user, () =>
          affected(`delete from public.platform_invitations where email = $1`, [email]),
        )
      expect(await revoke(f.pat, 'y@db.test')).toBe(0)
      expect(await revoke(f.sam, 'y@db.test')).toBe(1)
    })
  })

  it('are read by every staff tier and nobody else', async () => {
    await scratch(async () => {
      await invite(f.sam, 'x@db.test', 'support')
      const seenBy = (user: Fixtures['rex']) =>
        as(user, () => sql(`select id from public.platform_invitations where email = 'x@db.test'`))
      expect(await seenBy(f.sue)).toHaveLength(1)
      expect(await seenBy(f.olive)).toHaveLength(0)
    })
  })

  it('are identified by get_invitation() as a team link', async () => {
    await scratch(async () => {
      const [row] = await invite(f.sam, 'nina@db.test', 'support')
      const [preview] = await as(null, () =>
        sql(
          `select kind, organisation_name, role, invited_by_name from public.get_invitation($1)`,
          [row!.token],
        ),
      )
      expect(preview).toEqual({
        kind: 'platform',
        organisation_name: null,
        role: 'support',
        invited_by_name: 'Sam Superadmin',
      })
    })
  })

  it('add the right account to the team, once', async () => {
    await scratch(async () => {
      const [row] = await invite(f.pat, 'nina@db.test', 'admin')
      expect(await failure(accept(null, row!.token))).toMatch(/permission denied/)
      expect(await failure(accept(f.rex, row!.token))).toMatch(/different email/)

      await accept(f.nina, row!.token)
      const [member] = await sql<{ role: string }>(
        `select role from public.platform_members where user_id = $1`,
        [f.nina.id],
      )
      expect(member?.role).toBe('admin')
      expect(await failure(accept(f.nina, row!.token))).toMatch(/already been used/)
    })
  })

  it('leave an existing staff member’s role alone', async () => {
    await scratch(async () => {
      const [row] = await invite(f.sam, 'sue@db.test', 'admin')
      await accept(f.sue, row!.token)
      const [member] = await sql<{ role: string }>(
        `select role from public.platform_members where user_id = $1`,
        [f.sue.id],
      )
      expect(member?.role).toBe('support')
    })
  })
})
