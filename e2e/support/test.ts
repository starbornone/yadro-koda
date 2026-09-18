/**
 * The suite's `test`: Playwright's, plus the people a file signs in as. `people` lives for the
 * worker and takes everything it made away with it; `as(person)` opens a page already signed
 * in as that person, in a browser context of its own, so one test can hold two people's
 * sessions side by side (the inviter and the invited). The plain `page` fixture is a visitor
 * who is signed out.
 */
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { People, STORAGE_KEY, type Person } from './people'

type WorkerFixtures = {
  people: People
}

type TestFixtures = {
  as: (person: Person) => Promise<Page>
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  people: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const people = new People(workerInfo.workerIndex)
      await people.sweepStale()
      await use(people)
      await people.cleanUp()
    },
    { scope: 'worker' },
  ],

  as: async ({ browser, baseURL, people }, use) => {
    const contexts: BrowserContext[] = []

    await use(async (person) => {
      const session = await people.session(person)
      const context = await browser.newContext({
        // What the app's client would have written after signing in; it picks the session up
        // on load, before any route guard runs.
        storageState: {
          cookies: [],
          origins: [
            {
              origin: baseURL!,
              localStorage: [{ name: STORAGE_KEY, value: JSON.stringify(session) }],
            },
          ],
        },
      })
      contexts.push(context)
      return context.newPage()
    })

    await Promise.all(contexts.map((context) => context.close()))
  },
})

export { expect }
