/**
 * Markdown parsing + metadata extraction.
 *
 * `extractMarkdownMetadata` is worker-compatible (pure string work, no DOM) and
 * mirrors `extractPdfMetadata` in `@/utils/pdf` — it returns a flat object that
 * maps onto the `Markdown` facet model. This metadata path stays dependency-free
 * (just counting/regex) so it runs safely inside the compute worker.
 *
 * Rendering, by contrast, is handled by `react-markdown` (remark-gfm +
 * rehype-sanitize) directly in `MarkdownStage` — a maintained, sanitized
 * pipeline rather than a hand-rolled HTML string. The only render-adjacent
 * helper kept here is `extractMarkdownHeadings`, which feeds the outline rail
 * and shares github-slugger with rehype-slug so the ids line up.
 */
import GithubSlugger from 'github-slugger'

const WORDS_PER_MINUTE = 200

// ---------------------------------------------------------------------------
// File-type detection
// ---------------------------------------------------------------------------

/** True for `.md` / `.markdown` files regardless of how the OS typed them. */
export function isMarkdownFile(file: { name: string; type?: string }): boolean {
  if (file.type === 'text/markdown' || file.type === 'text/x-markdown') return true
  return /\.(md|markdown|mdown|mkd)$/i.test(file.name)
}

export function isMarkdownName(
  name: string | null | undefined,
  mimeType?: string | null,
): boolean {
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return true
  return !!name && /\.(md|markdown|mdown|mkd)$/i.test(name)
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Split a YAML-ish frontmatter block (delimited by leading `---`) from the body.
 * Only the simple `key: value` / `key: [a, b]` / `- item` shapes are parsed —
 * enough to surface title/author/tags/dates without pulling in a YAML lib.
 */
function splitFrontmatter(raw: string): {
  data: Record<string, string | string[]>
  body: string
  hasFrontmatter: boolean
} {
  const match = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: raw.replace(/^﻿/, ''), hasFrontmatter: false }

  const data: Record<string, string | string[]> = {}
  let currentKey: string | null = null
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue
    // `  - item` continuation of a list value
    const listItem = line.match(/^\s*-\s+(.*)$/)
    if (listItem && currentKey) {
      const prev = data[currentKey]
      const value = stripQuotes(listItem[1].trim())
      data[currentKey] = Array.isArray(prev) ? [...prev, value] : [value]
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    currentKey = kv[1].toLowerCase()
    const rawValue = kv[2].trim()
    if (rawValue === '') {
      // value is an indented list on the following lines
      data[currentKey] = []
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      data[currentKey] = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean)
    } else {
      data[currentKey] = stripQuotes(rawValue)
    }
  }

  return { data, body: raw.slice(match[0].length), hasFrontmatter: true }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined
  const v = value?.trim()
  return v || undefined
}

function toIsoDate(value: string | string[] | undefined): string | undefined {
  const v = firstString(value)
  if (!v) return undefined
  const date = new Date(v)
  return isNaN(date.getTime()) ? undefined : date.toISOString()
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

export interface MarkdownDocumentMetadata {
  title?: string
  author?: string
  description?: string
  /** Comma-joined frontmatter tags (mirrors the Pdf facet's `keywords`). */
  tags?: string
  wordCount: number
  /** Estimated reading time in whole minutes (≥1 when there is any text). */
  readingTime: number
  headingCount: number
  linkCount: number
  imageCount: number
  codeBlockCount: number
  /** GitHub task-list items (`- [ ]` / `- [x]`). */
  taskCount: number
  hasFrontmatter: boolean
  /** Plain-text body with markdown syntax stripped — feeds search indexing. */
  text: string
  /** ISO-8601 — kept as string so it serializes through FormData/postMessage. */
  docCreatedAt?: string
  docModifiedAt?: string
}

/**
 * Extract document metadata (title, author, counts, reading time, …) matching
 * the `Markdown` facet model. Worker-compatible — pure string processing.
 */
export async function extractMarkdownMetadata(
  file: File,
): Promise<MarkdownDocumentMetadata | null> {
  try {
    const raw = await file.text()
    return parseMarkdownMetadata(raw)
  } catch (err) {
    console.error('[markdown] extractMarkdownMetadata failed:', err)
    return null
  }
}

/** Pure core — exported for unit tests. */
export function parseMarkdownMetadata(raw: string): MarkdownDocumentMetadata {
  const { data, body, hasFrontmatter } = splitFrontmatter(raw)

  // Strip fenced code so its contents don't pollute word/heading counts.
  const { withoutFences, codeBlockCount } = stripFencedCode(body)

  const headings = collectHeadings(body)
  const linkCount = countMatches(withoutFences, /(^|[^!])\[[^\]]+\]\([^)]+\)/g)
  const imageCount = countMatches(withoutFences, /!\[[^\]]*\]\([^)]+\)/g)
  const taskCount = countMatches(withoutFences, /^\s*[-*+]\s+\[[ xX]\]\s+/gm)

  const text = toPlainText(withoutFences)
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0

  const fmTitle = firstString(data.title)
  const tags = Array.isArray(data.tags)
    ? data.tags.join(', ')
    : firstString(data.tags ?? data.keywords)

  return {
    title: fmTitle ?? headings[0]?.text,
    author: firstString(data.author ?? data.authors),
    description: firstString(data.description ?? data.summary ?? data.excerpt),
    tags: tags || undefined,
    wordCount,
    readingTime: wordCount > 0 ? Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) : 0,
    headingCount: headings.length,
    linkCount,
    imageCount,
    codeBlockCount,
    taskCount,
    hasFrontmatter,
    text,
    docCreatedAt: toIsoDate(data.date ?? data.created ?? data.createdat),
    docModifiedAt: toIsoDate(data.updated ?? data.modified ?? data.lastmod),
  }
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

/** Remove fenced code blocks (``` / ~~~) and report how many there were. */
function stripFencedCode(body: string): {
  withoutFences: string
  codeBlockCount: number
} {
  const lines = body.split(/\r?\n/)
  const out: string[] = []
  let fence: string | null = null
  let codeBlockCount = 0
  for (const line of lines) {
    const open = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      if (open && line.trim().startsWith(fence)) fence = null
      continue
    }
    if (open) {
      fence = open[1].slice(0, 3)
      codeBlockCount++
      continue
    }
    out.push(line)
  }
  return { withoutFences: out.join('\n'), codeBlockCount }
}

/** Strip remaining markdown syntax to readable plain text (for search). */
function toPlainText(body: string): string {
  return body
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // emphasis
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote markers
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '') // task markers
    .replace(/^\s*[-*+]\s+/gm, '') // list bullets
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, '') // hr
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Rendering (for MarkdownStage)
// ---------------------------------------------------------------------------

export interface MarkdownHeading {
  level: number
  text: string
  id: string
}

/**
 * Outline of `#`..`######` headings (frontmatter and code fences ignored).
 * Slugs use github-slugger — the same algorithm `rehype-slug` applies to the
 * rendered HTML — so outline-rail ids match the heading element ids the stage
 * scrolls to.
 */
export function extractMarkdownHeadings(raw: string): MarkdownHeading[] {
  const { body } = splitFrontmatter(raw)
  const slugger = new GithubSlugger()
  return collectHeadings(body).map((h) => ({
    ...h,
    id: slugger.slug(h.text),
  }))
}

function collectHeadings(body: string): { level: number; text: string }[] {
  const lines = body.split(/\r?\n/)
  const headings: { level: number; text: string }[] = []
  let fence: string | null = null
  for (const line of lines) {
    const open = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      if (open && line.trim().startsWith(fence)) fence = null
      continue
    }
    if (open) {
      fence = open[1].slice(0, 3)
      continue
    }
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (m) headings.push({ level: m[1].length, text: m[2].trim() })
  }
  return headings
}

/** Fetch and decode a markdown document from a (presigned) URL. Browser-only. */
export async function loadMarkdownText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load markdown (${res.status})`)
  return res.text()
}

