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
  /**
   * Plain-text body with markdown syntax stripped — feeds search indexing.
   *
   * Line breaks are preserved. They used to be collapsed along with every
   * other whitespace run, which cost search two locators at once: a hit could
   * report neither a line number (no lines survived to count) nor a section
   * (no heading boundaries survived to find), leaving every markdown result
   * unable to say where its match came from.
   */
  text: string
  /**
   * Heading boundaries as offsets into `text`, so a passage can name the
   * section it was cut from. Ordered by position.
   */
  sections: MarkdownSection[]
  /** ISO-8601 — kept as string so it serializes through FormData/postMessage. */
  docCreatedAt?: string
  docModifiedAt?: string
}

/** A heading and where its section starts in the stripped plain text. */
export interface MarkdownSection {
  title: string
  level: number
  /** Character offset into `MarkdownDocumentMetadata.text`. */
  start: number
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

  const { text, sections } = toPlainText(withoutFences)
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
    sections,
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

/** Strip markdown syntax from a single line, leaving readable prose. */
function stripLineSyntax(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '') // heading marker (the text itself is kept)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // emphasis
    .replace(/^\s{0,3}>\s?/, '') // blockquote marker
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '') // task marker
    .replace(/^\s*[-*+]\s+/, '') // list bullet
    .replace(/^\s*\d+\.\s+/, '') // ordered list
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/, '') // horizontal rule
    .replace(/[ \t]+/g, ' ') // runs of spaces, but never newlines
    .trim()
}

/**
 * Strip markdown to readable plain text, keeping line structure and recording
 * where each heading's section begins.
 *
 * Done line by line rather than with whole-string regexes so the two outputs
 * stay in one coordinate space: `sections[i].start` is an offset into the
 * returned `text`, which is the same string that gets stored as
 * `Search.content` and split by `chunkText`. Computing headings separately
 * against the raw markdown would put them in a different coordinate space —
 * off by every character the stripping removes.
 */
function toPlainText(body: string): { text: string; sections: MarkdownSection[] } {
  const lines = body.split(/\r?\n/)
  const out: string[] = []
  const sections: MarkdownSection[] = []
  let offset = 0

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    const clean = stripLineSyntax(line)
    if (heading) {
      const title = stripLineSyntax(heading[2])
      if (title) {
        sections.push({ title, level: heading[1].length, start: offset })
      }
    }
    out.push(clean)
    offset += clean.length + 1 // +1 for the newline `join` puts back
  }

  // Collapse runs of blank lines so the stored body isn't mostly whitespace,
  // without touching the single breaks that make line numbers meaningful.
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  // The blank-line collapse shifts everything after it, so offsets are remapped
  // by locating each heading in the final text rather than trusting the running
  // count. Searching from the previous match keeps duplicate headings
  // ("## Notes" twice) in document order.
  let cursor = 0
  const remapped: MarkdownSection[] = []
  for (const section of sections) {
    const at = text.indexOf(section.title, cursor)
    if (at === -1) continue
    remapped.push({ ...section, start: at })
    cursor = at + section.title.length
  }

  return { text, sections: remapped }
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

