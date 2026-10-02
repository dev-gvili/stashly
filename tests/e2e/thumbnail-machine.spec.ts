/**
 * E2E for the XState thumbnail pipeline (`app/machines/thumbnail`).
 *
 * These drive the **real** system: a real drop into the real upload machine, the
 * real compute worker doing a real decode/resize/WebP encode, a real presigned
 * PUT to S3, and the real scheduler in the page. Assertions read the actual
 * actor (`window.__thumbMgr`), the actual DOM it paints, and — for anything
 * claimed to be persisted — the actual bytes fetched back over HTTP.
 *
 * Nothing here stubs an actor or asserts a value the test itself supplied. Where
 * a capability may be missing from the browser (WebGPU for stage 3), the test
 * reports that and skips rather than pretending the stage ran.
 *
 * **Side effect:** these upload real files to the E2E user's stash and bucket.
 * Everything is named `e2e-thumb-*` so it is easy to find and remove.
 */
import { test, expect } from './fixtures'
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
} from './helpers/thumbnail-machine'

/** Uploads plus real image compute; generous but bounded. */
const PIPELINE_TIMEOUT = 180_000

/** Unique per run so a re-run never collides with a previous run's items. */
const runId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

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

test.describe('thumbnail machine — upload pipeline', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('publishes a local blur first, then a persisted 512px thumbnail', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    // Installed before the drop: the point of a progressive pipeline is the
    // ordering, and only the final state is visible after the fact.
    await installProbe(page)

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
    expect(stage2!.src).toMatch(new RegExp(`/thumbnails/${itemId}\\.webp\\?v=2$`))

    // Ordering, from real timestamps rather than array position.
    expect(stage1!.at).toBeLessThan(stage2!.at)
  })

  test('the stage-2 URL is a real WebP on S3, not just a string the machine reported', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
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

    // The dimensions the machine reported must match the actual image.
    expect(published!.width).toBe(decoded.width)
    expect(published!.height).toBe(decoded.height)
  })

  test('the card paints what the machine published', async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)

    const img = page.locator(
      `img[data-slot="item-thumbnail-image"][src="${published!.src}"]`
    )
    await expect(img).toBeVisible({ timeout: 30_000 })
    await expect(img).toHaveAttribute('data-stage', String(published!.stage))

    // The browser actually decoded it — a broken URL still yields a visible node.
    const natural = await img.evaluate((el: HTMLImageElement) => ({
      complete: el.complete,
      w: el.naturalWidth,
      h: el.naturalHeight,
    }))
    expect(natural.complete).toBe(true)
    expect(natural.w).toBeGreaterThan(0)
    expect(natural.h).toBeGreaterThan(0)
  })

  test('a text file goes through the text-render path and persists', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.ts`
    await uploadPage.dropRealFiles([{ name, kind: 'text' }])

    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)

    expect(published!.src).toMatch(/\?v=2$/)
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
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.bin`
    await uploadPage.dropRealFiles([{ name, kind: 'bin' }])

    await uploadPage.waitForUploadDone(name, 120_000)
    // Let the pipeline run to completion rather than asserting on a gap.
    await waitForIdle(page, 120_000)

    const probe = await readProbe(page)
    expect(
      probe.events,
      `expected no thumbnail for an unrenderable type, got ${JSON.stringify(probe.events)}`
    ).toEqual([])

    // …but the indexing leg still ran. It is deliberately independent of the
    // stages: a file with no preview still has metadata worth saving, and this
    // is the assertion that would catch the two being wired together again.
    expect(
      probe.metadataSeen.length,
      'the indexing leg never ran for a file with no thumbnail'
    ).toBeGreaterThan(0)
  })

  test('stage 3 runs when the browser has WebGPU, and is skipped honestly when it does not', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)

    const hasWebGpu = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
      if (!gpu) return false
      try {
        return !!(await gpu.requestAdapter())
      } catch {
        return false
      }
    })

    test.skip(
      !hasWebGpu,
      'No WebGPU adapter in this browser — stage 3 (saliency crop) cannot run, so asserting it would be fiction.'
    )

    await installProbe(page)
    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    const itemId = await waitForAnyItemAtStage(page, 3, PIPELINE_TIMEOUT - 20_000)
    const published = await progressFor(page, itemId)

    expect(published!.stage).toBe(3)
    expect(published!.src).toMatch(/\?v=3$/)

    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(object.ok).toBe(true)
    expect(object.isWebp).toBe(true)
  })
})

test.describe('thumbnail machine — scheduling', () => {
  test.describe.configure({ timeout: PIPELINE_TIMEOUT })

  test('never exceeds the upload concurrency cap, and drains the whole batch', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const id = runId()
    const files = Array.from({ length: 8 }, (_, i) => ({
      name: `e2e-thumb-${id}-${i}.png`,
      kind: 'png' as const,
      // Small enough that eight of them finish inside the timeout, big enough
      // that the compute is real work rather than instant.
      sizePx: 320,
    }))
    await uploadPage.dropRealFiles(files)

    await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 40_000)
    await waitForIdle(page, PIPELINE_TIMEOUT - 20_000)

    const probe = await readProbe(page)

    // Observed from the real actor across the whole run, not asserted in advance.
    expect(probe.maxRunningByMode.upload ?? 0).toBeGreaterThan(1)
    expect(probe.maxRunningByMode.upload ?? 0).toBeLessThanOrEqual(4)

    const state = await readManager(page)
    expect(state.running).toEqual([])
    expect(state.queue).toEqual([])

    // Every file that produced a thumbnail reached the persisted stage.
    const persisted = probe.events.filter((e) => e.stage >= 2)
    expect(persisted.length).toBeGreaterThan(0)
    for (const e of persisted) expect(e.src).toMatch(/\?v=[23]$/)
  })

  test('download lane caps at two and starts the most recent requests first', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    // Four downloads enqueued in one turn. These ids do not resolve to files,
    // so each job legitimately ends in `unavailable` after a real round trip to
    // `/api/thumbnails/:id/source` — which is all this test needs: it is
    // asserting the lane's ordering and cap, not the job's outcome.
    const ids = ['zz-lane-1', 'zz-lane-2', 'zz-lane-3', 'zz-lane-4']
    for (const itemId of ids) {
      await sendToManager(page, {
        type: 'enqueue',
        job: { itemId, mode: 'fromDownload', file: null },
      })
    }

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
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 480 }])

    // The upload runner calls pauseDownloads() while its queue is non-empty.
    await expect
      .poll(async () => (await readManager(page)).value, {
        message: 'download lane never paused during an upload',
        timeout: 60_000,
      })
      .toContain('"downloadLane":"paused"')

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

  test('the pipeline survives leaving the page that started it', async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto(TEST_USER_ID)
    await installProbe(page)

    const name = `e2e-thumb-${runId()}.png`
    await uploadPage.dropRealFiles([{ name, kind: 'png', sizePx: 640 }])

    // Leave as soon as the first stage lands, while the pipeline is mid-flight.
    await waitForAnyItemAtStage(page, 1, 90_000)

    // Client-side navigation — the card unmounts but the module graph, and so
    // the scheduler, live on. (A full reload would legitimately kill it.)
    await page.locator('a[href*="/stash/all"]').first().click()
    await expect(page).toHaveURL(/\/stash\/all/, { timeout: 30_000 })

    // The work started by the now-unmounted card still completes and persists.
    const itemId = await waitForAnyItemAtStage(page, 2, PIPELINE_TIMEOUT - 60_000)
    const published = await progressFor(page, itemId)

    const object = await fetchPersistedThumbnail(page, published!.src)
    expect(
      object.ok,
      'thumbnail was abandoned when its card unmounted'
    ).toBe(true)
    expect(object.isWebp).toBe(true)
  })
})
