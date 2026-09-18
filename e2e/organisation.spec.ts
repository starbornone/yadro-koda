import { type Person } from './support/people'
import { expect, test } from './support/test'

// One organisation's life, in order: founded, joined by invitation, left, deleted. Each test
// picks up where the last one stopped, so a failure skips the rest rather than misreporting it.
test.describe.configure({ mode: 'serial' })

test.describe('an organisation, from founding to deletion', () => {
  const name = 'Acme Rockets'
  let slug: string
  let olive: Person
  let grace: Person
  let inviteLink: string

  test.beforeAll(async ({ people }) => {
    olive = await people.create('Olive Owner')
    grace = await people.create('Grace Guest')
    slug = people.slug('acme')
  })

  test('a new user founds it and lands on its dashboard as the owner', async ({ as }) => {
    const page = await as(olive)
    await page.goto('/app')
    await expect(page).toHaveURL('/onboarding')

    await page.getByLabel('Organisation name').fill(name)
    await page.getByLabel('URL name').fill(slug)
    await page.getByRole('button', { name: 'Create organisation' }).click()

    await expect(page).toHaveURL('/app')
    await expect(page.getByRole('heading', { name })).toBeVisible()

    await page.goto('/app/members')
    await expect(page.getByRole('heading', { name: `People in ${name}` })).toBeVisible()
    const self = page.getByRole('row', { name: olive.email })
    await expect(self).toContainText('Owner')
    await expect(self).toContainText('you')
    // The only owner cannot leave.
    await expect(page.getByRole('button', { name: 'Leave organisation' })).toBeDisabled()
  })

  test('the owner invites someone and gets a link to pass on', async ({ as }) => {
    const page = await as(olive)
    await page.goto('/app/members')

    await page.getByLabel('Email', { exact: true }).fill(grace.email)
    await page.getByLabel('Role', { exact: true }).selectOption('member')
    await page.getByRole('button', { name: 'Create invitation' }).click()

    const link = page.getByLabel(`Invitation link for ${grace.email}`)
    await expect(link).toBeVisible()
    inviteLink = await link.inputValue()
    expect(inviteLink).toMatch(/^http:\/\/localhost:\d+\/invite\/[0-9a-f-]{36}$/)

    await expect(page.getByRole('row', { name: grace.email })).toContainText('Member')
  })

  test('the link explains itself, turns the wrong account away, and lets the right one in', async ({
    page,
    as,
  }) => {
    // Signed out: what it is for, and which address to sign in with.
    await page.goto(inviteLink)
    await expect(page.getByRole('heading', { name: `Join ${name}`, exact: true })).toBeVisible()
    await expect(page.getByText(grace.email)).toBeVisible()
    await expect(page.getByRole('link', { name: 'I already have one' })).toBeVisible()

    // The inviter's own session is not who it was sent to.
    const olivePage = await as(olive)
    await olivePage.goto(inviteLink)
    await expect(
      olivePage.getByRole('heading', { name: 'This invitation is for a different account' }),
    ).toBeVisible()

    // The invitee joins and is taken straight into the organisation.
    const gracePage = await as(grace)
    await gracePage.goto(inviteLink)
    await expect(gracePage.getByRole('heading', { name: `Join ${name}?` })).toBeVisible()
    await expect(gracePage.getByText(`${olive.name} invited you to join as member.`)).toBeVisible()
    await gracePage.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(gracePage).toHaveURL('/app')
    await expect(gracePage.getByRole('heading', { name })).toBeVisible()

    // The link is spent.
    await gracePage.goto(inviteLink)
    await expect(
      gracePage.getByRole('heading', { name: 'This invitation has already been used' }),
    ).toBeVisible()
  })

  test('the owner sees the new member and no open invitation', async ({ as }) => {
    const page = await as(olive)
    await page.goto('/app/members')
    await expect(page.getByRole('row', { name: grace.email })).toContainText('Member')
    await expect(page.getByText('No open invitations.')).toBeVisible()
  })

  test('a member can leave, and is back at the start', async ({ as }) => {
    const page = await as(grace)
    await page.goto('/app/members')
    await expect(page.getByRole('heading', { name: `People in ${name}` })).toBeVisible()
    // A member manages nobody, so there is nothing to invite with.
    await expect(page.getByRole('heading', { name: 'Invitations' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Leave organisation' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(`Leave ${name}?`)
    await dialog.getByRole('button', { name: 'Leave', exact: true }).click()

    await expect(page).toHaveURL('/onboarding')
  })

  test('the owner deletes it by typing its URL name, and is back at the start too', async ({
    as,
  }) => {
    const page = await as(olive)
    await page.goto('/app/members')
    await expect(page.getByRole('row', { name: grace.email })).toHaveCount(0)

    await page.goto('/app/settings')
    await page.getByRole('button', { name: 'Delete organisation' }).click()
    const dialog = page.getByRole('alertdialog')
    const confirm = dialog.getByRole('button', { name: 'Delete', exact: true })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('URL name').fill(slug)
    await confirm.click()

    await expect(page).toHaveURL('/onboarding')
    await page.goto('/app')
    await expect(page).toHaveURL('/onboarding')
  })
})
