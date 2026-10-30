/**
 * E2E for the upload flow: a real drop into the real upload machine, a real
 * multipart upload to S3, and the real `createUploadedItem` that files the row.
 *
 * **Quota is charged on the server, and only there.** `createUploadedItem`
 * charges the file size in the same transaction that creates the row, and
 * `/api/quota` is read-only. These tests check both sides from the browser:
 * the quota grows by exactly what was uploaded, and the page never posts a
 * quota write (the `items-uploaded` charge the upload machine used to send).
 *
 * **Every test drops into its own empty folder** (`createEmptyFolder`), so a
 * card it looks for is never pushed below the fold by earlier runs' files.
 *
 * **Exact quota deltas assume no other upload by the E2E user is in flight.**
 * Every spec shares that one user, and Playwright runs spec *files* in
 * parallel workers, so a concurrent `thumbnail-machine.spec.ts` upload would
 * land in the same window. Run this file on its own, or with `--workers=1`,
 * when a quota assertion fails.
 *
 * **Side effect:** uploads real files and creates folders in the E2E user's
 * stash and bucket, all named `e2e-upload-*`.
 */
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { UploadPage } from './pages/upload.page'
import { TEST_USER_ID } from './constants'
import { createEmptyFolder } from './helpers/thumbnail-machine'
import {
  QUOTA_READ_ACTIONS,
  postQuota,
  readQuota,
  recordQuotaTraffic,
} from './helpers/quota'

/** Unique per run so a re-run never collides with a previous run's items. */
const runId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Opens a fresh empty folder, ready for a drop whose cards render in view. */
async function openEmptyFolder(page: Page) {
  const uploadPage = new UploadPage(page)
  // A page of the app first, so the API call below carries the session.
  await uploadPage.goto(TEST_USER_ID)
  const folderId = await createEmptyFolder(page, `e2e-upload-folder-${runId()}`)
  await uploadPage.gotoFolder(TEST_USER_ID, folderId)
  return { uploadPage, folderId }
}

test.describe('upload — filing', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a dropped file reaches itemCreated and its card is in the folder after a reload', async ({
    page,
  }) => {
    const { uploadPage, folderId } = await openEmptyFolder(page)
    const name = `e2e-upload-${runId()}.txt`

    await uploadPage.dropFile({ name, sizeBytes: 10_000, type: 'text/plain' })
    await uploadPage.waitForItemCreated(name)

    // A reload drops the upload panel's in-memory list, so the name on screen
    // can only come from the row the server filed.
    await uploadPage.gotoFolder(TEST_USER_ID, folderId)
    await uploadPage.expectCardInGrid(name)
  })

  test('a multi-file drop files every file', async ({ page }) => {
    const { uploadPage, folderId } = await openEmptyFolder(page)
    const id = runId()
    const files = [
      { name: `e2e-upload-${id}-a.txt`, sizeBytes: 1_111, type: 'text/plain' },
      { name: `e2e-upload-${id}-b.bin`, sizeBytes: 22_222, type: 'application/octet-stream' },
      { name: `e2e-upload-${id}-c.txt`, sizeBytes: 3_333, type: 'text/plain' },
    ]

    await uploadPage.dropFiles(files)
    for (const f of files) await uploadPage.waitForItemCreated(f.name)

    await uploadPage.gotoFolder(TEST_USER_ID, folderId)
    for (const f of files) await uploadPage.expectCardInGrid(f.name)
  })

  // A row that takes longer than the runner's 700 ms debounce used to be lost
  // from the page: the list reload was scheduled when the bytes finished
  // (`done`, no row yet), the later `itemCreated` left that count unchanged, so
  // nothing reloaded again, and the indexing reload's `revalidate()` doesn't
  // refresh the paginated grid. In the measured run the folder header said
  // 6 files over an empty grid until a manual reload (tech-debt item 43).
  // Holding every row request past the debounce reproduces it; the names must
  // appear with no reload.
  test('files whose rows arrive after the debounce still appear without a reload', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)
    const id = runId()
    const files = [
      { name: `e2e-upload-${id}-late-a.txt`, sizeBytes: 1_111, type: 'text/plain' },
      { name: `e2e-upload-${id}-late-b.txt`, sizeBytes: 2_222, type: 'text/plain' },
      { name: `e2e-upload-${id}-late-c.txt`, sizeBytes: 3_333, type: 'text/plain' },
    ]

    await page.route('**/api/items', async (route) => {
      const request = route.request()
      if (request.method() === 'POST' && request.postData()?.includes('create_upload_item')) {
        await new Promise((resolve) => setTimeout(resolve, 1_500))
      }
      await route.continue()
    })

    await uploadPage.dropFiles(files)
    for (const f of files) await uploadPage.waitForItemCreated(f.name)

    // A grid card, not `expectCardInGrid`: with no reload the open upload
    // panel lists the same names inside <main>, so any text match passes.
    for (const f of files) {
      await expect(
        page.locator('[data-slot="item-card"]').filter({ hasText: f.name })
      ).toBeVisible({ timeout: 15_000 })
    }
  })
})

test.describe('upload — quota is charged by the server', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test('charges exactly the file size, and the page sends only quota reads', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)
    const traffic = recordQuotaTraffic(page)
    const name = `e2e-upload-${runId()}.bin`
    // An odd size, so a double charge or a wrong size can't pass by accident.
    const size = 12_345

    const before = await readQuota(page)
    await uploadPage.dropFile({ name, sizeBytes: size, type: 'application/octet-stream' })
    await uploadPage.waitForItemCreated(name)
    const after = await readQuota(page)

    expect(after.used - before.used, 'quota should grow by the file size, once').toBe(size)

    // The page did ask about quota (the batch pre-check), so the absence of a
    // write below is not just the absence of any traffic.
    expect(traffic.length, 'the upload made no /api/quota request at all').toBeGreaterThan(0)
    const writes = traffic.filter((c) => !QUOTA_READ_ACTIONS.includes(c.action))
    expect(writes, 'the page posted a quota write; quota is charged on the server').toEqual([])
    const failed = traffic.filter((c) => (c.status ?? 0) >= 400)
    expect(failed, 'a quota request from the page failed').toEqual([])
  })

  test('a multi-file drop is charged the sum of its sizes', async ({ page }) => {
    const { uploadPage } = await openEmptyFolder(page)
    const id = runId()
    const files = [
      { name: `e2e-upload-${id}-1.bin`, sizeBytes: 4_001, type: 'application/octet-stream' },
      { name: `e2e-upload-${id}-2.bin`, sizeBytes: 5_002, type: 'application/octet-stream' },
      { name: `e2e-upload-${id}-3.bin`, sizeBytes: 6_003, type: 'application/octet-stream' },
    ]

    const before = await readQuota(page)
    await uploadPage.dropFiles(files)
    for (const f of files) await uploadPage.waitForItemCreated(f.name)
    const after = await readQuota(page)

    expect(after.used - before.used).toBe(files.reduce((sum, f) => sum + f.sizeBytes, 0))
  })
})

test.describe('upload — /api/quota refuses writes', () => {
  // Each of these used to change the caller's own quota from a request body.
  // `update-total-quota` replaced the storage limit outright.
  for (const action of [
    'items-uploaded',
    'update-total-quota',
    'items-trashed',
    'items-deleted',
    'items-restored',
    'items-copied',
  ]) {
    test(`${action} answers 400 and changes nothing`, async ({ page }) => {
      await new UploadPage(page).goto(TEST_USER_ID)
      const before = await readQuota(page)

      expect(await postQuota(page, { action, dataSize: '999999999999' })).toBe(400)

      const after = await readQuota(page)
      expect(after.total).toBe(before.total)
      expect(after.deleted).toBe(before.deleted)
    })
  }

  test('a negative size answers 400', async ({ page }) => {
    await new UploadPage(page).goto(TEST_USER_ID)
    expect(await postQuota(page, { action: 'verify-free-quota', dataSize: '-1' })).toBe(400)
  })
})
