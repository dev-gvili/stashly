import { test, expect } from './fixtures'
import {
  TEST_USER_ID,
  E2E_ITEM_A_NAME,
  E2E_ITEM_B_NAME,
  E2E_ITEM_C_NAME,
  E2E_ROOT_FOLDER_ID,
} from './constants'

const favoritesUrl = `/${TEST_USER_ID}/stash/favorites`
const folderUrl = `/${TEST_USER_ID}/stash/folders/${E2E_ROOT_FOLDER_ID}`

/** Wait for the main content area to finish loading (avoids networkidle hang). */
async function waitForContent(page: import('@playwright/test').Page) {
  await page.waitForLoadState('load')
  // Wait until React has hydrated: the sidebar is a reliable SSR+hydration landmark
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
}

test.describe('Favorites', () => {
  test('toggle on: favoriting an item makes it appear in /favorites', async ({ page }) => {
    // Navigate to the folder containing Item A (unfavorited)
    await page.goto(folderUrl)
    await waitForContent(page)

    // Verify Item A is on the page
    await expect(page.getByText(E2E_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })

    // Open the "..." actions menu on the Item A card
    const itemCard = page.locator('[data-slot="item-card"]').filter({ hasText: E2E_ITEM_A_NAME })
    await itemCard.hover()
    await itemCard.locator('[data-slot="item-header"] button').last().click()

    // Click "Favorite" in the dropdown
    await page.getByRole('menuitem', { name: 'Favorite' }).click()

    // Wait for the API call to complete
    await page.waitForResponse(
      (res) => res.url().includes('/api/favorites') && res.status() === 200,
      { timeout: 10000 }
    )

    // Navigate to /favorites and verify Item A now appears
    await page.goto(favoritesUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })
  })

  test('toggle off: unfavoriting an item removes it from /favorites', async ({ page }) => {
    // Item B starts favorited — verify it is listed
    await page.goto(favoritesUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_ITEM_B_NAME)).toBeVisible({ timeout: 10000 })

    // Open "..." actions menu on Item B
    const itemCard = page.locator('[data-slot="item-card"]').filter({ hasText: E2E_ITEM_B_NAME })
    await itemCard.hover()
    await itemCard.locator('[data-slot="item-header"] button').last().click()

    // Click "Unfavorite"
    await page.getByRole('menuitem', { name: 'Unfavorite' }).click()
    await page.waitForResponse(
      (res) => res.url().includes('/api/favorites') && res.status() === 200,
      { timeout: 10000 }
    )

    // Reload the favorites page — Item B should be gone
    await page.goto(favoritesUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_ITEM_B_NAME)).not.toBeVisible()
  })

  test('favorites page lists all favorited items', async ({ page }) => {
    // Item C starts favorited — verify it appears on the favorites page
    await page.goto(favoritesUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_ITEM_C_NAME)).toBeVisible({ timeout: 10000 })
  })
})
