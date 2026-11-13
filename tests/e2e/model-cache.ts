/**
 * Keeps the browser from re-downloading the search-indexing models in every
 * test.
 *
 * Every test opens a fresh browser context, so its cache is empty, and any
 * upload makes the page start indexing: it downloads the embedding model
 * (`Xenova/all-mpnet-base-v2`, 149 MB, from huggingface.co) and the
 * onnxruntime wasm (jsDelivr). Those share the AI queue with the stage-3 crop,
 * so a thumbnail test waited 10-11 s on a download instead of 2 s (traces,
 * 13 Nov: 5.6 s for the model, 4.1 s for the wasm, in every test tab).
 *
 * The page still makes the same requests, and still gets the real bytes. The
 * first response to each URL is saved to disk (`tests/e2e/.cache/net`), and
 * later ones are answered with a **redirect to a small local file server** that
 * serves the saved copy with its original headers and range support. The body
 * never goes through `route.fulfill`: fulfilling the 149 MB model that way
 * killed the tab (5 tests failed 3 runs of 3).
 *
 * `E2E_NO_NET_CACHE=1` turns it off. CI keeps the directory between runs; the
 * cache key there names the model, so bump it to drop a stale one.
 */
import type { BrowserContext, Route } from '@playwright/test'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

const CACHE_DIR = path.join(process.cwd(), 'tests/e2e/.cache/net')
const CACHED = /^https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//

type Meta = { status: number; headers: Record<string, string> }

const keyOf = (url: string, range: string) =>
  createHash('sha1').update(`${url}\n${range}`).digest('hex')
const metaPath = (key: string) => path.join(CACHE_DIR, `${key}.json`)
const bodyPath = (key: string) => path.join(CACHE_DIR, `${key}.bin`)

/** In flight downloads by key, so two tabs asking at once share one. */
const downloads = new Map<string, Promise<boolean>>()

/** Saves one response to disk. False when the host answered with an error. */
function download(url: string, range: string, key: string): Promise<boolean> {
  const running = downloads.get(key)
  if (running) return running
  const job = (async () => {
    const res = await fetch(url, { headers: range ? { range } : {} })
    if (res.status !== 200 && res.status !== 206) return false
    const headers: Record<string, string> = {}
    res.headers.forEach((value, name) => {
      // The body is stored decoded and served whole, so these would lie.
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(name)) {
        headers[name] = value
      }
    })
    const tmp = `${bodyPath(key)}.${process.pid}.tmp`
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
    fs.renameSync(tmp, bodyPath(key))
    fs.writeFileSync(metaPath(key), JSON.stringify({ status: res.status, headers } satisfies Meta))
    return true
  })().finally(() => downloads.delete(key))
  downloads.set(key, job)
  return job
}

let server: Promise<number> | undefined

/** One file server per worker process, on a free port; closes with the process. */
function startServer(): Promise<number> {
  server ??= new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const key = (req.url ?? '').replace(/^\/|\?.*$/g, '')
      if (!/^[0-9a-f]{40}$/.test(key) || !fs.existsSync(bodyPath(key))) {
        res.writeHead(404).end()
        return
      }
      const meta = JSON.parse(fs.readFileSync(metaPath(key), 'utf8')) as Meta
      const size = fs.statSync(bodyPath(key)).size
      const headers = {
        ...meta.headers,
        'access-control-allow-origin': '*',
        'access-control-expose-headers': '*',
        'content-length': String(size),
      }
      res.writeHead(meta.status, headers)
      fs.createReadStream(bodyPath(key)).pipe(res)
    })
    s.unref()
    s.listen(0, '127.0.0.1', () => resolve((s.address() as AddressInfo).port))
  })
  return server
}

export async function cacheModelDownloads(context: BrowserContext): Promise<void> {
  if (process.env.E2E_NO_NET_CACHE) return
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const port = await startServer()

  await context.route(CACHED, async (route: Route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.continue()
    const range = request.headers()['range'] ?? ''
    const key = keyOf(request.url(), range)
    const cached = fs.existsSync(metaPath(key)) && fs.existsSync(bodyPath(key))
    if (!cached && !(await download(request.url(), range, key).catch(() => false))) {
      return route.continue()
    }
    // The headers carry what a cross-origin fetch needs to follow the redirect.
    return route.fulfill({
      status: 302,
      headers: {
        location: `http://127.0.0.1:${port}/${key}`,
        'access-control-allow-origin': '*',
      },
    })
  })
}
