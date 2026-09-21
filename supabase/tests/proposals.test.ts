import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  affected,
  as,
  connect,
  disconnect,
  failure,
  scratch,
  seed,
  sql,
  type Fixtures,
  type TestUser,
} from './db'

let f: Fixtures
/** A lead with no members, entered by Pat, with Rex as its contact. */
let initech: string

beforeAll(async () => {
  await connect()
  f = await seed()
  const [org] = await as(f.pat, () =>
    sql<{ id: string }>(`select id from public.create_lead('Initech', 'initech-db-test')`),
  )
  initech = org!.id
  await as(f.pat, () =>
    sql(`insert into public.contacts (org_id, name, email) values ($1, 'Rex Outsider', $2)`, [
      initech,
      f.rex.email,
    ]),
  )
})
afterAll(disconnect)

type Proposal = {
  id: string
  token: string
  status: string
  total_amount: string
  annual_amount: string
  expires_at: string | null
}

const PROPOSAL_COLUMNS = 'id, token, status, total_amount, annual_amount, expires_at'

const draft = (actor: TestUser, orgId = initech, email = f.rex.email) =>
  as(actor, () =>
    sql<Proposal>(
      `insert into public.proposals (org_id, email, title)
       values ($1, $2, 'Verification pathway') returning ${PROPOSAL_COLUMNS}`,
      [orgId, email],
    ),
  )

const addLine = (
  actor: TestUser,
  proposalId: string,
  description: string,
  kind: string,
  unitAmount: number,
  quantity = 1,
) =>
  as(actor, () =>
    sql<{ id: string }>(
      `insert into public.proposal_lines (proposal_id, description, kind, quantity, unit_amount, position)
       values ($1, $2, $3, $4, $5, (select count(*) from public.proposal_lines where proposal_id = $1))
       returning id`,
      [proposalId, description, kind, quantity, unitAmount],
    ),
  )

const read = (id: string) =>
  sql<Proposal>(`select ${PROPOSAL_COLUMNS} from public.proposals where id = $1`, [id]).then(
    (rows) => rows[0]!,
  )

const send = (actor: TestUser | null, proposalId: string, validUntil: string | null = null) =>
  as(actor, () =>
    sql<Proposal>(`select ${PROPOSAL_COLUMNS} from public.send_proposal($1, $2)`, [
      proposalId,
      validUntil,
    ]),
  )

/** A sent proposal to Rex for Initech: setup fee, an annual plan and a monthly add-on. */
const sentProposal = async () => {
  const [row] = await draft(f.pat)
  await addLine(f.pat, row!.id, 'Setup', 'one_off', 500)
  await addLine(f.pat, row!.id, 'Small provider', 'annual', 5000)
  await addLine(f.pat, row!.id, 'Frontline seats', 'monthly', 25, 4)
  await send(f.pat, row!.id)
  return read(row!.id)
}

const accept = (user: TestUser | null, token: string, from: string | null = null) =>
  as(user, () => sql(`select public.accept_proposal($1, $2)`, [token, from]))

const decline = (user: TestUser | null, token: string, reason: string | null = null) =>
  as(user, () => sql(`select public.decline_proposal($1, $2)`, [token, reason]))

const preview = (token: string) =>
  as(null, () => sql<Record<string, unknown>>(`select * from public.get_proposal($1)`, [token]))

describe('the price book', () => {
  it('is maintained by managers and read by every staff tier', async () => {
    const add = (actor: TestUser) =>
      as(actor, () =>
        sql(
          `insert into public.price_book_items (code, name, kind, unit_amount)
           values ('small', 'Small provider', 'annual', 5000) returning id`,
        ),
      )
    expect(await failure(add(f.sue))).toMatch(/row-level security/)
    expect(await failure(add(f.olive))).toMatch(/row-level security/)
    await scratch(async () => {
      expect(await add(f.pat)).toHaveLength(1)
      const seenBy = (user: TestUser) =>
        as(user, () => sql(`select id from public.price_book_items where code = 'small'`))
      expect(await seenBy(f.sue)).toHaveLength(1)
      expect(await seenBy(f.olive)).toHaveLength(0)
    })
  })

  it('wants a slug-like code and a non-negative price', async () => {
    const add = (code: string, amount: number) =>
      as(f.pat, () =>
        sql(
          `insert into public.price_book_items (code, name, kind, unit_amount) values ($1, 'x', 'one_off', $2)`,
          [code, amount],
        ),
      )
    expect(await failure(add('Not A Code', 1))).toMatch(/check constraint/)
    expect(await failure(add('minus', -1))).toMatch(/check constraint/)
  })
})

describe('drafting', () => {
  it('is for managers; every staff tier reads, tenants and outsiders do not', async () => {
    expect(await failure(draft(f.sue))).toMatch(/row-level security/)
    expect(await failure(draft(f.olive, f.acme))).toMatch(/row-level security/)
    await scratch(async () => {
      const [row] = await draft(f.pat)
      expect(row).toMatchObject({ status: 'draft', total_amount: '0.00', expires_at: null })
      const seenBy = (user: TestUser) =>
        as(user, () => sql(`select id from public.proposals where id = $1`, [row!.id]))
      expect(await seenBy(f.sue)).toHaveLength(1)
      expect(await seenBy(f.olive)).toHaveLength(0)
      expect(await seenBy(f.rex)).toHaveLength(0)
    })
  })

  it('wants a lower-cased address', async () => {
    expect(await failure(draft(f.pat, initech, 'Rex@DB.test'))).toMatch(/check constraint/)
  })

  it('keeps the totals from the lines: annual once, monthly twelve times, one-off never', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat)
      await addLine(f.pat, row!.id, 'Setup', 'one_off', 500)
      const [seat] = await addLine(f.pat, row!.id, 'Seats', 'monthly', 25, 4)
      await addLine(f.pat, row!.id, 'Plan', 'annual', 5000)
      expect(await read(row!.id)).toMatchObject({
        total_amount: '5600.00',
        annual_amount: '6200.00',
      })

      await as(f.pat, () =>
        affected(`update public.proposal_lines set quantity = 10 where id = $1`, [seat!.id]),
      )
      expect(await read(row!.id)).toMatchObject({
        total_amount: '5750.00',
        annual_amount: '8000.00',
      })

      await as(f.pat, () => affected(`delete from public.proposal_lines where id = $1`, [seat!.id]))
      expect(await read(row!.id)).toMatchObject({
        total_amount: '5500.00',
        annual_amount: '5000.00',
      })
    })
  })

  it('never lets a client write the totals or the status directly', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat)
      expect(
        await failure(
          as(f.pat, () =>
            sql(`update public.proposals set total_amount = 1 where id = $1`, [row!.id]),
          ),
        ),
      ).toMatch(/permission denied/)
      expect(
        await failure(
          as(f.pat, () =>
            sql(`update public.proposals set status = 'sent' where id = $1`, [row!.id]),
          ),
        ),
      ).toMatch(/permission denied/)
    })
  })
})

describe('send_proposal()', () => {
  it('needs a manager and at least one line, then freezes the proposal', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat)
      expect(await failure(send(f.pat, row!.id))).toMatch(/at least one line/)
      await addLine(f.pat, row!.id, 'Plan', 'annual', 5000)
      expect(await failure(send(f.sue, row!.id))).toMatch(/only platform admins/)
      expect(await failure(send(f.pat, randomUUID()))).toMatch(/not found/)
      expect(await failure(send(f.pat, row!.id, '2000-01-01T00:00:00Z'))).toMatch(
        /already have expired/,
      )

      const [sent] = await send(f.pat, row!.id)
      expect(sent!.status).toBe('sent')
      const daysLeft = (Date.parse(sent!.expires_at!) - Date.now()) / 86_400_000
      expect(daysLeft).toBeGreaterThan(29)
      expect(daysLeft).toBeLessThanOrEqual(30)

      // Frozen: no more lines, no edits, no deletion, no second send.
      expect(await failure(addLine(f.pat, row!.id, 'Late', 'one_off', 1))).toMatch(
        /row-level security/,
      )
      expect(
        await as(f.pat, () =>
          affected(`update public.proposals set title = 'Changed' where id = $1`, [row!.id]),
        ),
      ).toBe(0)
      expect(
        await as(f.pat, () => affected(`delete from public.proposals where id = $1`, [row!.id])),
      ).toBe(0)
      expect(await failure(send(f.pat, row!.id))).toMatch(/only a draft/)

      // And it is on the timeline, as the sender.
      const [entry] = await sql<{ body: string; created_by: string }>(
        `select body, created_by from public.activities where org_id = $1 and kind = 'proposal'`,
        [initech],
      )
      expect(entry).toMatchObject({
        body: `Sent proposal “Verification pathway” to ${f.rex.email}`,
        created_by: f.pat.id,
      })
    })
  })

  it('allows one sent proposal per organisation at a time', async () => {
    await scratch(async () => {
      await sentProposal()
      const [second] = await draft(f.pat)
      await addLine(f.pat, second!.id, 'Plan', 'annual', 1)
      expect(await failure(send(f.pat, second!.id))).toMatch(/proposals_one_sent_per_org/)
    })
  })

  it('takes a validity date', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat)
      await addLine(f.pat, row!.id, 'Plan', 'annual', 1)
      const [sent] = await send(f.pat, row!.id, '2030-06-01T00:00:00Z')
      expect(new Date(sent!.expires_at!).toISOString()).toBe('2030-06-01T00:00:00.000Z')
    })
  })
})

describe('get_proposal()', () => {
  it('shows anyone holding the link what is offered, and no more', async () => {
    await scratch(async () => {
      const sent = await sentProposal()
      const rows = await preview(sent.token)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        organisation_name: 'Initech',
        title: 'Verification pathway',
        email: f.rex.email,
        status: 'sent',
        sent_by_name: 'Pat Admin',
        total_amount: '5600.00',
        annual_amount: '6200.00',
        accepted_at: null,
      })
      expect(rows[0]!.lines).toEqual([
        { description: 'Setup', kind: 'one_off', quantity: 1, unit_amount: 500, amount: 500 },
        {
          description: 'Small provider',
          kind: 'annual',
          quantity: 1,
          unit_amount: 5000,
          amount: 5000,
        },
        {
          description: 'Frontline seats',
          kind: 'monthly',
          quantity: 4,
          unit_amount: 25,
          amount: 100,
        },
      ])
      expect(Object.keys(rows[0]!)).not.toContain('token')
    })
  })

  it('does not show drafts or unknown links', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat)
      expect(await preview(row!.token)).toHaveLength(0)
      expect(await preview(randomUUID())).toHaveLength(0)
    })
  })
})

describe('accept_proposal()', () => {
  it('needs a session with the addressed email and an open, unexpired proposal', async () => {
    await scratch(async () => {
      const sent = await sentProposal()
      expect(await failure(accept(null, sent.token))).toMatch(/permission denied/)
      expect(await failure(accept(f.nina, sent.token))).toMatch(/different email/)
      expect(await failure(accept(f.rex, randomUUID()))).toMatch(/not found/)

      await sql(
        `update public.proposals set expires_at = now() - interval '1 minute' where id = $1`,
        [sent.id],
      )
      expect(await failure(accept(f.rex, sent.token))).toMatch(/expired/)
    })
  })

  it('makes the recipient the owner and wins the customer, with the signature on the record', async () => {
    await scratch(async () => {
      const sent = await sentProposal()
      const [org] = await accept(f.rex, sent.token, '203.0.113.9 Mozilla/5.0')
      expect(org).toBeTruthy()

      expect(
        (
          await sql(
            `select accepted_by, accepted_from, status from public.proposals where id = $1`,
            [sent.id],
          )
        )[0],
      ).toMatchObject({
        accepted_by: f.rex.id,
        accepted_from: '203.0.113.9 Mozilla/5.0',
        status: 'accepted',
      })

      expect(
        await sql(`select role from public.memberships where org_id = $1 and user_id = $2`, [
          initech,
          f.rex.id,
        ]),
      ).toEqual([{ role: 'owner' }])

      const [customer] = await sql<{
        stage: string
        plan: string
        annual_value: string
        renews_on: string
        won_at: string | null
        expected_close: string | null
      }>(
        `select stage, plan, annual_value, renews_on::text, won_at, expected_close from public.customers where org_id = $1`,
        [initech],
      )
      expect(customer).toMatchObject({
        stage: 'active',
        plan: 'Small provider',
        annual_value: '6200.00',
        expected_close: null,
      })
      expect(customer!.won_at).not.toBeNull()
      const nextYear = new Date()
      nextYear.setFullYear(nextYear.getFullYear() + 1)
      expect(customer!.renews_on).toBe(nextYear.toISOString().slice(0, 10))

      const bodies = await sql<{ kind: string; body: string; created_by: string }>(
        `select kind, body, created_by from public.activities where org_id = $1 order by occurred_at, created_at`,
        [initech],
      )
      expect(bodies).toEqual(
        expect.arrayContaining([
          {
            kind: 'proposal',
            body: 'Accepted proposal “Verification pathway”',
            created_by: f.rex.id,
          },
          {
            kind: 'joined',
            body: 'Accepted a proposal and became the owner',
            created_by: f.rex.id,
          },
        ]),
      )

      expect(
        await sql(`select active_org_id from public.profiles where id = $1`, [f.rex.id]),
      ).toEqual([{ active_org_id: initech }])

      // Once is enough.
      expect(await failure(accept(f.rex, sent.token))).toMatch(/no longer open/)
    })
  })

  it('leaves an existing member’s role alone', async () => {
    await scratch(async () => {
      const [row] = await draft(f.pat, f.acme, f.grace.email)
      await addLine(f.pat, row!.id, 'Plan', 'annual', 7500)
      const [sent] = await send(f.pat, row!.id)
      await accept(f.grace, sent!.token)
      expect(
        await sql(`select role from public.memberships where org_id = $1 and user_id = $2`, [
          f.acme,
          f.grace.id,
        ]),
      ).toEqual([{ role: 'admin' }])
      expect(
        await sql(`select annual_value from public.customers where org_id = $1`, [f.acme]),
      ).toEqual([{ annual_value: '7500.00' }])
    })
  })
})

describe('decline_proposal()', () => {
  it('records the answer and the reason, and leaves the stage to staff', async () => {
    await scratch(async () => {
      const sent = await sentProposal()
      expect(await failure(decline(f.nina, sent.token))).toMatch(/different email/)
      await decline(f.rex, sent.token, '  Too expensive this year. ')

      expect(
        (
          await sql(`select status, declined_reason from public.proposals where id = $1`, [sent.id])
        )[0],
      ).toEqual({ status: 'declined', declined_reason: 'Too expensive this year.' })
      expect(await sql(`select stage from public.customers where org_id = $1`, [initech])).toEqual([
        { stage: 'lead' },
      ])
      expect(
        await sql(`select 1 from public.memberships where org_id = $1 and user_id = $2`, [
          initech,
          f.rex.id,
        ]),
      ).toHaveLength(0)
      expect(
        await sql(`select body from public.activities where org_id = $1 and created_by = $2`, [
          initech,
          f.rex.id,
        ]),
      ).toEqual([{ body: 'Declined proposal “Verification pathway”: Too expensive this year.' }])
      expect(await failure(accept(f.rex, sent.token))).toMatch(/no longer open/)
    })
  })
})

describe('withdraw_proposal()', () => {
  it('takes a sent proposal back; the link then shows it closed', async () => {
    await scratch(async () => {
      const sent = await sentProposal()
      const withdraw = (actor: TestUser, id: string) =>
        as(actor, () => sql<Proposal>(`select status from public.withdraw_proposal($1)`, [id]))
      expect(await failure(withdraw(f.sue, sent.id))).toMatch(/only platform admins/)
      expect((await withdraw(f.pat, sent.id))[0]).toMatchObject({ status: 'withdrawn' })
      expect(await failure(withdraw(f.pat, sent.id))).toMatch(/only a sent proposal/)
      expect((await preview(sent.token))[0]).toMatchObject({ status: 'withdrawn' })
      expect(await failure(accept(f.rex, sent.token))).toMatch(/no longer open/)
      // The organisation is free to receive another.
      const [next] = await draft(f.pat)
      await addLine(f.pat, next!.id, 'Plan', 'annual', 1)
      expect(await send(f.pat, next!.id)).toHaveLength(1)
    })
  })
})

describe('the timeline', () => {
  it('never takes a proposal entry from a client', async () => {
    expect(
      await failure(
        as(f.pat, () =>
          sql(
            `insert into public.activities (org_id, kind, body) values ($1, 'proposal', 'Faked')`,
            [initech],
          ),
        ),
      ),
    ).toMatch(/row-level security/)
  })
})
