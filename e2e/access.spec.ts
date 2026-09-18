import { type Person } from './support/people'
import { expect, test } from './support/test'

// Time-boxed access: an invitation with an end date, the membership it becomes, the lockout
// once the date passes, and the owner lifting it.
test.describe.configure({ mode: 'serial' })

test.describe('time-boxed access', () => {
  let olive: Person
  let grace: Person
  let org: { id: string; name: string; slug: string }
  let inviteLink: string

  // A calendar date the input will accept (`min` is today), a week out.
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  test.beforeAll(async ({ people }) => {
    olive = await people.create('Olive Owner')
    grace = await people.create('Grace Guest')
    org = await people.createOrganisation(olive, 'Acme Rockets')
  })

  test('an invitation can carry an end date', async ({ as }) => {
    const page = await as(olive)
    await page.goto('/app/members')
    await page.getByLabel('Email', { exact: true }).fill(grace.email)
    await page.getByLabel('Access ends', { exact: true }).fill(nextWeek)
    await page.getByRole('button', { name: 'Create invitation' }).click()

    inviteLink = await page.getByLabel(`Invitation link for ${grace.email}`).inputValue()
    // The open invitation shows when the access it grants will end, not "Never".
    const row = page.getByRole('row', { name: grace.email })
    await expect(row).toBeVisible()
    await expect(row).not.toContainText('Never')
  })

  test('the member joins knowing the date, and is out once it has passed', async ({
    as,
    people,
  }) => {
    const page = await as(grace)
    await page.goto(inviteLink)
    await expect(page.getByRole('heading', { name: `Join ${org.name}?` })).toBeVisible()
    await expect(page.getByText(/invited you to join as member until /)).toBeVisible()
    await page.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(page).toHaveURL('/app')
    await expect(page.getByRole('heading', { name: org.name })).toBeVisible()

    // The clock cannot be hurried, so move the end into the past instead.
    await people.expireMembership(grace, org.id, new Date(Date.now() - 60 * 1000))
    await page.goto('/app')
    await expect(page).toHaveURL('/onboarding')
  })

  test('the owner still sees them, lifts the end date, and they are back in', async ({ as }) => {
    const page = await as(olive)
    await page.goto('/app/members')
    const row = page.getByRole('row', { name: grace.email })
    await expect(row).toContainText('Member')
    await expect(row).not.toContainText('Never')

    await row.getByRole('button', { name: `Change access for ${grace.name}` }).click()
    await row.getByLabel(`Access ends for ${grace.name}`).fill('')
    await row.getByRole('button', { name: 'Save' }).click()
    await expect(row).toContainText('Never')

    const gracePage = await as(grace)
    await gracePage.goto('/app')
    await expect(gracePage).toHaveURL('/app')
    await expect(gracePage.getByRole('heading', { name: org.name })).toBeVisible()
  })
})
