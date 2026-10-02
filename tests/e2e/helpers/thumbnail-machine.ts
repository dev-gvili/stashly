/**
 * Test seams for the XState thumbnail pipeline (`app/machines/thumbnail`).
 *
 * Everything here reads the **real** scheduler running in the page —
 * `window.__thumbMgr`, the singleton started in `client.ts` — and the real DOM
 * it paints. Nothing is stubbed, and no result is synthesised: a stage is only
 * reported when the machine actually emitted it, and a persisted URL is only
 * accepted after it has been fetched back over HTTP.
 *
 * Do **not** reach the scheduler with a raw `import()` from `page.evaluate`.
 * Under Vite that returns a fresh module graph with its own actor that nothing
 * is subscribed to, so the pipeline reads as broken while it is working fine.
 * `window.__thumbMgr` is the app's instance.
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** One stage publication, exactly as the item machine emitted it. */
export interface ProgressEvent {
  itemId: string
  stage: 1 | 2 | 3
  src: string
  width?: number
  height?: number
  /** ms since the recorder was installed — proves ordering, not just presence. */
  at: number
}

export interface ManagerState {
  /** e.g. `{ memoryLane: {}, downloadLane: 'active' }` */
  value: string
  running: string[]
  queue: string[]
  progressKeys: string[]
  metadataSaved: string[]
}

declare global {
  interface Window {
    __thumbMgr?: {
      getSnapshot: () => {
        value: unknown
        context: {
          running: Map<string, { mode: string }>
          queue: { itemId: string; mode: string }[]
          progress: Map<
            string,
            { stage: 1 | 2 | 3; src: string; width?: number; height?: number }
          >
        }
      }
      subscribe: (fn: (s: unknown) => void) => { unsubscribe: () => void }
      send: (event: Record<string, unknown>) => void
    }
    /** The indexing queue (`app/machines/indexing/client.ts`), which owns metadata saves. */
    __indexingQueue?: {
      getSnapshot: () => { context: { metadataSaved: string[] } }
      subscribe: (fn: (s: unknown) => void) => { unsubscribe: () => void }
    }
    __thumbProbe?: {
      events: ProgressEvent[]
      maxRunning: number
      maxRunningByMode: Record<string, number>
      firstRunningByMode: Record<string, string[]>
      /** Every item ever seen in the revalidation buffer — see `installProbe`. */
      metadataSeen: string[]
      laneSamples: string[]
      stop: () => void
    }
  }
}

/** Fails loudly rather than silently passing if the app never booted the actor. */
export async function expectManagerReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => !!window.__thumbMgr), {
      message: 'window.__thumbMgr never appeared — the scheduler did not start',
      timeout: 15_000,
    })
    .toBe(true)
}

/**
 * Starts recording every progress publication and every concurrency sample.
 *
 * Must be installed **before** the action under test, because the interesting
 * part of stage 1 is that it happens early — asserting on the final state alone
 * cannot tell a progressive pipeline from one that only ever paints once.
 */
export async function installProbe(page: Page): Promise<void> {
  await expectManagerReady(page)
  await page.evaluate(() => {
    const mgr = window.__thumbMgr!
    if (window.__thumbProbe) window.__thumbProbe.stop()

    const t0 = performance.now()
    const events: ProgressEvent[] = []
    const seen = new Map<string, string>()
    const probe = {
      events,
      maxRunning: 0,
      maxRunningByMode: {} as Record<string, number>,
      firstRunningByMode: {} as Record<string, string[]>,
      metadataSeen: [] as string[],
      laneSamples: [] as string[],
      stop: () => {
        sub.unsubscribe()
        indexingSub?.unsubscribe()
      },
    }

    const sub = mgr.subscribe(() => {
      const c = mgr.getSnapshot().context

      // Record a publication only when the item's entry actually changed, so a
      // re-render or an unrelated item advancing can't inflate the sequence.
      for (const [itemId, p] of c.progress) {
        const key = `${p.stage}|${p.src}`
        if (seen.get(itemId) === key) continue
        seen.set(itemId, key)
        events.push({
          itemId,
          stage: p.stage,
          src: p.src,
          width: p.width,
          height: p.height,
          at: Math.round(performance.now() - t0),
        })
      }

      probe.maxRunning = Math.max(probe.maxRunning, c.running.size)
      const byMode: Record<string, string[]> = {}
      for (const [itemId, entry] of c.running) {
        ;(byMode[entry.mode] ??= []).push(itemId)
      }
      for (const [mode, ids] of Object.entries(byMode)) {
        probe.maxRunningByMode[mode] = Math.max(
          probe.maxRunningByMode[mode] ?? 0,
          ids.length
        )
        // The first batch a lane starts is what proves its ordering. A drain
        // spawns its whole batch inside one `assign`, so the first snapshot
        // showing the lane busy is the batch itself — no sampling race.
        probe.firstRunningByMode[mode] ??= ids
      }

      const lane = JSON.stringify(mgr.getSnapshot().value)
      if (probe.laneSamples[probe.laneSamples.length - 1] !== lane) {
        probe.laneSamples.push(lane)
      }
    })

    // Metadata saves live on the indexing queue, which empties its list as
    // soon as the page reloads. Recorded on the way past, which is the only
    // way to prove indexing ran for a file that produced no thumbnail.
    const indexing = window.__indexingQueue
    const indexingSub = indexing?.subscribe(() => {
      for (const itemId of indexing.getSnapshot().context.metadataSaved) {
        if (!probe.metadataSeen.includes(itemId)) probe.metadataSeen.push(itemId)
      }
    })

    window.__thumbProbe = probe
  })
}

export async function readProbe(page: Page) {
  return page.evaluate(() => ({
    events: window.__thumbProbe?.events ?? [],
    maxRunning: window.__thumbProbe?.maxRunning ?? 0,
    maxRunningByMode: window.__thumbProbe?.maxRunningByMode ?? {},
    firstRunningByMode: window.__thumbProbe?.firstRunningByMode ?? {},
    metadataSeen: window.__thumbProbe?.metadataSeen ?? [],
    laneSamples: window.__thumbProbe?.laneSamples ?? [],
  }))
}

export async function readManager(page: Page): Promise<ManagerState> {
  return page.evaluate(() => {
    const c = window.__thumbMgr!.getSnapshot()
    return {
      value: JSON.stringify(c.value),
      running: Array.from(c.context.running.keys()),
      queue: c.context.queue.map((j) => `${j.mode}:${j.itemId}`),
      progressKeys: Array.from(c.context.progress.keys()),
      metadataSaved: [
        ...(window.__indexingQueue?.getSnapshot().context.metadataSaved ?? []),
      ],
    }
  })
}

/**
 * Waits until at least one item has published `stage` or better, and returns
 * that item's id. Uploads assign the item id inside the app, so tests learn it
 * from the pipeline rather than guessing it.
 */
export async function waitForAnyItemAtStage(
  page: Page,
  stage: 1 | 2 | 3,
  timeout = 120_000
): Promise<string> {
  const handle = await page.waitForFunction(
    (min) => {
      const c = window.__thumbMgr?.getSnapshot().context
      if (!c) return null
      for (const [itemId, p] of c.progress) if (p.stage >= min) return itemId
      return null
    },
    stage,
    { timeout, polling: 100 }
  )
  return handle.jsonValue() as Promise<string>
}

/** Waits for the whole queue to drain — nothing queued, nothing running. */
export async function waitForIdle(page: Page, timeout = 180_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const c = window.__thumbMgr?.getSnapshot().context
      return !!c && c.running.size === 0 && c.queue.length === 0
    },
    undefined,
    { timeout, polling: 200 }
  )
}

export async function progressFor(page: Page, itemId: string) {
  return page.evaluate(
    (id) => window.__thumbMgr!.getSnapshot().context.progress.get(id) ?? null,
    itemId
  )
}

/**
 * Fetches a persisted thumbnail URL back from S3.
 *
 * This is what separates "the machine says it uploaded" from "the bytes are
 * really there": the assertion only passes if the object is reachable, is a
 * WebP, and is non-empty.
 */
export async function fetchPersistedThumbnail(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u, { cache: 'no-store' })
    const buf = res.ok ? await res.arrayBuffer() : new ArrayBuffer(0)
    const head = new Uint8Array(buf.slice(0, 12))
    const ascii = (a: number, b: number) =>
      String.fromCharCode(...Array.from(head.slice(a, b)))
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      bytes: buf.byteLength,
      // WebP on the wire is "RIFF"…"WEBP" — checked from the bytes themselves
      // rather than trusting the Content-Type header the bucket returns.
      isWebp: ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    }
  }, url)
}

/** Decodes a URL in the page to confirm it is a real, displayable image. */
export async function decodeImage(page: Page, url: string) {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-store' })
      if (!res.ok) return { decoded: false, width: 0, height: 0 }
      const bitmap = await createImageBitmap(await res.blob())
      const out = { decoded: true, width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return out
    } catch {
      return { decoded: false, width: 0, height: 0 }
    }
  }, url)
}

/** Drives the real scheduler's pause control, as the upload runner does. */
export async function sendToManager(
  page: Page,
  event: Record<string, unknown>
): Promise<void> {
  await page.evaluate((e) => window.__thumbMgr!.send(e), event)
}
