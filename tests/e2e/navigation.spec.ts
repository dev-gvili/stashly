import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { LayoutPage } from './pages/layout.page'
import { StashPage } from './pages/stash.page'
import { TEST_USER_ID } from './constants'

/**
 * Opens stash home and waits until it has written `?layout=grid` into its own
 * URL. `LayoutMenu` does that in an effect once the page has hydrated, as a
 * navigation of its own. A sidebar click before then was replayed during
 * hydration and then replaced by that navigation, leaving the page on
 * `/stash?layout=grid` (1–3 of these tests failed per full run; the trace shows
 * the click at 55.6 s and the rewrite's request at 56.3 s, no `/images` request).
 */
async function gotoStashHome(page: Page) {
  await page.goto(`/${TEST_USER_ID}/stash`)
  await expect(page).toHaveURL(/[?&]layout=grid/)
}

test.describe('Authenticated navigation', () => {
  test('visiting / redirects to stash home', async ({ page,baseURL }) => {
    await page.goto('/')
    await expect(page).toHaveURL(`${baseURL}/${TEST_USER_ID}/stash?layout=grid&take=100`)
  })

  test('stash home loads without redirect', async ({ page }) => {
    const stashPage = new StashPage(page)
    await stashPage.goto(TEST_USER_ID)
    await stashPage.expectLoaded()
  })

  test('sidebar is visible on stash home', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.expectSidebarVisible()
  })

  // The personal stash no longer has a Recent Files page (only workspaces keep
  // `/recent`); these cover the sidebar links that replaced it.
  for (const [label, path] of [
    ['All', '/all'],
    ['Images', '/images'],
    ['Favorites', '/favorites'],
    ['Pinned', '/pinned'],
    ['Invitations', '/invitations'],
    ['Storage', '/storage'],
  ] as const) {
    test(`clicking ${label} navigates to ${path}`, async ({ page }) => {
      const layout = new LayoutPage(page)
      await gotoStashHome(page)
      await layout.clickNavItem(label)
      await expect(page).toHaveURL(new RegExp(path))
    })
  }

  test('clicking Collections navigates to /collections', async ({ page }) => {
    const layout = new LayoutPage(page)
    await gotoStashHome(page)
    await layout.clickNavItem('Collections')
    await expect(page).toHaveURL(new RegExp('/collections'))
  })

  test('clicking Shares navigates to /shares', async ({ page }) => {
    const layout = new LayoutPage(page)
    await gotoStashHome(page)
    await layout.clickNavItem('Shares')
    await expect(page).toHaveURL(new RegExp('/shares'))
  })

  test('clicking Trash navigates to /trash', async ({ page }) => {
    const layout = new LayoutPage(page)
    await gotoStashHome(page)
    await layout.clickNavItem('Trash')
    await expect(page).toHaveURL(new RegExp('/trash'))
  })
})
