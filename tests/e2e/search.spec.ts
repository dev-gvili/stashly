import { test, expect } from './fixtures'
import { TEST_USER_ID, E2E_ITEM_A_ID, E2E_ITEM_A_NAME } from './constants'

const searchUrl = `/${TEST_USER_ID}/stash/search`

/** Wait for the main content area to finish loading (avoids networkidle hang). */
async function waitForContent(page: import('@playwright/test').Page) {
  await page.waitForLoadState('load')
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
}

/** The search page has no input of its own: it searches through the header's
 * `Filters` box, which writes the `query` URL param (`QUERY_KEY`). */
const searchBox = (page: import('@playwright/test').Page) =>
  page.getByPlaceholder('Search…', { exact: true })

/**
 * Types a query once the box is live. Filling the server-rendered input before
 * hydration loses the text: hydration resets the controlled input to the URL's
 * (empty) query. The box writes `?query=` only once React's handlers are
 * attached, so the URL changing is the signal that the text actually took.
 */
async function typeQuery(page: import('@playwright/test').Page, text: string) {
  await expect(async () => {
    await searchBox(page).fill(text)
    await expect(page).toHaveURL(/[?&]query=/, { timeout: 2000 })
  }).toPass({ timeout: 20000 })
}

/** A result is a `FileCardDetail` card, which opens on click; it has no link role. */
const resultCard = (page: import('@playwright/test').Page, name: string) =>
  page.locator('[data-slot="item-card"]').filter({ hasText: name })

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

    await typeQuery(page, E2E_ITEM_A_NAME)

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
      resultCard(page, E2E_ITEM_A_NAME)
    ).toBeVisible({ timeout: 10000 })

    // A result is only useful if it opens the item it matched.
    await resultCard(page, E2E_ITEM_A_NAME).click()
    await expect(page).toHaveURL(new RegExp(E2E_ITEM_A_ID))
  })

  test('a query matching nothing shows the empty state', async ({ page }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    await typeQuery(page, 'zzzzz-no-such-item-zzzzz')

    await expect(page.getByText('No matches')).toBeVisible({ timeout: 15000 })
  })

  test('a shared ?query= URL server-renders its results', async ({ page }) => {
    // The loader runs the keyword half, so a pasted search link paints
    // results without waiting on client JS.
    await page.goto(
      `${searchUrl}?query=${encodeURIComponent(E2E_ITEM_A_NAME)}`
    )
    await waitForContent(page)

    await expect(
      resultCard(page, E2E_ITEM_A_NAME)
    ).toBeVisible({ timeout: 10000 })

    // A multi-word query that is the exact filename is a filename match. When
    // spaces reached the server as `+`, every such query matched nothing
    // literally and the whole page fell into "Similar name".
    await expect(page.getByText('The query is in the filename.')).toBeVisible()
    await expect(page.getByText('Approximate name — no exact occurrence.')).toHaveCount(0)
  })

  test('semantic mode still returns results when embedding is unavailable', async ({
    page,
  }) => {
    await page.goto(searchUrl)
    await waitForContent(page)

    // Same hydration race as typing: a click on the server-rendered radio is
    // lost, and the test would then pass in fuzzy mode without testing semantic.
    const semantic = page.getByRole('radio', { name: 'Semantic search' })
    await expect(async () => {
      await semantic.click()
      await expect(semantic).toBeChecked({ timeout: 2000 })
    }).toPass({ timeout: 20000 })
    await typeQuery(page, E2E_ITEM_A_NAME)

    // Whether this browser can run WebGPU or not, the keyword pass has already
    // landed — semantic ranking is an upgrade, never a precondition for
    // getting results.
    await expect(
      resultCard(page, E2E_ITEM_A_NAME)
    ).toBeVisible({ timeout: 30000 })
  })
})
