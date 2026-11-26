/**
 * E2E for search permalinks: a result card links to the exact hit it shows
 * (`?line=&col=&lines=index`), and the file page lands there — the line tinted
 * for a moment, the hit word selected or highlighted.
 *
 * **Real files, real flow.** Each test uploads a real file from this repo
 * (`app/.client/monaco.ts`, `docs/semantic-search.md`) through the upload panel
 * into its own empty folder, lets the tab index it as any upload is indexed,
 * and searches with the folder as scope. The expected line and column of every
 * hit are computed here from the same bytes, with the app's rule: a hit starts
 * a word (the character before it is not a letter or digit), case-insensitive.
 *
 * **The landing tint is stretched for the assertions.** Both viewers clear it
 * with a 2400 ms timer, which a slow first Monaco paint can leave too little
 * of to observe. An init script turns that one delay into ten minutes; nothing
 * else is changed.
 *
 * **Side effect:** uploads the two files into `e2e-permalink-*` folders under
 * the E2E root.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { UploadPage } from './pages/upload.page'
import { TEST_USER_ID } from './constants'
import { createEmptyFolder } from './helpers/thumbnail-machine'

const runId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

type Hit = { line: number; column: number }

/** Every word-start hit of `term` in `text`, as 1-based line and column. */
function wordStartHits(text: string, term: string): Hit[] {
  const lower = text.toLowerCase()
  const hits: Hit[] = []
  for (let i = lower.indexOf(term); i >= 0; i = lower.indexOf(term, i + 1)) {
    if (i > 0 && /[\p{L}\p{N}]/u.test(text[i - 1])) continue
    const before = text.slice(0, i)
    hits.push({ line: before.split('\n').length, column: i - before.lastIndexOf('\n') })
  }
  return hits
}

const repoFile = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')

/** Drops one file with real text content, as a drag from the desktop does. */
async function dropTextFile(page: Page, name: string, content: string, type: string) {
  await new UploadPage(page).openPanel()
  await page.evaluate(
    ({ name, content, type }) => {
      const dropArea = document.querySelector('[data-testid="upload-drop-area"]')
      if (!dropArea) throw new Error('DropArea not found')
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(new File([content], name, { type }))
      dropArea.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }))
    },
    { name, content, type }
  )
}

/**
 * Uploads a real file into a fresh folder and waits until the search index
 * holds its body: the keyword route answers it as a `content` match.
 */
async function uploadAndIndex(page: Page, name: string, content: string, type: string, term: string) {
  const folderId = await createEmptyFolder(page, `e2e-permalink-${runId()}`)
  const uploadPage = new UploadPage(page)
  await uploadPage.gotoFolder(TEST_USER_ID, folderId)
  await dropTextFile(page, name, content, type)
  await uploadPage.waitForItemCreated(name)

  // Indexing runs in this tab after the row exists; keep it open meanwhile.
  await expect(async () => {
    const res = await page.request.get(
      `/api/search/items?query=${encodeURIComponent(term)}&in=${encodeURIComponent(`folder:${folderId}`)}`
    )
    expect(res.ok()).toBe(true)
    const body = (await res.json()) as { items?: { name: string; matchKind?: string }[] }
    expect(body.items?.find((i) => i.name === name)?.matchKind).toBe('content')
  }).toPass({ timeout: 90_000, intervals: [1_000, 2_000] })
  return folderId
}

const card = (page: Page, name: string) =>
  page.locator('[data-slot="item-card"]').filter({ hasText: name.replace(/\.[^.]+$/, '') })

/** The card's file link, which carries the permalink of the hit on screen. */
const cardLink = (c: Locator) => c.locator('a[href*="/files/"]').first()

/**
 * Opens the card the way a user does: a click on its body. The link itself is
 * a `pointer-events-none` overlay the card's click handler follows, so the
 * card navigates to whatever permalink the link holds at that moment.
 */
async function openCard(c: Locator) {
  await c.click()
}

function linkHit(href: string): Hit & { basis: string | null } {
  const params = new URL(href, 'http://localhost').searchParams
  return { line: Number(params.get('line')), column: Number(params.get('col')), basis: params.get('lines') }
}

/** The stepper's "3/7 hits" or "3–4/7 hits": the first hit the stop covers. */
async function stopFrom(c: Locator): Promise<number> {
  const label = await c.getByText(/\/\d+ hits?$/).textContent()
  return Number(label!.match(/^(\d+)/)![1])
}

/** Walks every arrow stop, checking each link against the hit it covers. */
async function expectEveryStopLinksToItsHit(c: Locator, hits: Hit[]) {
  const next = c.getByRole('button', { name: 'Next hit' })
  // The first press loads the passages; the stepper then shows "n/N hits".
  await expect(async () => {
    await next.click()
    await expect(c.getByText(new RegExp(`/${hits.length} hits$`))).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })

  const seen = new Set<number>()
  for (let guard = 0; guard < hits.length + 1; guard++) {
    const from = await stopFrom(c)
    if (seen.has(from)) break
    seen.add(from)
    const href = (await cardLink(c).getAttribute('href'))!
    expect(linkHit(href), `stop ${from}`).toEqual({ ...hits[from - 1], basis: 'index' })
    await next.click()
    await expect.poll(() => stopFrom(c)).not.toBe(from)
  }
  // Merged stops skip hits, but the walk must come back round to the start.
  expect(seen.has(1)).toBe(true)
}

/** Moves the stepper to the stop covering hit `n`. */
async function goToStop(c: Locator, n: number) {
  const next = c.getByRole('button', { name: 'Next hit' })
  await expect(async () => {
    if ((await stopFrom(c)) !== n) await next.click()
    expect(await stopFrom(c)).toBe(n)
  }).toPass({ timeout: 20_000 })
}

test.describe('search permalinks — landing on the hit', () => {
  test.describe.configure({ timeout: 240_000 })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const native = window.setTimeout
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
        native(fn, ms === 2400 ? 600_000 : ms, ...args)) as typeof window.setTimeout
    })
  })

  test('a code file opens in Monaco on the hit line with the hit word selected', async ({ page }) => {
    const name = 'monaco.ts'
    const term = 'flash'
    const content = repoFile('app/.client/monaco.ts')
    const hits = wordStartHits(content, term)
    expect(hits.length).toBeGreaterThan(3)

    const folderId = await uploadAndIndex(page, name, content, 'text/typescript', term)
    await page.goto(
      `/${TEST_USER_ID}/stash/search?query=${term}&in=${encodeURIComponent(`folder:${folderId}`)}`
    )
    const result = card(page, name)
    await expect(result).toBeVisible({ timeout: 30_000 })

    // Before any arrow press the card links to the first hit.
    expect(linkHit((await cardLink(result).getAttribute('href'))!)).toEqual({ ...hits[0], basis: 'index' })
    await expectEveryStopLinksToItsHit(result, hits)

    // Open a deep, indented hit, not the first: the column has to be right.
    const target = hits.length - 2
    await goToStop(result, target + 1)
    await openCard(result)
    await expect(page).toHaveURL(
      new RegExp(`[?&]line=${hits[target].line}&col=${hits[target].column}&lines=index`)
    )

    const editor = page.locator('.monaco-editor').first()
    await expect(editor.locator('.line-numbers.active-line-number')).toHaveText(String(hits[target].line), {
      timeout: 30_000,
    })
    // The tint sits on the hit line (Monaco draws one strip per wrapped row).
    const flash = editor.locator('.animate-stashly-line-flash').first()
    await expect(flash).toBeVisible()
    const activeTop = await editor.locator('.line-numbers.active-line-number').evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs((await flash.evaluate((el) => el.getBoundingClientRect().top)) - activeTop)).toBeLessThan(2)

    // The selection covers exactly the hit word: read the glyphs under it.
    const selected = await editor.evaluate((root) => {
      const sel = root.querySelector('.selected-text')?.getBoundingClientRect()
      if (!sel) return null
      const row = [...root.querySelectorAll('.view-line')].find(
        (l) => Math.abs(l.getBoundingClientRect().top - sel.top) < 3
      )
      if (!row) return null
      let text = ''
      const range = document.createRange()
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const box = range.getBoundingClientRect()
          if (box.left >= sel.left - 1 && box.right <= sel.right + 1) text += node.data[i]
        }
      }
      return text
    })
    expect(selected?.toLowerCase()).toBe(term)
  })

  test('a markdown file scrolls to the hit block, tints it and highlights the word', async ({ page }) => {
    const name = 'semantic-search.md'
    const term = 'vectors'
    const content = repoFile('docs/semantic-search.md')

    const folderId = await uploadAndIndex(page, name, content, 'text/markdown', term)
    await page.goto(
      `/${TEST_USER_ID}/stash/search?query=${term}&in=${encodeURIComponent(`folder:${folderId}`)}`
    )
    const result = card(page, name)
    await expect(result).toBeVisible({ timeout: 30_000 })

    // Markdown lines count the indexed text (syntax stripped, blank runs
    // collapsed), so the link is checked by where it lands, not by number.
    const next = result.getByRole('button', { name: 'Next hit' })
    await expect(async () => {
      await next.click()
      await expect(result.getByText(/\/\d+ hits$/)).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await goToStop(result, 3)
    const href = (await cardLink(result).getAttribute('href'))!
    expect(linkHit(href).basis).toBe('index')
    await openCard(result)
    await expect(page).toHaveURL(/[?&]line=\d+&col=\d+&lines=index/)

    const block = page.locator('[data-line].animate-stashly-line-flash')
    await expect(block).toHaveCount(1, { timeout: 30_000 })
    await expect(block).toBeInViewport()
    await expect(block).toContainText(new RegExp(term, 'i'))

    // The hit word is marked through the CSS Custom Highlight API.
    const marked = await page.evaluate(() => {
      const hl = CSS.highlights.get('stashly-hit')
      return hl ? [...hl].map((r) => r.toString()) : []
    })
    expect(marked.map((t) => t.toLowerCase())).toEqual([term])
  })
})
