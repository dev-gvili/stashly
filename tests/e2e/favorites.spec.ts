import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import {
  TEST_USER_ID,
  E2E_ITEM_A_NAME,
  E2E_ITEM_B_NAME,
  E2E_ITEM_C_NAME,
  E2E_ITEM_D_NAME,
  E2E_ITEM_E_ID,
  E2E_ITEM_E_NAME,
  E2E_ITEM_F_ID,
  E2E_ITEM_F_NAME,
  E2E_ITEM_G_ID,
  E2E_ITEM_G_NAME,
  E2E_ROOT_FOLDER_ID,
  OTHER_PRIVATE_ID,
  OTHER_PRIVATE_NAME,
  OTHER_REVOKED_NAME,
  OTHER_SHARED_ID,
  OTHER_SHARED_NAME,
} from './constants'

const favoritesUrl = `/${TEST_USER_ID}/stash/favorites?layout=grid`
const folderUrl = `/${TEST_USER_ID}/stash/folders/${E2E_ROOT_FOLDER_ID}?layout=grid`

/** Wait for the main content area to finish loading (avoids networkidle hang). */
async function waitForContent(page: Page) {
  await page.waitForLoadState('load')
  // Wait until React has hydrated: the sidebar is a reliable SSR+hydration landmark
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
}

async function openFavorites(page: Page) {
  await page.goto(favoritesUrl)
  await waitForContent(page)
}

const card = (page: Page, name: string) =>
  page.locator('[data-slot="item-card"]').filter({ hasText: name })

/**
 * Opens a card's "..." menu. Retried until the menu is open: a click on the
 * server-rendered trigger before hydration does nothing.
 */
async function openCardMenu(page: Page, name: string) {
  await expect(async () => {
    await card(page, name).hover()
    await card(page, name).locator('[data-slot="item-header"] button').last().click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
}

/** Picks Favorite / Unfavorite from the open menu and waits for the write. */
async function chooseFromMenu(page: Page, label: 'Favorite' | 'Unfavorite') {
  // Registered before the click so a fast response can't be missed, and
  // POST-only so it is the write itself, not some other request.
  const saved = page.waitForResponse(
    (res) =>
      res.url().includes('/api/favorites') &&
      res.request().method() === 'POST' &&
      res.status() === 200,
    { timeout: 10000 }
  )
  await page.getByRole('menuitem', { name: label, exact: true }).click()
  await saved
}

/** Posts to the favorites route the way `useFavorite` does, as the signed-in user. */
const post = (page: Page, form: Record<string, string>) =>
  page.request.post('/api/favorites', { form, maxRedirects: 0 })

test.describe('Favorites — from the item menu', () => {
  test('toggle on: favoriting an item makes it appear in /favorites', async ({ page }) => {
    await page.goto(folderUrl)
    await waitForContent(page)
    await expect(page.getByText(E2E_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })

    await openCardMenu(page, E2E_ITEM_A_NAME)
    await chooseFromMenu(page, 'Favorite')

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_A_NAME)).toBeVisible({ timeout: 10000 })

    // The menu reads the stored state after a reload: it now offers the opposite.
    await openCardMenu(page, E2E_ITEM_A_NAME)
    await expect(page.getByRole('menuitem', { name: 'Unfavorite', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Favorite', exact: true })).toHaveCount(0)
  })

  test('toggle off: unfavoriting an item removes it from /favorites', async ({ page }) => {
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_B_NAME)).toBeVisible({ timeout: 10000 })

    await openCardMenu(page, E2E_ITEM_B_NAME)
    await chooseFromMenu(page, 'Unfavorite')

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_B_NAME)).not.toBeVisible()
  })

  test('favorites page lists all favorited items', async ({ page }) => {
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_C_NAME)).toBeVisible({ timeout: 10000 })
  })

  // `Favorite` has no unique constraint, so an item can carry two rows. Unfavorite
  // used to delete one: the request answered 200 and the item stayed listed.
  test('unfavoriting an item with duplicate favorite rows removes it', async ({ page }) => {
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_D_NAME)).toBeVisible({ timeout: 10000 })

    await openCardMenu(page, E2E_ITEM_D_NAME)
    await chooseFromMenu(page, 'Unfavorite')

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_D_NAME)).not.toBeVisible()
  })

  // Two tabs, or a double submit: favoriting must not stack rows, or a single
  // Unfavorite afterwards would leave the item behind.
  test('favoriting twice is undone by one Unfavorite', async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      const res = await post(page, { intent: 'favorite', itemId: E2E_ITEM_E_ID })
      expect(res.status()).toBe(200)
      expect(await res.json()).toEqual({ favorited: true })
    }

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_E_NAME)).toBeVisible({ timeout: 10000 })

    await openCardMenu(page, E2E_ITEM_E_NAME)
    await chooseFromMenu(page, 'Unfavorite')

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_E_NAME)).not.toBeVisible()
  })
})

test.describe('Favorites — bulk and edge cases', () => {
  test('unfavoriting an item that is not favorited answers 200 and changes nothing', async ({
    page,
  }) => {
    const res = await post(page, { intent: 'unfavorite', itemId: E2E_ITEM_F_ID })
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ favorited: false })

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_F_NAME)).not.toBeVisible()
  })

  test('bulk favorite adds new items and does not duplicate favorited ones', async ({ page }) => {
    // G is already favorited; F is not. The bulk action redirects back.
    const res = await post(page, {
      intent: 'favorite_items',
      selectedItems: `${E2E_ITEM_F_ID},${E2E_ITEM_G_ID}`,
    })
    expect(res.status()).toBeGreaterThanOrEqual(300)
    expect(res.status()).toBeLessThan(400)

    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_F_NAME)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(E2E_ITEM_G_NAME)).toBeVisible()

    // Had the bulk call stacked a second row on G, one unfavorite would leave it.
    expect((await post(page, { intent: 'unfavorite', itemId: E2E_ITEM_G_ID })).status()).toBe(200)
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_G_NAME)).not.toBeVisible()
  })
})

test.describe('Favorites — access control', () => {
  test('an item shared with the user can be favorited and is listed', async ({ page }) => {
    const res = await post(page, { intent: 'favorite', itemId: OTHER_SHARED_ID })
    expect(res.status()).toBe(200)

    await openFavorites(page)
    await expect(page.getByText(OTHER_SHARED_NAME)).toBeVisible({ timeout: 10000 })
  })

  // Without the check, anyone holding an item id could favorite someone else's
  // file and then read its name, size and thumbnail off their Favorites page.
  test('another user’s unshared item is refused with 403 and never listed', async ({ page }) => {
    const res = await post(page, { intent: 'favorite', itemId: OTHER_PRIVATE_ID })
    expect(res.status()).toBe(403)

    await openFavorites(page)
    await expect(page.getByText(OTHER_PRIVATE_NAME)).not.toBeVisible()
  })

  test('an item id that does not exist is refused the same way', async ({ page }) => {
    const res = await post(page, { intent: 'favorite', itemId: 'item_does_not_exist_000000000' })
    expect(res.status()).toBe(403)
  })

  // The user favorited it while it was shared; the owner then revoked the share.
  test('a favorite whose share was revoked is no longer listed', async ({ page }) => {
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_C_NAME)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(OTHER_REVOKED_NAME)).not.toBeVisible()
  })
})

test.describe('Favorites — malformed and signed-out requests', () => {
  test('an unknown intent or a missing item id answers 400, not 500', async ({ page }) => {
    expect((await post(page, { intent: 'nope', itemId: E2E_ITEM_F_ID })).status()).toBe(400)
    expect((await post(page, { intent: 'favorite' })).status()).toBe(400)
  })

  test('a signed-out request is sent to sign in and writes nothing', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const anonymous = await playwright.request.newContext({ baseURL })
    try {
      const res = await anonymous.post('/api/favorites', {
        form: { intent: 'favorite', itemId: E2E_ITEM_E_ID },
        maxRedirects: 0,
      })
      expect(res.status()).toBeGreaterThanOrEqual(300)
      expect(res.status()).toBeLessThan(400)
      expect(res.headers()['location']).toContain('/auth/sign-in')
    } finally {
      await anonymous.dispose()
    }

    // E was left unfavorited by the double-favorite test.
    await openFavorites(page)
    await expect(page.getByText(E2E_ITEM_E_NAME)).not.toBeVisible()
  })
})
