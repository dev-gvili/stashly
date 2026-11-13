/**
 * E2E for the XState thumbnail pipeline (`app/machines/thumbnail`).
 *
 * These drive the **real** system: a real drop into the real upload machine, the
 * real compute worker doing a real decode/resize/WebP encode, a real presigned
 * PUT to S3, and the real scheduler in the page. Assertions read the actual
 * actor (`window.__thumbMgr`), the actual DOM it paints, and — for anything
 * claimed to be persisted — the actual bytes fetched back over HTTP.
 *
 * **A thumbnail is made only when its card is on screen.** Uploading starts no
 * thumbnail work; the uploaded file is held in memory, and its card's
 * visibility hook starts a `fromMemory` job when the card appears. So every
 * upload test drops into a fresh, empty folder it is viewing (`createEmptyFolder`
 * + `gotoFolder`): the new card is guaranteed to render in view. The shared
 * root holds every earlier run's files, where a new card can land below the
 * fold and correctly never get a thumbnail.
 *
 * Nothing here stubs an actor or asserts a value the test itself supplied. Where
 * a capability may be missing from the browser (WebGPU for stage 3), the test
 * reports that and skips rather than pretending the stage ran.
 *
 * **Side effect:** these upload real files and create folders in the E2E user's
 * stash and bucket. Everything is named `e2e-thumb-*` so it is easy to find and
 * remove.
 */
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { UploadPage } from './pages/upload.page'
import { TEST_USER_ID } from './constants'
import {
  installProbe,
  readProbe,
  readManager,
  waitForAnyItemAtStage,
  waitForIdle,
  progressFor,
  fetchPersistedThumbnail,
  decodeImage,
  sendToManager,
  expectManagerReady,
  createEmptyFolder,
  recordSourceRequests,
  stageUrlPattern,
  anyStageUrlPattern,
} from './helpers/thumbnail-machine'

/** Uploads plus real image compute; generous but bounded. */
const PIPELINE_TIMEOUT = 180_000

/** Unique per run so a re-run never collides with a previous run's items. */
const runId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/**
 * Opens a fresh empty folder with the probe recording, ready for a drop whose
 * cards will render in view.
 */
async function openEmptyFolder(page: Page) {
  const uploadPage = new UploadPage(page)
  // No page needs to be open first: the session cookie comes from the
  // context's storage state, and `page.request` sends it (measured: the home
  // page load this used to make cost 1.3-1.6 s per test).
  const folderId = await createEmptyFolder(page, `e2e-thumb-folder-${runId()}`)
  await uploadPage.gotoFolder(TEST_USER_ID, folderId)
  // Installed before the drop: the point of a progressive pipeline is the
  // ordering, and only the final state is visible after the fact.
  await installProbe(page)
  return { uploadPage, folderId }
}

/**
 * A client-side navigation through the app's own router, so module-scope
 * state (the scheduler, held upload files) survives it.
 */
async function navigateInApp(page: Page, path: string) {
  await page.evaluate(
    (p) =>
      (
        window as unknown as {
          __reactRouterDataRouter: { navigate: (to: string) => Promise<void> }
        }
      ).__reactRouterDataRouter.navigate(p),
    path
  )
}

test.describe('thumbnail machine — scheduler boots', () => {
  test('starts exactly one manager, with the memory lane open and downloads active', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await expectManagerReady(page)

    const state = await readManager(page)

    expect(state.value).toBe('{"memoryLane":{},"downloadLane":"active"}')
    expect(state.running).toEqual([])
    expect(state.queue).toEqual([])
  })
})

test.describe('thumbnail machine — only cards on screen', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('an upload whose card never rendered gets no thumbnail until its folder is opened, then one from memory', async ({
    page,
  }) => {
    const { uploadPage, folderId } = await openEmptyFolder(page)
    const sources = recordSourceRequests(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    // Leave before the item exists, so its card is never rendered. The upload
    // and the held file live on: both are module scope, and every navigation
    // here is client-side (a reload would drop the held file, and the job
    // would rightly become a download).
    await navigateInApp(page, `/${TEST_USER_ID}/stash/storage`)
    await expect(page).toHaveURL(/\/stash\/storage/, { timeout: 30_000 })
    await uploadPage.waitForItemCreated(name)

    // Nothing is thumbnailed for a card nobody has seen.
    await waitForIdle(page, 30_000)
    const away = await readProbe(page)
    expect(away.events, 'a thumbnail was made for a card that never rendered').toEqual([])

    // Opening the folder renders the card, which starts a memory-lane job.
    await installProbe(page)
    await navigateInApp(page, `/${TEST_USER_ID}/stash/folders/${folderId}?layout=grid`)
    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 60_000)
    const published = await progressFor(page, itemId)
    expect(published!.src).toMatch(stageUrlPattern(itemId, 2))

    const probe = await readProbe(page)
    expect(probe.maxRunningByMode.fromMemory ?? 0).toBeGreaterThan(0)
    expect(probe.maxRunningByMode.fromDownload ?? 0).toBe(0)
    // The file was still in memory, so the original was never downloaded.
    expect(sources, 'a held upload was downloaded again to thumbnail it').toEqual([])
  })
})

test.describe('thumbnail machine — upload pipeline', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('publishes a local blur first, then a persisted 512px thumbnail', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    const { events } = await readProbe(page)
    const forItem = events.filter((e) => e.itemId === itemId)

    const stage1 = forItem.find((e) => e.stage === 1)
    const stage2 = forItem.find((e) => e.stage === 2)

    expect(stage1, 'stage 1 blur was never published').toBeTruthy()
    expect(stage2, 'stage 2 was never published').toBeTruthy()

    // Stage 1 never leaves the browser; stage 2 is the persisted object.
    expect(stage1!.src).toMatch(/^blob:/)
    expect(stage2!.src).toMatch(stageUrlPattern(itemId, 2))

    // Ordering, from real timestamps rather than array position.
    expect(stage1!.at).toBeLessThan(stage2!.at)
  })

  test('the stage-2 URL is a real WebP on S3, not just a string the machine reported', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    // Stage 3 PUTs to the same object key as stage 2, so the bytes can change
    // under a stage read taken before the fetch. Let the pipeline finish, then
    // compare the final published size against the final object.
    await waitForIdle(page, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)
    expect(published).not.toBeNull()

    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(object.ok, `S3 returned ${object.status} for ${published!.src}`).toBe(true)
    expect(object.bytes).toBeGreaterThan(0)
    // Checked from the file's own RIFF/WEBP magic, not the bucket's header.
    expect(object.isWebp).toBe(true)

    // And it is genuinely displayable, at the size the pipeline claims.
    const decoded = await decodeImage(page, published!.src)
    expect(decoded.decoded).toBe(true)
    expect(decoded.width).toBeGreaterThan(0)
    expect(decoded.height).toBeGreaterThan(0)
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(512)

    // The queue is idle, so nothing can overwrite the object any more: whichever
    // stage finished last, its reported size must be the size of the bytes.
    expect(published!.width).toBe(decoded.width)
    expect(published!.height).toBe(decoded.height)
  })

  test('the card paints what the machine published', async ({ page }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    // Read once the job is done, so a stage-3 upgrade can't swap the src
    // between reading it and finding the image.
    await waitForIdle(page, PIPELINE_TIMEOUT - 40_000)
    const published = await progressFor(page, itemId)

    const img = page.locator(
      `img[data-slot="item-thumbnail-image"][src="${published!.src}"]`
    )
    await expect(img).toBeVisible({ timeout: 30_000 })
    await expect(img).toHaveAttribute('data-stage', String(published!.stage))

    // The browser actually decoded it — a broken URL still yields a visible node.
    // The node is visible as soon as it is laid out, before the signed S3 GET
    // has returned, so a single read of `complete` raced the download (CI run
    // 43322566348: received false). Poll until the browser has finished it.
    await expect
      .poll(
        () =>
          img.evaluate((el: HTMLImageElement) => ({
            complete: el.complete,
            w: el.naturalWidth,
            h: el.naturalHeight,
          })),
        { timeout: 30_000 }
      )
      .toMatchObject({ complete: true, w: expect.any(Number) })
    const natural = await img.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }))
    expect(natural.w).toBeGreaterThan(0)
    expect(natural.h).toBeGreaterThan(0)
  })

  test('a text file goes through the text-render path and persists', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.ts`
    await uploadPage.dropRealFiles([{ name, kind: 'text' }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)

    expect(published!.src).toMatch(stageUrlPattern(itemId, 2))
    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(object.ok).toBe(true)
    expect(object.isWebp).toBe(true)

    // A text page is rendered A4-proportioned, so it must be taller than wide —
    // this is what distinguishes a real render from a blank or square fallback.
    const decoded = await decodeImage(page, published!.src)
    expect(decoded.decoded).toBe(true)
    expect(decoded.height).toBeGreaterThan(decoded.width)
  })

  test('a type with no producer publishes nothing rather than inventing a thumbnail', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.bin`
    await uploadPage.dropRealFiles([{ name, kind: 'bin' }])

    await uploadPage.waitForItemCreated(name, 120_000)
    // Let the pipeline run to completion rather than asserting on a gap.
    await waitForIdle(page, 120_000)

    const probe = await readProbe(page)
    expect(
      probe.events,
      `expected no thumbnail for an unrenderable type, got ${JSON.stringify(probe.events)}`
    ).toEqual([])

    // …but the indexing leg still ran. It is deliberately independent of
    // thumbnails, and this is the assertion that would catch the two being
    // wired together again. It is read from the indexing run's final state:
    // since `51ca00d` (tech-debt item 40) a file with nothing to save, like
    // this `.bin`, ends in `indexed` without posting `save_media_metadata`.
    await expect
      .poll(async () => Object.values((await readProbe(page)).indexingLastState), {
        message: 'the indexing leg never ran for a file with no thumbnail',
        timeout: 60_000,
      })
      .toEqual(['indexed'])
    expect(
      (await readProbe(page)).metadataSeen,
      'a .bin has nothing to save, so nothing is posted'
    ).toEqual([])
  })

  // Stage 3 needs no WebGPU: it is native face detection, else a geometric
  // centre crop (`thumbnail.ai.ts` — the ViT pass is commented out). So it runs
  // for every image in every browser and is asserted unconditionally.
  test('stage 3 publishes a 512px square crop for an image', async ({ page }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 3, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)

    expect(published!.stage).toBe(3)
    expect(published!.src).toMatch(stageUrlPattern(itemId, 3))

    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(object.ok).toBe(true)
    expect(object.isWebp).toBe(true)

    // A square, whatever the source's aspect (this one is 640×480).
    const decoded = await decodeImage(page, published!.src)
    expect([decoded.width, decoded.height]).toEqual([512, 512])
    expect([published!.width, published!.height]).toEqual([512, 512])
  })
})

test.describe('thumbnail machine — scheduling', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('the memory lane never exceeds its cap, and drains the whole batch', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const id = runId()
    const files = Array.from({ length: 8 }, (_, i) => ({
      name: `e2e-thumb-${id}-${i}.png`,
      kind: 'png' as const,
      // Small enough that eight of them finish inside the timeout, big enough
      // that the compute is real work rather than instant.
      sizePx: 320,
    }))
    await uploadPage.dropRealFiles(files)

    // Eight cards fit in an empty folder's first screen, so all eight are
    // visible and each gets a memory-lane job.
    await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 40_000)
    await waitForIdle(page, PIPELINE_TIMEOUT - 20_000)

    const probe = await readProbe(page)

    // Observed from the real actor across the whole run, not asserted in advance.
    expect(probe.maxRunningByMode.fromMemory ?? 0).toBeGreaterThan(1)
    expect(probe.maxRunningByMode.fromMemory ?? 0).toBeLessThanOrEqual(4)

    const state = await readManager(page)
    expect(state.running).toEqual([])
    expect(state.queue).toEqual([])

    // Every file that produced a thumbnail reached the persisted stage.
    const persisted = probe.events.filter((e) => e.stage >= 2)
    expect(persisted.length).toBeGreaterThan(0)
    for (const e of persisted) expect(e.src).toMatch(anyStageUrlPattern())
  })

  test('download lane caps at two and starts the most recent requests first', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    // Four downloads enqueued in one turn. These ids do not resolve to files,
    // so each job legitimately ends in `sourceUnavailable` after a real round trip to
    // `/api/thumbnails/:id/source` — which is all this test needs: it is
    // asserting the lane's ordering and cap, not the job's outcome.
    //
    // One `page.evaluate`, not one per job: each evaluate is its own turn, and
    // the lane drains between turns, so the first job used to start alone
    // before the rest were queued and the "newest first" batch was never formed.
    await page.evaluate(() => {
      const mgr = window.__thumbMgr!
      for (const itemId of ['zz-lane-1', 'zz-lane-2', 'zz-lane-3', 'zz-lane-4']) {
        mgr.send({ type: 'enqueue', job: { itemId, mode: 'fromDownload', file: null } })
      }
    })

    await waitForIdle(page, 60_000)
    const probe = await readProbe(page)

    expect(probe.maxRunningByMode.fromDownload).toBe(2)
    // LIFO — the newest two run first, because they are the cards the user just
    // scrolled to. The batch is spawned inside one `assign`, so this is the
    // whole first batch, not a sampling artefact.
    expect(new Set(probe.firstRunningByMode.fromDownload)).toEqual(
      new Set(['zz-lane-4', 'zz-lane-3'])
    )
  })

  test('pausing stops the download lane structurally; resuming drains it', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await expectManagerReady(page)

    // One synchronous turn. `send` is synchronous in XState 5, so nothing —
    // not React, not the network — can interleave. That matters here: the
    // upload runner's own effect calls `resumeDownloads()` on mount whenever
    // nothing is uploading, and would otherwise stomp a pause sent from a test.
    const paused = await page.evaluate(() => {
      const mgr = window.__thumbMgr!
      mgr.send({ type: 'pauseDownloads' })
      mgr.send({
        type: 'enqueue',
        job: { itemId: 'zz-paused-1', mode: 'fromDownload', file: null },
      })

      // The claim under test is that pausing is *structural*, not a flag read
      // by a drain loop: `startQueuedDownloads` simply has no handler in `paused`.
      // Firing it directly is a stronger check than waiting to see nothing
      // happen, which could also mean the idle callback just hadn't run.
      mgr.send({ type: 'startQueuedDownloads' })

      const s = mgr.getSnapshot()
      return {
        value: JSON.stringify(s.value),
        running: Array.from(s.context.running.keys()),
        queue: s.context.queue.map((j) => `${j.mode}:${j.itemId}`),
      }
    })

    expect(paused.value).toContain('"downloadLane":"paused"')
    expect(paused.running).toEqual([])
    expect(paused.queue).toEqual(['fromDownload:zz-paused-1'])

    // Resuming re-enters `active`, whose entry action schedules the drain.
    await sendToManager(page, { type: 'resumeDownloads' })
    await waitForIdle(page, 30_000)

    const resumed = await readManager(page)
    expect(resumed.value).toContain('"downloadLane":"active"')
    expect(resumed.queue).toEqual([])
  })

  test('an upload pauses the download lane and hands it back afterwards', async ({
    page,
  }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 480 }])

    // The upload runner calls pauseDownloads() while its queue is non-empty.
    await expect
      .poll(async () => (await readManager(page)).value, {
        message: 'download lane never paused during an upload',
        timeout: 60_000,
      })
      .toContain('"downloadLane":"paused"')

    await uploadPage.waitForItemCreated(name)
    await waitForIdle(page, PIPELINE_TIMEOUT - 40_000)

    await expect
      .poll(async () => (await readManager(page)).value, {
        message: 'download lane never resumed after the upload drained',
        timeout: 60_000,
      })
      .toContain('"downloadLane":"active"')

    const probe = await readProbe(page)
    // Both transitions really happened, in order.
    expect(probe.laneSamples.some((s) => s.includes('"downloadLane":"paused"'))).toBe(true)
  })

  test('a queued job can be cancelled but a running one is left to finish', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await expectManagerReady(page)

    // Both halves in one synchronous turn. A job against an unresolvable id
    // settles in tens of milliseconds, so reading the "running" case a round
    // trip later cannot tell *survived the cancel* from *already finished* —
    // which is what made an earlier version of this test lie.
    const result = await page.evaluate(() => {
      const mgr = window.__thumbMgr!
      const ids = () => Array.from(mgr.getSnapshot().context.running.keys())
      const queue = () =>
        mgr.getSnapshot().context.queue.map((j) => `${j.mode}:${j.itemId}`)

      mgr.send({ type: 'pauseDownloads' })
      for (const itemId of ['zz-cancel-1', 'zz-cancel-2', 'zz-cancel-3']) {
        mgr.send({ type: 'enqueue', job: { itemId, mode: 'fromDownload', file: null } })
      }
      const queuedBefore = queue()

      // A queued job is dropped…
      mgr.send({ type: 'cancel', itemId: 'zz-cancel-2' })
      const queuedAfterCancel = queue()

      // …while a running one is kept: its download is already paid for, and the
      // manager outlives the card that asked, so the result still persists.
      mgr.send({ type: 'resumeDownloads' })
      mgr.send({ type: 'startQueuedDownloads' })
      const runningBefore = ids()
      const target = runningBefore[0]
      mgr.send({ type: 'cancel', itemId: target })
      const runningAfter = ids()

      return { queuedBefore, queuedAfterCancel, runningBefore, runningAfter, target }
    })

    expect(result.queuedBefore).toEqual([
      'fromDownload:zz-cancel-1',
      'fromDownload:zz-cancel-2',
      'fromDownload:zz-cancel-3',
    ])
    expect(result.queuedAfterCancel).toEqual([
      'fromDownload:zz-cancel-1',
      'fromDownload:zz-cancel-3',
    ])

    // LIFO: the newest survivors start first, and the lane caps at two.
    expect(result.runningBefore).toEqual(['zz-cancel-3', 'zz-cancel-1'])
    // Cancelling a running job is a deliberate no-op.
    expect(result.runningAfter).toEqual(result.runningBefore)

    await waitForIdle(page, 30_000)
  })
})

test.describe('thumbnail machine — durability', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('a started job survives leaving the page that started it', async ({ page }) => {
    const { uploadPage } = await openEmptyFolder(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    // Leave as soon as the first stage lands: the card was on screen, so its
    // job started, and is now mid-flight.
    const itemId = await waitForAnyItemAtStage(page, 1, 90_000)

    // Client-side navigation — the card unmounts but the module graph, and so
    // the scheduler, live on. (A full reload would legitimately kill it.)
    await page.locator('a[href*="/stash/all"]').first().click()
    await expect(page).toHaveURL(/\/stash\/all/, { timeout: 30_000 })

    // The work started by the now-unmounted card still completes and persists.
    await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 60_000)
    const published = await progressFor(page, itemId)
    expect(published!.stage).toBeGreaterThanOrEqual(2)

    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(
      object.ok,
      'thumbnail was abandoned when its card unmounted'
    ).toBe(true)
    expect(object.isWebp).toBe(true)
  })
})
