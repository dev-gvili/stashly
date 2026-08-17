import { test, expect } from './fixtures'
import { TEST_USER_ID, E2E_ITEM_A_NAME } from './constants'

const searchUrl = `/${TEST_USER_ID}/stash/search`

/** Wait for the main content area to finish loading (avoids networkidle hang). */
async function waitForContent(page: import('@playwright/test').Page) {
  await page.waitForLoadState('load')
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
}

const searchBox = (page: import('@playwright/test').Page) =>
  page.getByPlaceholder('Search names, tags and contents…')

test.describe('Search', () => {
  test('shows the idle state before anything is typed', async ({ page }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    await expect(page.getByText('Search your stash')).toBeVisible({
      timeout: 10000,
    })
  })

  test('keyword search finds an item by name', async ({ page }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    await searchBox(page).fill(E2E_ITEM_A_NAME)

    // The keyword pass is a plain GET — no embedding model involved, so this
    // is the path that must work in every browser.
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/search/items') &&
        res.request().method() === 'GET' &&
        res.status() === 200,
      { timeout: 15000 }
    )

    await expect(
      page.getByRole('link', { name: E2E_ITEM_A_NAME })
    ).toBeVisible({ timeout: 10000 })
  })

  test('a query matching nothing shows the empty state', async ({ page }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    await searchBox(page).fill('zzzzz-no-such-item-zzzzz')

    await expect(page.getByText('No matches')).toBeVisible({ timeout: 15000 })
  })

  test('a shared ?q= URL server-renders its results', async ({ page }) => {
    // The loader runs the keyword half, so a pasted search link paints
    // results without waiting on client JS.
    await page.goto(
      `${searchUrl}?q=${encodeURIComponent(E2E_ITEM_A_NAME)}`
    )
    await waitForContent(page)

    await expect(
      page.getByRole('link', { name: E2E_ITEM_A_NAME })
    ).toBeVisible({ timeout: 10000 })
  })

  test('semantic mode still returns results when embedding is unavailable', async ({
    page,
  }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    await page.getByRole('radio', { name: 'Semantic search' }).click()
    await searchBox(page).fill(E2E_ITEM_A_NAME)

    // Whether this browser can run WebGPU or not, the keyword pass has already
    // landed — semantic ranking is an upgrade, never a precondition for
    // getting results.
    await expect(
      page.getByRole('link', { name: E2E_ITEM_A_NAME })
    ).toBeVisible({ timeout: 30000 })
  })
})
