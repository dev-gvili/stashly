import { useEffect, useMemo, type RefObject } from 'react'
import { useSearchParams } from 'react-router'
import { scrollToLanding } from '@/hooks/useLandingScroll'
import { markdownIndexLines } from '@/utils/markdown'
import {
  COLUMN_PARAM,
  INDEX_LINE_BASIS,
  LINE_BASIS_PARAM,
  LINE_PARAM,
  landingWordEnd,
} from '@/utils/search-evidence'

/** The `::highlight()` name the hit word is painted with (see globals.css). */
const HIT_HIGHLIGHT = 'stashly-hit'
const FLASH_CLASS = 'animate-stashly-line-flash'
const FLASH_MS = 2400

/**
 * Land a search permalink in a rendered markdown document: scroll the block
 * holding the hit's line to the middle, tint it for a moment, and paint the
 * hit word.
 *
 * A search link counts lines in the indexed text (`lines=index`), which drops
 * frontmatter, code fences and blank-line runs; `markdownIndexLines` maps that
 * back to the source line, and to the indexed line's text, which names the
 * word. Blocks carry their source line as `data-line` (`rehypeSourceLines` in
 * the markdown stage); the landing is the last block starting at or before the
 * line. The word is painted with the CSS Custom Highlight API, so React's DOM
 * is never edited.
 *
 * @param root - The element the markdown renders inside.
 * @param text - The raw markdown, as rendered.
 */
export function useMarkdownLanding(root: RefObject<HTMLElement | null>, text: string) {
  const [searchParams] = useSearchParams()
  const target = useMemo(() => markdownLandingTarget(searchParams, text), [searchParams, text])

  useEffect(() => {
    const container = root.current
    if (!container || !target) return
    let block: HTMLElement | null = null
    for (const el of container.querySelectorAll<HTMLElement>('[data-line]')) {
      if (Number(el.dataset.line) <= target.sourceLine) block = el
    }
    if (!block) return

    scrollToLanding(block)
    block.classList.add(FLASH_CLASS)
    const flashed = block
    const timer = window.setTimeout(() => flashed.classList.remove(FLASH_CLASS), FLASH_MS)

    const range = target.word ? findWord(block, target.word) : null
    const highlights = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null
    if (range && highlights) highlights.set(HIT_HIGHLIGHT, new Highlight(range))

    return () => {
      window.clearTimeout(timer)
      flashed.classList.remove(FLASH_CLASS)
      highlights?.delete(HIT_HIGHLIGHT)
    }
  }, [root, target])
}

/** Source line and hit word a markdown permalink points at, or null. */
function markdownLandingTarget(
  params: URLSearchParams,
  text: string
): { sourceLine: number; word?: string } | null {
  const line = Number(params.get(LINE_PARAM))
  if (!Number.isInteger(line) || line < 1) return null
  if (params.get(LINE_BASIS_PARAM) !== INDEX_LINE_BASIS) return { sourceLine: line }

  const indexed = markdownIndexLines(text)[line - 1]
  if (!indexed) return null
  const column = Number(params.get(COLUMN_PARAM))
  const start = column - 1
  const word =
    Number.isInteger(column) && start >= 0 && start < indexed.text.length
      ? indexed.text.slice(start, landingWordEnd(indexed.text, start))
      : undefined
  return { sourceLine: indexed.sourceLine, word }
}

/**
 * The first occurrence of `word` in `el`'s text that starts a word, case
 * folded, as a Range. Text nodes are joined first, so a word split across
 * nodes (`**vec**tors`) is still found.
 */
function findWord(el: HTMLElement, word: string): Range | null {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  const joined = nodes.map((n) => n.data).join('')
  const haystack = joined.toLowerCase()
  const needle = word.toLowerCase()

  let at = haystack.indexOf(needle)
  while (at > 0 && /[\p{L}\p{N}]/u.test(haystack[at - 1])) at = haystack.indexOf(needle, at + 1)
  if (at === -1) return null

  const range = document.createRange()
  let offset = 0
  let started = false
  for (const node of nodes) {
    const end = offset + node.data.length
    if (!started && at < end) {
      range.setStart(node, at - offset)
      started = true
    }
    if (started && at + needle.length <= end) {
      range.setEnd(node, at + needle.length - offset)
      return range
    }
    offset = end
  }
  return null
}
