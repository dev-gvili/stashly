import { test as base } from '@playwright/test'
import path from 'path'

/**
 * Use this `test` in authenticated specs (navigation.spec.ts).
 * It overrides the `page` fixture with a context that has the test user's session cookie.
 * For unauthenticated specs (auth.spec.ts), import `test` from `@playwright/test` directly.
 */
export const test = base.extend({
  page: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(process.cwd(), 'tests/e2e/.auth/session.json'),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
