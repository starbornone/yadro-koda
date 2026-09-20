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

    // The product's fields: filled in, saved, and still there after a reload.
    const details = page.getByRole('region', { name: 'Details' })
    await details.getByLabel('Industry').fill('Disability services')
    await details.getByLabel('Size').selectOption('medium')
    await details.getByLabel('Reporting').click()
    await details.getByRole('button', { name: 'Save' }).click()
    await expect(details.getByRole('status')).toHaveText('Saved.')
    await page.reload()
    await expect(details.getByLabel('Industry')).toHaveValue('Disability services')
    await expect(details.getByLabel('Size')).toHaveValue('medium')
    await expect(details.getByLabel('Reporting')).toBeChecked()

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
    const details = tessaPage.getByRole('region', { name: 'Details' })
    await expect(details).toContainText('Disability services')
    await expect(details).toContainText('11–50 people')
    await expect(details.getByRole('button', { name: 'Save' })).toHaveCount(0)

    await page.goto('/staff/team')
    await expect(page.getByRole('row', { name: tessa.email })).toContainText('Support')
  })

  test('an enquiry from the website becomes a lead, with its contact and its entry', async ({
    page,
    as,
    people,
  }) => {
    const name = `${people.prefix}-enquiry`
    const email = `${people.prefix}-visitor@yadro.test`

    // A visitor, signed out, from the home page.
    await page.goto('/')
    await page.getByRole('link', { name: 'Get started' }).first().click()
    await expect(page).toHaveURL('/get-started')
    await page.getByLabel('Organisation', { exact: true }).fill(name)
    await page.getByLabel('Your name').fill('Vera Visitor')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Size').selectOption('small')
    await page.getByLabel('Core').click()
    await page.getByLabel('Anything else?').fill('Keen to see a demo.')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByRole('status')).toContainText(email)

    // Staff find them in the pipeline.
    const staff = await as(sam)
    await staff.goto('/staff/organisations')
    await staff.getByLabel('Search organisations').fill(name)
    await staff.getByRole('button', { name: 'Search', exact: true }).click()
    const row = staff.getByRole('row', { name })
    await expect(row).toContainText('Lead')
    await row.getByRole('link', { name }).click()

    await expect(staff.getByRole('heading', { name })).toBeVisible()
    await expect(staff.getByRole('region', { name: 'Details' }).getByLabel('Size')).toHaveValue(
      'small',
    )
    await expect(staff.getByRole('region', { name: 'Contacts' })).toContainText('Vera Visitor')
    const timeline = staff.getByRole('list').filter({ hasText: 'Enquired through the website' })
    await expect(timeline).toContainText('Website · Enquiry from Vera Visitor')
    await expect(timeline).toContainText('Keen to see a demo.')
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
