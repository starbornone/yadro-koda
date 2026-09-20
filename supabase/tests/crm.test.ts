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
    expect(
      await as(f.olive, () => sql(`select * from public.customer_stage_summary`)),
    ).toHaveLength(0)
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
      await as(f.sue, () => sql(`select stage, count, value from public.customer_stage_summary`)),
    ).toContainEqual({
      stage: 'trial',
      count: expect.any(Number),
      value: expect.any(String),
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

describe('submit_enquiry()', () => {
  // Calls come from an address; the gateway tells the database which in a header.
  const from = (ip: string) =>
    sql(`select set_config('request.headers', $1, true)`, [
      JSON.stringify({ 'x-forwarded-for': ip }),
    ])
  const enquire = (email: string, extra: Record<string, unknown> = {}) =>
    as(null, () =>
      sql(
        `select public.submit_enquiry(
           organisation => $1, contact_name => $2, email => $3, phone => $4, message => $5,
           details => $6::jsonb, website_url => $7
         )`,
        [
          extra.organisation ?? 'Initech Pty Ltd',
          extra.contact_name ?? ' Peter Gibbons ',
          email,
          extra.phone ?? null,
          extra.message ?? null,
          JSON.stringify(extra.details ?? {}),
          extra.website_url ?? null,
        ],
      ),
    )
  const leadsNamed = (name: string) =>
    sql<{ id: string; slug: string }>(`select id, slug from public.organisations where name = $1`, [
      name,
    ])

  it('turns a visitor into a lead with a contact and an entry, telling them nothing', async () => {
    await scratch(async () => {
      await from('203.0.113.7')
      expect(
        await enquire('Peter@Initech.test', {
          phone: ' 0400 000 000 ',
          message: '  We have 30 participants. ',
          details: { seats: 12, interests: ['core'] },
        }),
      ).toEqual([{ submit_enquiry: '' }])

      const [org] = await leadsNamed('Initech Pty Ltd')
      expect(org?.slug).toBe('initech-pty-ltd')
      const [customer] = await sql<{ stage: string; source: string; details: unknown }>(
        `select stage, source, details from public.customers where org_id = $1`,
        [org!.id],
      )
      expect(customer).toEqual({
        stage: 'lead',
        source: 'website',
        details: { seats: 12, interests: ['core'] },
      })
      const contacts = await sql(
        `select name, email, phone, is_primary, created_by from public.contacts where org_id = $1`,
        [org!.id],
      )
      expect(contacts).toEqual([
        {
          name: 'Peter Gibbons',
          email: 'peter@initech.test',
          phone: '0400 000 000',
          is_primary: true,
          created_by: null,
        },
      ])
      const entries = await sql<{ kind: string; body: string; created_by: string | null }>(
        `select kind, body, created_by from public.activities where org_id = $1`,
        [org!.id],
      )
      expect(entries).toEqual([
        {
          kind: 'enquiry',
          body: 'Enquired through the website: We have 30 participants.',
          created_by: null,
        },
      ])
      // Nobody joined, and the attempt is on record.
      expect(
        await sql(`select 1 from public.memberships where org_id = $1`, [org!.id]),
      ).toHaveLength(0)
      expect(
        await sql(`select 1 from public.enquiry_attempts where email = 'peter@initech.test'`),
      ).toHaveLength(1)
    })
  })

  it('takes a taken slug in its stride, and a name that makes no slug', async () => {
    await scratch(async () => {
      await from('203.0.113.8')
      await enquire('one@initech.test', { organisation: 'Acme' })
      await enquire('two@initech.test', { organisation: 'Acme' })
      const slugs = (
        await sql<{ slug: string }>(`select slug from public.organisations where name = 'Acme'`)
      )
        .map((row) => row.slug)
        .sort()
      // The seed's Acme, then the plain slug, then one with a suffix.
      expect(slugs).toHaveLength(3)
      expect(slugs).toContain('acme')
      expect(slugs.filter((slug) => /^acme-[0-9a-f]{4}$/.test(slug))).toHaveLength(1)

      await enquire('three@initech.test', { organisation: '!!!' })
      expect((await leadsNamed('!!!'))[0]?.slug).toBe('enquiry')
    })
  })

  it('says nothing to a bot, and nothing to the same person twice in a day', async () => {
    await scratch(async () => {
      await from('203.0.113.9')
      await enquire('bot@initech.test', { website_url: 'https://spam.example' })
      expect(await leadsNamed('Initech Pty Ltd')).toHaveLength(0)

      await enquire('peter@initech.test')
      await enquire('PETER@initech.test', { organisation: 'Initech again' })
      expect(await leadsNamed('Initech Pty Ltd')).toHaveLength(1)
      expect(await leadsNamed('Initech again')).toHaveLength(0)
    })
  })

  it('refuses a twenty-first enquiry in an hour from one address, and bad input', async () => {
    await scratch(async () => {
      await from('203.0.113.10')
      for (let n = 1; n <= 20; n += 1) await enquire(`p${n}@initech.test`)
      expect(await failure(enquire('p21@initech.test'))).toMatch(/too many enquiries/)
      // Another address is fine.
      await from('203.0.113.11')
      await enquire('p21@initech.test')
      expect(await leadsNamed('Initech Pty Ltd')).toHaveLength(21)
    })
    await from('203.0.113.12')
    expect(await failure(enquire('not-an-email'))).toMatch(/email address is not valid/)
    expect(await failure(enquire('x@y.z', { organisation: '   ' }))).toMatch(/organisation name/)
    expect(await failure(enquire('x@y.z', { contact_name: 'x'.repeat(101) }))).toMatch(
      /contact name/,
    )
    await sql(`select set_config('request.headers', '', true)`)
  })

  it('keeps its attempts table to itself', async () => {
    expect(await failure(as(f.sam, () => sql(`select * from public.enquiry_attempts`)))).toMatch(
      /permission denied/,
    )
    expect(await failure(as(null, () => sql(`select * from public.enquiry_attempts`)))).toMatch(
      /permission denied/,
    )
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

  it('keeps the dates of its own: when the stage changed, and when the customer was won', async () => {
    await scratch(async () => {
      const dates = () =>
        sql<{ stage_changed_at: Date; won_at: Date | null; now: Date }>(
          `select stage_changed_at, won_at, now() as now from public.customers where org_id = $1`,
          [f.acme],
        )
      // As if the stage had been entered yesterday. (now() is fixed for the test's transaction.)
      await sql(
        `update public.customers set stage_changed_at = now() - interval '1 day' where org_id = $1`,
        [f.acme],
      )
      const [before] = await dates()
      expect(before?.won_at).toBeNull()

      // A change that is not the stage leaves both alone.
      await as(f.pat, () =>
        affected(`update public.customers set plan = 'Small' where org_id = $1`, [f.acme]),
      )
      expect((await dates())[0]).toEqual(before)

      // Winning stamps both; moving on again restamps the stage's date and keeps the win.
      expect(await setStage(f.pat, 'active')).toBe(1)
      const [won] = await dates()
      expect(won!.stage_changed_at).toEqual(won!.now)
      expect(won!.won_at).toEqual(won!.now)

      await sql(
        `update public.customers set stage_changed_at = now() - interval '1 day' where org_id = $1`,
        [f.acme],
      )
      await setStage(f.pat, 'churned')
      const [churned] = await dates()
      expect(churned!.stage_changed_at).toEqual(churned!.now)
      expect(churned!.won_at).toEqual(won!.won_at)

      // Nobody sets them by hand.
      expect(
        await failure(
          as(f.pat, () =>
            affected(`update public.customers set won_at = now() where org_id = $1`, [f.acme]),
          ),
        ),
      ).toMatch(/permission denied/)
    })
  })

  it('holds the commercial facts for admins and up, within reason', async () => {
    const setFacts = (actor: Fixtures['rex'], set: string) =>
      as(actor, () => affected(`update public.customers set ${set} where org_id = $1`, [f.acme]))
    expect(await setFacts(f.sue, `plan = 'Small'`)).toBe(0)
    await scratch(async () => {
      expect(
        await setFacts(
          f.pat,
          `plan = 'Small', annual_value = 5000, expected_close = '2027-03-31', renews_on = null, outcome_reason = null`,
        ),
      ).toBe(1)
      const [facts] = await sql(
        `select plan, annual_value, expected_close::text from public.customers where org_id = $1`,
        [f.acme],
      )
      expect(facts).toEqual({
        plan: 'Small',
        annual_value: '5000.00',
        expected_close: '2027-03-31',
      })
      // The view sums it into the stage.
      const rows = await as(f.sue, () =>
        sql<{ stage: string; value: string }>(
          `select stage, value from public.customer_stage_summary where stage = 'trial'`,
        ),
      )
      expect(Number(rows[0]?.value)).toBeGreaterThanOrEqual(5000)
    })
    expect(await failure(setFacts(f.pat, `annual_value = -1`))).toMatch(
      /customers_annual_value_check/,
    )
    expect(await failure(setFacts(f.pat, `plan = ''`))).toMatch(/customers_plan_check/)
    expect(await failure(setFacts(f.pat, `outcome_reason = repeat('x', 501)`))).toMatch(
      /customers_outcome_reason_check/,
    )
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

  it('never let a client write a stage change, a join or an enquiry, or forge the author', async () => {
    for (const kind of ['stage_change', 'joined', 'enquiry']) {
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
