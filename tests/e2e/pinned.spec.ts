import { test, expect } from './fixtures'
import {
  TEST_USER_ID,
  E2E_PIN_ITEM_A_NAME,
  E2E_PIN_ITEM_B_NAME,
  E2E_ROOT_FOLDER_ID,
} from './constants'

const pinnedUrl = `/${TEST_USER_ID}/stash/pinned?layout=grid`
const folderUrl = `/${TEST_USER_ID}/stash/folders/${E2E_ROOT_FOLDER_ID}?layout=grid`

async function waitForContent(page: import('@playwright/test').Page) {
  await page.waitForLoadState('load')
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
}

test.describe('Pinned items', () => {
  test('toggle on: pinning an item makes it appear in /pinned', async ({ page }) => {
    await page.goto(folderUrl)
    await waitForContent(page)

    await expect(page.getByText(E2E_PIN_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })

    const itemCard = page.locator('[data-slot="item-card"]').filter({ hasText: E2E_PIN_ITEM_A_NAME })
    await itemCard.hover()
    await itemCard.locator('[data-slot="item-header"] button').last().click()

    await page.getByRole('menuitem', { name: 'Pin' }).click()

    await page.waitForResponse(
      (res) => res.url().includes('/api/pins') && res.status() === 200,
      { timeout: 10000 }
    )

    await page.goto(pinnedUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_PIN_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })
  })

  test('toggle off: unpinning an item removes it from /pinned', async ({ page }) => {
    await page.goto(pinnedUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_PIN_ITEM_B_NAME)).toBeVisible({ timeout: 10000 })

    const itemCard = page.locator('[data-slot="item-card"]').filter({ hasText: E2E_PIN_ITEM_B_NAME })
    await itemCard.hover()
    await itemCard.locator('[data-slot="item-header"] button').last().click()

    await page.getByRole('menuitem', { name: 'Unpin' }).click()

    await page.waitForResponse(
      (res) => res.url().includes('/api/pins') && res.status() === 200,
      { timeout: 10000 }
    )

    await page.goto(pinnedUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_PIN_ITEM_B_NAME)).not.toBeVisible()
  })

  test('pinned page lists pre-pinned items', async ({ page }) => {
    await page.goto(pinnedUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_PIN_ITEM_B_NAME)).toBeVisible({ timeout: 10000 })
  })
})
