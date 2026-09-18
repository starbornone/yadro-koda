import { type Person } from './support/people'
import { expect, test } from './support/test'

// The platform's own people looking across tenants: the overview, one customer's record with
// the timeline the database writes, the feed of it all, growing the team, and choosing between
// two hats.
test.describe.configure({ mode: 'serial' })

test.describe('the staff area', () => {
  let sam: Person
  let tessa: Person
  let olive: Person
  let org: { id: string; name: string; slug: string }
  let inviteLink: string

  test.beforeAll(async ({ people }) => {
    sam = await people.create('Sam Staff')
    await people.makeStaff(sam, 'admin')
    tessa = await people.create('Tessa Support')
    olive = await people.create('Olive Owner')
    org = await people.createOrganisation(olive, 'Acme Rockets')
  })

  test('staff go straight to the overview and find an organisation in the list', async ({ as }) => {
    const page = await as(sam)
    await page.goto('/accounts')
    await expect(page).toHaveURL('/staff')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    await page.goto('/staff/organisations')
    await page.getByLabel('Search organisations').fill(org.slug)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    const row = page.getByRole('row', { name: org.slug })
    await expect(row).toContainText('Trial')
    await row.getByRole('link', { name: org.name }).click()
    await expect(page).toHaveURL(`/staff/organisations/${org.id}`)
  })

  test('the customer record shows the founding on the timeline, and takes a note', async ({
    as,
  }) => {
    const page = await as(sam)
    await page.goto(`/staff/organisations/${org.id}`)
    await expect(page.getByRole('heading', { name: org.name })).toBeVisible()

    // What the database wrote when Olive created it.
    const timeline = page.getByRole('list').filter({ hasText: 'Created the organisation' })
    await expect(timeline).toContainText(`${olive.name} · Joined`)

    await page.getByLabel('What happened').fill('Called to welcome them aboard.')
    await page.getByRole('button', { name: 'Log activity' }).click()
    await expect(timeline).toContainText('Called to welcome them aboard.')
    await expect(timeline).toContainText(`${sam.name} · Note`)

    // Both entries are now the latest thing on the overview, each pointing back here.
    await page.goto('/staff')
    const latest = page.getByRole('region', { name: 'Latest' })
    const note = latest.getByRole('listitem').filter({ hasText: 'Called to welcome them aboard.' })
    await expect(note).toContainText(`${sam.name} · Note · ${org.name} · `)
    await note.getByRole('link', { name: org.name }).click()
    await expect(page).toHaveURL(`/staff/organisations/${org.id}`)
  })

  test('the team grows by invitation, and the newcomer lands in the staff area', async ({ as }) => {
    const page = await as(sam)
    await page.goto('/staff/team')
    await page.getByLabel('Email', { exact: true }).fill(tessa.email)
    await page.getByLabel('Role', { exact: true }).selectOption('support')
    await page.getByRole('button', { name: 'Create invitation' }).click()
    inviteLink = await page.getByLabel(`Invitation link for ${tessa.email}`).inputValue()

    const tessaPage = await as(tessa)
    await tessaPage.goto(inviteLink)
    await expect(tessaPage.getByRole('heading', { name: 'Join the staff team?' })).toBeVisible()
    await expect(tessaPage.getByText(`${sam.name} invited you to join as support.`)).toBeVisible()
    await tessaPage.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(tessaPage).toHaveURL('/staff')

    // Support sees the record; only the tiers that move the pipeline may edit it.
    await tessaPage.goto(`/staff/organisations/${org.id}`)
    await expect(tessaPage.getByRole('heading', { name: org.name })).toBeVisible()
    await expect(tessaPage.getByRole('button', { name: 'Log activity' })).toBeVisible()
    await expect(tessaPage.getByRole('heading', { name: 'Invitations' })).toHaveCount(0)

    await page.goto('/staff/team')
    await expect(page.getByRole('row', { name: tessa.email })).toContainText('Support')
  })

  test('someone who is both staff and a member chooses where to go', async ({ as, people }) => {
    await people.join(sam, org.id, 'member')

    const page = await as(sam)
    await page.goto('/accounts')
    await expect(page.getByRole('heading', { name: 'Choose an account' })).toBeVisible()
    await page.getByRole('button', { name: org.name }).click()
    await expect(page).toHaveURL('/app')
    await expect(page.getByRole('heading', { name: org.name })).toBeVisible()
  })
})
