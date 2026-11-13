import { test as base } from '@playwright/test'
import path from 'path'

/**
 * Use this `test` in authenticated specs (navigation.spec.ts).
 * It overrides the `page` fixture with a context that has the test user's session cookie.
 * For unauthenticated specs (auth.spec.ts), import `test` from `@playwright/test` directly.
 *
 * Each worker signs in as its own user (`constants.ts`, `global-setup.ts`):
 * `session.json` for worker 0, `session-<n>.json` for worker n.
 */
export const test = base.extend({
  page: async ({ browser }, use, testInfo) => {
    const index = testInfo.parallelIndex
    const ctx = await browser.newContext({
      storageState: path.join(
        process.cwd(),
        'tests/e2e/.auth',
        index === 0 ? 'session.json' : `session-${index}.json`
      ),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
