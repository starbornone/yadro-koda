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
      const [customer] = await sql<{ stage: string; owner_id: string; source: string }>(
        `select stage, owner_id, source from public.customers where org_id = $1`,
        [org!.id],
      )
      expect(customer).toEqual({ stage: 'lead', owner_id: f.pat.id, source: 'event' })
      expect(
        await sql(`select 1 from public.memberships where org_id = $1`, [org!.id]),
      ).toHaveLength(0)
    })
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

  it('never let a client write a stage change or forge the author', async () => {
    expect(
      await failure(
        as(f.sue, () =>
          affected(
            `insert into public.activities (org_id, kind, body) values ($1, 'stage_change', 'x')`,
            [f.acme],
          ),
        ),
      ),
    ).toMatch(/row-level security/)
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
