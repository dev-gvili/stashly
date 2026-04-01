import { test, expect } from './fixtures'
import { LayoutPage } from './pages/layout.page'
import { StashPage } from './pages/stash.page'
import { TEST_USER_ID } from './constants'

test.describe('Authenticated navigation', () => {
  test('visiting / redirects to stash home', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`/${TEST_USER_ID}/stash`))
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

  test('clicking Recent Files navigates to /recent', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Recent Files')
    await expect(page).toHaveURL(new RegExp('/recent'))
  })

  test('clicking Collections navigates to /collections', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Collections')
    await expect(page).toHaveURL(new RegExp('/collections'))
  })

  test('clicking Shares navigates to /shares', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Shares')
    await expect(page).toHaveURL(new RegExp('/shares'))
  })

  test('clicking Trash navigates to /trash', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Trash')
    await expect(page).toHaveURL(new RegExp('/trash'))
  })
})
