import { expect, test } from './support/test'

// The doors: what a visitor sees, and where a session is sent.
test.describe('the front door', () => {
  test('the home page offers a way in', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toBeVisible()
  })

  test('the app sends a visitor to sign in, remembering where they were going', async ({
    page,
  }) => {
    await page.goto('/app/members')
    await expect(page).toHaveURL(/\/login\?/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/app/members')
  })

  test('the staff area is the same door', async ({ page }) => {
    await page.goto('/staff')
    await expect(page).toHaveURL(/\/login\?/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/staff')
  })

  test('a link that is not an invitation says so', async ({ page }) => {
    await page.goto('/invite/not-a-real-token')
    await expect(
      page.getByRole('heading', { name: "This invitation link isn't valid" }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible()
  })

  test('someone signed in with nowhere to go yet is asked to create an organisation', async ({
    people,
    as,
  }) => {
    const nadia = await people.create('Nadia Newcomer')
    const page = await as(nadia)

    // Neither the sign-in page nor the app is for them right now.
    await page.goto('/login')
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible()

    await page.goto('/app')
    await expect(page).toHaveURL('/onboarding')

    // And the staff area is the wrong door, not a missing page.
    await page.goto('/staff')
    await expect(page).toHaveURL('/onboarding')
  })
})
