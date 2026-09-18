import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  affected,
  as,
  connect,
  createUser,
  disconnect,
  failure,
  scratch,
  seed,
  sql,
  type Fixtures,
} from './db'

let f: Fixtures

beforeAll(async () => {
  await connect()
  f = await seed()
})
afterAll(disconnect)

describe('create_organisation()', () => {
  it('makes the caller its owner, marks it active and starts it as a trial', async () => {
    const [membership] = await sql<{ role: string }>(
      `select role from public.memberships where org_id = $1 and user_id = $2`,
      [f.acme, f.olive.id],
    )
    expect(membership?.role).toBe('owner')

    const [profile] = await sql<{ active_org_id: string }>(
      `select active_org_id from public.profiles where id = $1`,
      [f.olive.id],
    )
    expect(profile?.active_org_id).toBe(f.acme)

    const [customer] = await sql<{ stage: string }>(
      `select stage from public.customers where org_id = $1`,
      [f.acme],
    )
    expect(customer?.stage).toBe('trial')

    const [founding] = await sql<{ body: string; created_by: string }>(
      `select body, created_by from public.activities where org_id = $1 and kind = 'joined' and created_by = $2`,
      [f.acme, f.olive.id],
    )
    expect(founding).toEqual({ body: 'Created the organisation', created_by: f.olive.id })
  })

  it('refuses a taken slug and a signed-out caller', async () => {
    expect(
      await failure(
        as(f.rex, () => sql(`select public.create_organisation('Other', 'acme-db-test')`)),
      ),
    ).toMatch(/organisations_slug_key/)
    // Anonymous callers cannot even reach the function: the grant, not the body, refuses.
    expect(
      await failure(as(null, () => sql(`select public.create_organisation('Anon', 'anon-org')`))),
    ).toMatch(/permission denied/)
  })
})

describe('organisations', () => {
  it('are visible to members and staff, invisible to everyone else', async () => {
    const visibleTo = (user: Fixtures['rex']) =>
      as(user, () => sql(`select id from public.organisations where id = $1`, [f.acme]))
    expect(await visibleTo(f.mia)).toHaveLength(1)
    expect(await visibleTo(f.sue)).toHaveLength(1)
    expect(await visibleTo(f.rex)).toHaveLength(0)
    expect(await failure(as(null, () => sql(`select id from public.organisations`)))).toMatch(
      /permission denied/,
    )
  })

  it('can be renamed by owners, admins and superadmins, but not members or other staff', async () => {
    const rename = (user: Fixtures['rex']) =>
      as(user, () =>
        affected(`update public.organisations set name = 'Acme Ltd' where id = $1`, [f.acme]),
      )
    expect(await rename(f.mia)).toBe(0)
    expect(await rename(f.pat)).toBe(0)
    expect(await rename(f.grace)).toBe(1)
    expect(await rename(f.sam)).toBe(1)
  })

  it('never lets the slug change from the client', async () => {
    expect(
      await failure(
        as(f.olive, () =>
          affected(`update public.organisations set slug = 'acme-2' where id = $1`, [f.acme]),
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('can be deleted by an owner or superadmin only, taking everything with them', async () => {
    const remove = (user: Fixtures['rex']) =>
      as(user, () => affected(`delete from public.organisations where id = $1`, [f.acme]))
    expect(await remove(f.grace)).toBe(0)
    expect(await remove(f.pat)).toBe(0)

    await scratch(async () => {
      expect(await remove(f.olive)).toBe(1)
      const [left] = await sql<{ memberships: string; customers: string }>(
        `select (select count(*) from public.memberships where org_id = $1) as memberships,
                (select count(*) from public.customers where org_id = $1) as customers`,
        [f.acme],
      )
      expect(left).toEqual({ memberships: '0', customers: '0' })
      const [profile] = await sql<{ active_org_id: string | null }>(
        `select active_org_id from public.profiles where id = $1`,
        [f.olive.id],
      )
      expect(profile?.active_org_id).toBeNull()
    })
    await scratch(async () => {
      expect(await remove(f.sam)).toBe(1)
    })
  })
})

describe('memberships', () => {
  const setRole = (actor: Fixtures['rex'], target: Fixtures['rex'], role: string) =>
    as(actor, () =>
      affected(`update public.memberships set role = $3 where org_id = $1 and user_id = $2`, [
        f.acme,
        target.id,
        role,
      ]),
    )

  it('let owners manage anyone and admins anyone below owner', async () => {
    expect(await setRole(f.grace, f.olive, 'member')).toBe(0)
    expect(await failure(setRole(f.grace, f.grace, 'owner'))).toMatch(/row-level security/)
    expect(await setRole(f.mia, f.grace, 'member')).toBe(0)
    await scratch(async () => {
      expect(await setRole(f.grace, f.mia, 'admin')).toBe(1)
      expect(await setRole(f.olive, f.grace, 'owner')).toBe(1)
      expect(await setRole(f.sam, f.grace, 'member')).toBe(1)
      expect(await setRole(f.pat, f.mia, 'member')).toBe(0)
    })
  })

  it('let managers time-box access, and only role and expiry are writable', async () => {
    const expire = (actor: Fixtures['rex'], target: Fixtures['rex']) =>
      as(actor, () =>
        affected(
          `update public.memberships set expires_at = now() + interval '1 day' where org_id = $1 and user_id = $2`,
          [f.acme, target.id],
        ),
      )
    expect(await expire(f.mia, f.mia)).toBe(0)
    await scratch(async () => {
      expect(await expire(f.grace, f.mia)).toBe(1)
    })
    expect(
      await failure(
        as(f.olive, () =>
          affected(
            `update public.memberships set created_at = now() where org_id = $1 and user_id = $2`,
            [f.acme, f.mia.id],
          ),
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('stop granting access once expired', async () => {
    await scratch(async () => {
      await sql(
        `update public.memberships set expires_at = now() - interval '1 minute' where user_id = $1`,
        [f.mia.id],
      )
      expect(await as(f.mia, () => sql(`select id from public.organisations`))).toHaveLength(0)
      expect(
        await as(f.mia, () => sql(`select public.is_org_member($1) as member`, [f.acme])),
      ).toEqual([{ member: false }])
    })
  })

  it('let anyone leave, and forget the organisation they left', async () => {
    await scratch(async () => {
      await sql(`update public.profiles set active_org_id = $1 where id = $2`, [f.acme, f.mia.id])
      expect(
        await as(f.mia, () =>
          affected(`delete from public.memberships where org_id = $1 and user_id = $2`, [
            f.acme,
            f.mia.id,
          ]),
        ),
      ).toBe(1)
      const [profile] = await sql<{ active_org_id: string | null }>(
        `select active_org_id from public.profiles where id = $1`,
        [f.mia.id],
      )
      expect(profile?.active_org_id).toBeNull()
    })
  })

  it('keep the last owner: no leaving, demoting or expiring into the past', async () => {
    const leave = as(f.olive, () =>
      affected(`delete from public.memberships where org_id = $1 and user_id = $2`, [
        f.acme,
        f.olive.id,
      ]),
    )
    expect(await failure(leave)).toMatch(/last owner/)
    expect(await failure(setRole(f.olive, f.olive, 'admin'))).toMatch(/last owner/)
    expect(
      await failure(
        as(f.sam, () =>
          affected(
            `update public.memberships set expires_at = now() - interval '1 minute' where org_id = $1 and user_id = $2`,
            [f.acme, f.olive.id],
          ),
        ),
      ),
    ).toMatch(/last owner/)

    await scratch(async () => {
      // A future expiry is allowed: the trigger cannot argue with the clock.
      expect(
        await as(f.sam, () =>
          affected(
            `update public.memberships set expires_at = now() + interval '1 day' where org_id = $1 and user_id = $2`,
            [f.acme, f.olive.id],
          ),
        ),
      ).toBe(1)
    })
    await scratch(async () => {
      expect(await setRole(f.olive, f.grace, 'owner')).toBe(1)
      expect(
        await as(f.olive, () =>
          affected(`delete from public.memberships where org_id = $1 and user_id = $2`, [
            f.acme,
            f.olive.id,
          ]),
        ),
      ).toBe(1)
    })
  })
})

describe('profiles', () => {
  it('are visible to the person, their colleagues and staff', async () => {
    const sees = (viewer: Fixtures['rex'], target: Fixtures['rex']) =>
      as(viewer, () => sql(`select id from public.profiles where id = $1`, [target.id]))
    expect(await sees(f.olive, f.grace)).toHaveLength(1)
    expect(await sees(f.rex, f.grace)).toHaveLength(0)
    expect(await sees(f.sue, f.rex)).toHaveLength(1)
    expect(await sees(f.rex, f.rex)).toHaveLength(1)
  })

  it('stay visible to colleagues after access ends, while the row is still in the list', async () => {
    await scratch(async () => {
      await sql(
        `update public.memberships set expires_at = now() - interval '1 minute' where user_id = $1`,
        [f.mia.id],
      )
      // The owner still sees whose row it is; Mia herself no longer sees anyone at Acme.
      expect(
        await as(f.olive, () => sql(`select id from public.profiles where id = $1`, [f.mia.id])),
      ).toHaveLength(1)
      expect(
        await as(f.mia, () => sql(`select id from public.profiles where id = $1`, [f.olive.id])),
      ).toHaveLength(0)
    })
  })

  it('let people edit their own display name, never their email or anyone else', async () => {
    await scratch(async () => {
      expect(
        await as(f.olive, () =>
          affected(`update public.profiles set display_name = 'O.' where id = $1`, [f.olive.id]),
        ),
      ).toBe(1)
    })
    expect(
      await as(f.olive, () =>
        affected(`update public.profiles set display_name = 'G.' where id = $1`, [f.grace.id]),
      ),
    ).toBe(0)
    expect(
      await failure(
        as(f.olive, () =>
          affected(`update public.profiles set email = 'x@db.test' where id = $1`, [f.olive.id]),
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('only remember an organisation the person belongs to', async () => {
    const [other] = await as(f.rex, () =>
      sql<{ id: string }>(`select id from public.create_organisation('Globex', 'globex-db-test')`),
    )
    expect(
      await failure(
        as(f.olive, () =>
          affected(`update public.profiles set active_org_id = $1 where id = $2`, [
            other!.id,
            f.olive.id,
          ]),
        ),
      ),
    ).toMatch(/must reference an organisation the user belongs to/)
  })

  it('are backfilled for users who predate the trigger, and only by an operator', async () => {
    await scratch(async () => {
      // A user from before on_auth_user_created existed: an auth row with no profile.
      const old = await createUser('old@db.test', 'Old Timer')
      await sql(`delete from public.profiles where id = $1`, [old.id])

      expect(await sql(`select public.backfill_profiles() as n`)).toEqual([{ n: 1 }])
      const [profile] = await sql<{ display_name: string; email: string; providers: string[] }>(
        `select display_name, email, providers from public.profiles where id = $1`,
        [old.id],
      )
      expect(profile).toEqual({
        display_name: 'Old Timer',
        email: 'old@db.test',
        providers: ['email'],
      })
      expect(await sql(`select public.backfill_profiles() as n`)).toEqual([{ n: 0 }])

      expect(await failure(as(f.olive, () => sql(`select public.backfill_profiles()`)))).toMatch(
        /permission denied/,
      )
    })
  })
})
