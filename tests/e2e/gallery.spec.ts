import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { TEST_USER_ID, E2E_GALLERY_IMAGES, E2E_GALLERY_COLLECTION } from './constants'
import { tileAspectFromId } from '../../app/utils/gallery-layout'

const [TODAY, WEEK, OLD] = E2E_GALLERY_IMAGES
const imagesUrl = `/${TEST_USER_ID}/stash/images`

async function openGallery(page: Page, query = '') {
  await page.goto(`${imagesUrl}${query}`)
  await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Images', level: 1 })).toBeVisible()
}

const tile = (page: Page, name: string) =>
  page.locator('[data-slot="gallery-tile"]').filter({
    has: page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })),
  })

const tileBox = async (page: Page, name: string) => {
  const box = await tile(page, name).boundingBox()
  if (!box) throw new Error(`no tile for ${name}`)
  return box
}

const header = (page: Page) => page.locator('header')
/** The header's LayoutToggle items, in order: River, Waterfall, Grid. */
const layoutItem = (page: Page, index: 0 | 1 | 2) =>
  header(page).locator('button[role="radio"]:not([aria-label])').nth(index)

test.describe('Images gallery', () => {
  test('defaults: waterfall, 16px gap, grouped by date; controls live in the app header', async ({ page }) => {
    await page.context().clearCookies({ name: 'stashly-gallery' })
    await openGallery(page)

    await expect(page).toHaveURL(/layout=waterfall/)
    await expect(header(page).getByText('16px')).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'By date' })).toHaveAttribute('aria-pressed', 'true')
    await expect(header(page).getByRole('slider', { name: 'Thumbnail size' })).toHaveAttribute('aria-valuenow', '3')
    // No upload menu and no List layout on this page.
    await expect(header(page).locator('button[role="radio"]:not([aria-label])')).toHaveCount(3)
    await expect(page.getByRole('toolbar', { name: 'Gallery' })).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Last week', level: 2 })).toBeVisible()
    for (const img of E2E_GALLERY_IMAGES) await expect(tile(page, img.name)).toBeVisible()
  })

  test('tiles take the id-based shape of each layout, as the old views did', async ({ page }) => {
    for (const layout of ['waterfall', 'river'] as const) {
      await openGallery(page, `?layout=${layout}`)
      for (const img of E2E_GALLERY_IMAGES) {
        const box = await tileBox(page, img.name)
        expect(box.width / box.height).toBeCloseTo(tileAspectFromId(layout, img.id), 1)
      }
    }
  })

  test('By date off collapses everything into one unlabelled group', async ({ page }) => {
    await openGallery(page)
    await header(page).getByRole('button', { name: 'By date' }).click()
    await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toHaveCount(0)
    await expect(tile(page, OLD.name)).toBeVisible()

    // The preference survives a reload through the cookie.
    await page.reload()
    await expect(header(page).getByRole('button', { name: 'By date' })).toHaveAttribute('aria-pressed', 'false')
    await header(page).getByRole('button', { name: 'By date' }).click()
  })

  test('layout survives a reload via ?layout=, and grid cells are 4:3', async ({ page }) => {
    await openGallery(page)
    await layoutItem(page, 2).click()
    await expect(page).toHaveURL(/layout=grid/)
    await page.reload()
    await expect(page).toHaveURL(/layout=grid/)
    const box = await tileBox(page, TODAY.name)
    expect(box.height / box.width).toBeCloseTo(0.75, 1)
  })

  test('river keeps a lone last row at its target height', async ({ page }) => {
    await page.context().clearCookies({ name: 'stashly-gallery' })
    await openGallery(page, '?layout=river')
    // Each seeded image is alone in its date group, so each is a last row:
    // 190px tall at size 3, never stretched to the full width.
    const box = await tileBox(page, OLD.name)
    expect(Math.round(box.height)).toBe(190)
  })

  test('the gap slider sets the space between tiles', async ({ page }) => {
    await page.context().clearCookies({ name: 'stashly-gallery' })
    // By date off: all three images in one grid, so two share a row.
    await page.context().addCookies([
      { name: 'stashly-gallery', value: '3.16.0', domain: 'localhost', path: '/' },
    ])
    await openGallery(page, '?layout=grid')
    const spacing = () =>
      page.locator('.gallery-grid').evaluate((grid) => {
        const [a, b] = [...grid.children].map((c) => c.getBoundingClientRect())
        return Math.round(b.left - a.right)
      })
    expect(await spacing()).toBe(16)
    const slider = header(page).getByRole('slider', { name: 'Gap between images' })
    await slider.focus()
    await page.keyboard.press('Home') // 0px
    await expect(header(page).getByText('0px', { exact: true })).toBeVisible()
    expect(await spacing()).toBe(0)
    await page.context().clearCookies({ name: 'stashly-gallery' })
  })

  test('selecting a tile shows the gallery actions in the header; a click then toggles; Esc clears', async ({ page }) => {
    await openGallery(page)
    await tile(page, TODAY.name).hover()
    await page.getByRole('checkbox', { name: `Select ${TODAY.name}` }).click()
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
    // The gallery's set, in order — and no Move.
    const actions = header(page).getByRole('button', {
      name: /^(Add to collection|Move to…|Share|Download|Trash|Clear selection \(Esc\))$/,
    })
    await expect(actions).toHaveCount(5)
    const names = await actions.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(names).toEqual(['Add to collection', 'Share', 'Download', 'Trash', 'Clear selection (Esc)'])

    // In selection mode the open target becomes a toggle, not a link.
    await page.getByRole('button', { name: WEEK.name, exact: true }).click()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/stash\/images/)

    await page.keyboard.press('Escape')
    await expect(page.getByText(/\d+ selected/)).toHaveCount(0)
  })

  test('the group checkbox selects and deselects its whole group', async ({ page }) => {
    await page.context().clearCookies({ name: 'stashly-gallery' })
    await openGallery(page)
    await page.getByRole('checkbox', { name: 'Select Today' }).click()
    await expect(page.getByRole('checkbox', { name: 'Deselect Today' })).toHaveAttribute('data-state', 'checked')
    await expect(page.getByRole('checkbox', { name: `Select ${TODAY.name}` })).toHaveAttribute('data-state', 'checked')
    await page.getByRole('checkbox', { name: 'Deselect Today' }).click()
    await expect(page.getByText(/\d+ selected/)).toHaveCount(0)
  })

  test('pin flips at once and is saved', async ({ page }) => {
    await openGallery(page)
    await tile(page, OLD.name).hover()
    const saved = page.waitForResponse(
      (res) => res.url().includes('/api/pins') && res.request().method() === 'POST' && res.ok()
    )
    await tile(page, OLD.name).getByRole('button', { name: 'Pin' }).click()
    await expect(tile(page, OLD.name).getByRole('button', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true')
    await saved
    await tile(page, OLD.name).getByRole('button', { name: 'Unpin' }).click()
  })

  test('Share opens the share dialog for one image and is disabled for two', async ({ page }) => {
    await openGallery(page)
    await tile(page, TODAY.name).hover()
    await page.getByRole('checkbox', { name: `Select ${TODAY.name}` }).click()
    await header(page).getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: OLD.name, exact: true }).click()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Share' })).toBeDisabled()
  })

  test('Download saves one image as itself and several as a zip', async ({ page }) => {
    await openGallery(page)
    await tile(page, TODAY.name).hover()
    await page.getByRole('checkbox', { name: `Select ${TODAY.name}` }).click()
    const single = page.waitForEvent('download')
    await header(page).getByRole('button', { name: 'Download' }).click()
    expect((await single).suggestedFilename()).toBe(TODAY.name)

    await page.getByRole('button', { name: OLD.name, exact: true }).click()
    const zip = page.waitForEvent('download')
    await header(page).getByRole('button', { name: 'Download' }).click()
    const file = await zip
    expect(file.suggestedFilename()).toBe('stashly-2-files.zip')
    const path = await file.path()
    const bytes = (await import('fs')).readFileSync(path)
    // Local-file and end-of-central-directory signatures, and two entries.
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50)
    expect(bytes.readUInt32LE(bytes.length - 22)).toBe(0x06054b50)
    expect(bytes.readUInt16LE(bytes.length - 12)).toBe(2)
  })

  test('Add to collection lists collections and adds the selection', async ({ page }) => {
    await openGallery(page)
    await tile(page, TODAY.name).hover()
    await page.getByRole('checkbox', { name: `Select ${TODAY.name}` }).click()
    await header(page).getByRole('button', { name: 'Add to collection' }).click()
    const added = page.waitForResponse(
      (res) => res.url().includes('/api/collections') && res.request().method() === 'POST'
    )
    await page.getByRole('menuitem', { name: E2E_GALLERY_COLLECTION.name }).click()
    const res = await added
    expect(res.status()).toBeLessThan(400)
    // The selection clears once the request is sent.
    await expect(page.getByText(/\d+ selected/)).toHaveCount(0)
    // The collection now holds the image.
    await page.goto(`/${TEST_USER_ID}/stash/collections/${E2E_GALLERY_COLLECTION.id}`)
    await expect(page.getByText(TODAY.name).first()).toBeVisible({ timeout: 15000 })
  })

  test('Trash asks first, then removes the selected image', async ({ page }) => {
    await openGallery(page)
    await tile(page, WEEK.name).hover()
    await page.getByRole('checkbox', { name: `Select ${WEEK.name}` }).click()
    await header(page).getByRole('button', { name: 'Trash' }).click()
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'))
    await expect(dialog).toContainText('Move 1 item to Trash?')
    const trashed = page.waitForResponse(
      (res) => res.url().includes('/api/items') && res.request().method() === 'POST'
    )
    await dialog.getByRole('button', { name: 'Move to Trash' }).click()
    await trashed
    await expect(tile(page, WEEK.name)).toHaveCount(0)
    // global-setup resets the image to `normal` on the next run.
  })

  test('opening a tile navigates to the file page', async ({ page }) => {
    await openGallery(page)
    await page.getByRole('link', { name: TODAY.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${TODAY.id}`))
  })

  test('the header search with no match shows the empty state, and Clear search resets it', async ({ page }) => {
    await openGallery(page, '?query=zzqxnomatchzzqx')
    await expect(page.getByText('No images match')).toBeVisible({ timeout: 15000 })
    await page.getByRole('main').getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/query=/)
    await expect(tile(page, TODAY.name)).toBeVisible()
  })
})
