import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { affected, as, connect, disconnect, failure, scratch, seed, sql, type Fixtures } from './db'

let f: Fixtures

beforeAll(async () => {
  await connect()
  f = await seed()
})
afterAll(disconnect)

const CRM_TABLES = ['customers', 'contacts', 'activities', 'tasks'] as const

describe('the customer record', () => {
  it('is invisible to tenants, table by table', async () => {
    for (const table of CRM_TABLES) {
      expect(await as(f.olive, () => sql(`select * from public.${table}`))).toHaveLength(0)
    }
    expect(await as(f.olive, () => sql(`select * from public.customer_stage_counts`))).toHaveLength(
      0,
    )
    expect(
      await failure(
        as(f.olive, () =>
          sql(`insert into public.contacts (org_id, name) values ($1, 'Someone')`, [f.acme]),
        ),
      ),
    ).toMatch(/row-level security/)
  })

  it('is read by every staff tier', async () => {
    expect(
      await as(f.sue, () => sql(`select org_id from public.customers where org_id = $1`, [f.acme])),
    ).toHaveLength(1)
    expect(
      await as(f.sue, () => sql(`select stage, count from public.customer_stage_counts`)),
    ).toContainEqual({
      stage: 'trial',
      count: expect.any(Number),
    })
  })
})

describe('create_lead()', () => {
  it('starts an organisation at lead, owned by whoever entered it — admins and up only', async () => {
    expect(
      await failure(
        as(f.sue, () => sql(`select public.create_lead('Initech', 'initech-db-test', 'event')`)),
      ),
    ).toMatch(/only platform admins/)
    expect(
      await failure(as(null, () => sql(`select public.create_lead('Initech', 'initech-db-test')`))),
    ).toMatch(/permission denied/)
    await scratch(async () => {
      const [org] = await as(f.pat, () =>
        sql<{ id: string }>(
          `select id from public.create_lead('Initech', 'initech-db-test', '  event ')`,
        ),
      )
      const [customer] = await sql<{
        stage: string
        owner_id: string
        source: string
        details: unknown
      }>(`select stage, owner_id, source, details from public.customers where org_id = $1`, [
        org!.id,
      ])
      expect(customer).toEqual({ stage: 'lead', owner_id: f.pat.id, source: 'event', details: {} })
      expect(
        await sql(`select 1 from public.memberships where org_id = $1`, [org!.id]),
      ).toHaveLength(0)

      // The "start as lead" hint must not leak into later work in the same transaction.
      const [selfServe] = await as(f.rex, () =>
        sql<{ id: string }>(
          `select id from public.create_organisation('Globex', 'globex-db-test')`,
        ),
      )
      const [trial] = await sql<{ stage: string }>(
        `select stage from public.customers where org_id = $1`,
        [selfServe!.id],
      )
      expect(trial?.stage).toBe('trial')
    })
  })

  it('takes the product’s details along', async () => {
    await scratch(async () => {
      const [org] = await as(f.pat, () =>
        sql<{ id: string }>(
          `select id from public.create_lead('Initech', 'initech-db-test', null, $1::jsonb)`,
          [JSON.stringify({ seats: 25, interests: ['core'] })],
        ),
      )
      const [customer] = await sql<{ details: unknown }>(
        `select details from public.customers where org_id = $1`,
        [org!.id],
      )
      expect(customer?.details).toEqual({ seats: 25, interests: ['core'] })
    })
  })
})

describe('customer details', () => {
  const setDetails = (actor: Fixtures['rex'], details: string) =>
    as(actor, () =>
      affected(`update public.customers set details = $2::jsonb where org_id = $1`, [
        f.acme,
        details,
      ]),
    )

  it('are an object of modest size, whatever the product puts in it', async () => {
    expect(await failure(setDetails(f.pat, '[1, 2]'))).toMatch(/customers_details_check/)
    expect(await failure(setDetails(f.pat, '"text"'))).toMatch(/customers_details_check/)
    expect(await failure(setDetails(f.pat, JSON.stringify({ big: 'x'.repeat(20_000) })))).toMatch(
      /customers_details_check/,
    )
    await scratch(async () => {
      expect(await setDetails(f.pat, JSON.stringify({ seats: 3, nested: { ok: true } }))).toBe(1)
    })
  })

  it('are edited by the tiers that manage customers, read by all staff, and never by tenants', async () => {
    expect(await setDetails(f.sue, '{"seats": 1}')).toBe(0)
    expect(
      await as(f.sue, () =>
        sql(`select details from public.customers where org_id = $1`, [f.acme]),
      ),
    ).toEqual([{ details: {} }])
    expect(
      await as(f.olive, () =>
        sql(`select details from public.customers where org_id = $1`, [f.acme]),
      ),
    ).toHaveLength(0)
  })
})

describe('the pipeline', () => {
  const setStage = (actor: Fixtures['rex'], stage: string) =>
    as(actor, () =>
      affected(`update public.customers set stage = $2 where org_id = $1`, [f.acme, stage]),
    )

  it('moves only for admins and up, and every move is logged as them', async () => {
    expect(await setStage(f.sue, 'active')).toBe(0)
    await scratch(async () => {
      expect(await setStage(f.pat, 'active')).toBe(1)
      const [entry] = await sql<{ kind: string; body: string; created_by: string }>(
        `select kind, body, created_by from public.activities where org_id = $1 and kind = 'stage_change'`,
        [f.acme],
      )
      expect(entry).toEqual({
        kind: 'stage_change',
        body: 'Stage changed from trial to active',
        created_by: f.pat.id,
      })
    })
  })

  it('only exposes stage, owner and source to clients', async () => {
    expect(
      await failure(
        as(f.sam, () =>
          affected(`update public.customers set created_at = now() where org_id = $1`, [f.acme]),
        ),
      ),
    ).toMatch(/permission denied/)
    expect(
      await failure(
        as(f.sam, () => affected(`delete from public.customers where org_id = $1`, [f.acme])),
      ),
    ).toMatch(/permission denied/)
  })
})

describe('joins on the timeline', () => {
  it('record every membership as the person who joined', async () => {
    // Grace and Mia were added to Acme directly by the seed: no RPC, so no "how".
    const rows = await sql<{ body: string; created_by: string }>(
      `select body, created_by from public.activities where org_id = $1 and kind = 'joined' order by body`,
      [f.acme],
    )
    expect(rows).toEqual(
      expect.arrayContaining([
        { body: 'Created the organisation', created_by: f.olive.id },
        { body: 'Joined as admin', created_by: f.grace.id },
        { body: 'Joined as member', created_by: f.mia.id },
      ]),
    )
    expect(rows).toHaveLength(3)
  })

  it('are readable by staff and removable by managers, like any other entry', async () => {
    const [entry] = await sql<{ id: string }>(
      `select id from public.activities where org_id = $1 and kind = 'joined' and created_by = $2`,
      [f.acme, f.mia.id],
    )
    expect(
      await as(f.sue, () => sql(`select id from public.activities where id = $1`, [entry!.id])),
    ).toHaveLength(1)
    expect(
      await as(f.sue, () => affected(`delete from public.activities where id = $1`, [entry!.id])),
    ).toBe(0)
    await scratch(async () => {
      expect(
        await as(f.pat, () => affected(`delete from public.activities where id = $1`, [entry!.id])),
      ).toBe(1)
    })
  })
})

describe('contacts, activities and tasks', () => {
  it('are logged by any staff tier, as themselves', async () => {
    await scratch(async () => {
      const [contact] = await as(f.sue, () =>
        sql<{ created_by: string }>(
          `insert into public.contacts (org_id, name, is_primary) values ($1, 'Rex', true) returning created_by`,
          [f.acme],
        ),
      )
      expect(contact?.created_by).toBe(f.sue.id)
      expect(
        await as(f.sue, () =>
          affected(
            `insert into public.activities (org_id, kind, body) values ($1, 'call', 'Spoke to Rex')`,
            [f.acme],
          ),
        ),
      ).toBe(1)
      expect(
        await as(f.sue, () =>
          affected(
            `insert into public.tasks (org_id, title, assigned_to) values ($1, 'Follow up', $2)`,
            [f.acme, f.pat.id],
          ),
        ),
      ).toBe(1)
    })
  })

  it('never let a client write a stage change or a join, or forge the author', async () => {
    for (const kind of ['stage_change', 'joined']) {
      expect(
        await failure(
          as(f.sue, () =>
            affected(`insert into public.activities (org_id, kind, body) values ($1, $2, 'x')`, [
              f.acme,
              kind,
            ]),
          ),
        ),
      ).toMatch(/row-level security/)
    }
    expect(
      await failure(
        as(f.sue, () =>
          affected(
            `insert into public.activities (org_id, kind, body, created_by) values ($1, 'note', 'x', $2)`,
            [f.acme, f.pat.id],
          ),
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('are removed by their author or a manager, and edited only by their author', async () => {
    await scratch(async () => {
      const [note] = await as(f.pat, () =>
        sql<{ id: string }>(
          `insert into public.activities (org_id, body) values ($1, 'Pat’s note') returning id`,
          [f.acme],
        ),
      )
      const [contact] = await as(f.pat, () =>
        sql<{ id: string }>(
          `insert into public.contacts (org_id, name) values ($1, 'Pat’s contact') returning id`,
          [f.acme],
        ),
      )
      expect(
        await as(f.sue, () =>
          affected(`update public.activities set body = 'edited' where id = $1`, [note!.id]),
        ),
      ).toBe(0)
      expect(
        await as(f.sue, () => affected(`delete from public.activities where id = $1`, [note!.id])),
      ).toBe(0)
      expect(
        await as(f.sue, () => affected(`delete from public.contacts where id = $1`, [contact!.id])),
      ).toBe(0)
      expect(
        await as(f.pat, () =>
          affected(`update public.activities set body = 'edited' where id = $1`, [note!.id]),
        ),
      ).toBe(1)
      expect(
        await as(f.sam, () => affected(`delete from public.activities where id = $1`, [note!.id])),
      ).toBe(1)
      expect(
        await as(f.sam, () => affected(`delete from public.contacts where id = $1`, [contact!.id])),
      ).toBe(1)
    })
  })

  it('keep one primary contact per organisation', async () => {
    await scratch(async () => {
      const [first] = await as(f.sue, () =>
        sql<{ id: string }>(
          `insert into public.contacts (org_id, name, is_primary) values ($1, 'A', true) returning id`,
          [f.acme],
        ),
      )
      await as(f.sue, () =>
        sql(`insert into public.contacts (org_id, name, is_primary) values ($1, 'B', true)`, [
          f.acme,
        ]),
      )
      const [demoted] = await sql<{ is_primary: boolean }>(
        `select is_primary from public.contacts where id = $1`,
        [first!.id],
      )
      expect(demoted?.is_primary).toBe(false)
    })
  })

  it('go with the organisation when it is deleted', async () => {
    await scratch(async () => {
      await as(f.sue, () =>
        sql(`insert into public.contacts (org_id, name) values ($1, 'Gone')`, [f.acme]),
      )
      await as(f.sue, () =>
        sql(`insert into public.tasks (org_id, title) values ($1, 'Gone')`, [f.acme]),
      )
      expect(
        await as(f.olive, () =>
          affected(`delete from public.organisations where id = $1`, [f.acme]),
        ),
      ).toBe(1)
      for (const table of CRM_TABLES) {
        expect(await sql(`select 1 from public.${table} where org_id = $1`, [f.acme])).toHaveLength(
          0,
        )
      }
    })
  })
})
