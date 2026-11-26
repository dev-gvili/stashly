/**
 * Pure helpers behind the search results layout: what to highlight, how to
 * group, and the literal class maps Tailwind needs to see.
 */
import { buildSentenceSnippet } from '@/utils/search-query'
import type { SearchMode } from '@/types/filter.types'
import type {
  EvidenceSnippet,
  MatchKind,
  SearchPassage,
} from '@/types/stash.types'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with',
])

/** Query string → the literal terms worth marking in a snippet. */
export function tokenizeQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[\s,]+/)
        .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
        .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    )
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type HighlightKind = 'plain' | 'literal' | 'expanded'

export interface HighlightSegment {
  text: string
  kind: HighlightKind
}

/**
 * Split text into plain / literal-term / semantically-expanded segments.
 *
 * Two tiers matter: a word the user typed is evidence, a word the vector index
 * added is a hint. Marking them identically makes expansions read as false
 * positives, so they get separate treatment in `HighlightedText`.
 */
export function highlightSegments(
  text: string,
  literalTerms: string[],
  expandedTerms: string[] = []
): HighlightSegment[] {
  const all = [...literalTerms, ...expandedTerms].filter(Boolean)
  if (!all.length || !text) return [{ text, kind: 'plain' }]

  const literal = new Set(literalTerms.map((t) => t.toLowerCase()))
  const expanded = new Set(expandedTerms.map((t) => t.toLowerCase()))
  // Longest first, so "report" can't consume the front of "reporting" and
  // leave an unmarked tail behind it.
  const pattern = new RegExp(
    '(' +
      [...all].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|') +
      ')',
    'gi'
  )

  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => {
      const lower = part.toLowerCase()
      if (literal.has(lower)) return { text: part, kind: 'literal' as const }
      if (expanded.has(lower)) return { text: part, kind: 'expanded' as const }
      return { text: part, kind: 'plain' as const }
    })
}

/**
 * Where a passage lives, in the most specific terms the format allows.
 *
 * Ordered by what a reader would actually navigate with. A section beats a page
 * because "§ Why chunk?" tells you what you are looking at as well as where it
 * is; a page beats a line because that is how a PDF reader is addressed; a line
 * is the universal fallback, meaningful for any text document.
 */
function passageLocator(passage: SearchPassage): string | undefined {
  if (passage.section) return `§ ${passage.section}`
  if (passage.pageNum != null) return `page ${passage.pageNum}`
  if (passage.lineNum != null) return `line ${passage.lineNum}`
  return undefined
}

/**
 * A passage → the excerpt a card shows.
 *
 * `buildSentenceSnippet` does the windowing (whole sentences, at most two,
 * at most 128 characters, opening on the sentence that matched); this only
 * adds the human-readable locator, so the two never disagree about what the
 * user is looking at.
 */
export function toEvidenceSnippet(
  passage: SearchPassage,
  query: string
): EvidenceSnippet {
  const snippet = buildSentenceSnippet(passage.content, query)
  return {
    text: snippet.text,
    locator: passageLocator(passage),
    truncatedStart: snippet.truncatedStart,
    truncatedEnd: snippet.truncatedEnd,
  }
}

/**
 * The stops of the hit stepper: one per distinct excerpt. Hits close enough to
 * cut the same excerpt merge into one stop that records which hits (1-based)
 * it covers, so stepping never shows the same text twice.
 *
 * @example
 * toHitStops([p1, p2, p3], 'vectors') // p2 and p3 in one sentence
 * // → [{ from: 1, to: 1, … }, { from: 2, to: 3, … }]
 */
export function toHitStops(
  passages: SearchPassage[],
  query: string
): HitStop[] {
  const stops: HitStop[] = []
  passages.forEach((passage, i) => {
    const snippet = toEvidenceSnippet(passage, query)
    const last = stops.at(-1)
    if (last && last.snippet.text === snippet.text) last.to = i + 1
    else stops.push({ snippet, passage, from: i + 1, to: i + 1 })
  })
  return stops
}

/** One stop of the hit stepper; `passage` is its first hit, where its link points. */
export type HitStop = { snippet: EvidenceSnippet; passage: SearchPassage; from: number; to: number }

/**
 * Where the hit word that starts at `start` ends: the run of letters and
 * digits from there. A link carries only the hit's start, and hits always
 * start a word, so the word is what the search card highlighted. At least one
 * character, so a hit on punctuation still marks something.
 *
 * @example
 * landingWordEnd('calls vectors(x)', 6) // → 13
 */
export function landingWordEnd(text: string, start: number): number {
  let end = start
  while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++
  return Math.max(end, Math.min(start + 1, text.length))
}

/**
 * Turn a line and column counted in the indexed text into the file's own.
 *
 * The index stores a text file's body trimmed (`upsertSearchContent`,
 * `chunkText`), so blank lines at the top of the file are missing from it and
 * every line number after them is short by that many; on the first kept line
 * the column is short by its leading spaces too. Re-adding what the trim took
 * is exact, since that is the only difference between the two.
 *
 * @example
 * fileLineOf('\n\n  export x', 1, 1) // → { line: 3, column: 3 }
 */
export function fileLineOf(
  text: string,
  line: number,
  column?: number
): { line: number; column?: number } {
  const lead = /^\s*/.exec(text.replace(/^﻿/, ''))?.[0] ?? ''
  const breaks = lead.replace(/\r\n?/g, '\n').split('\n')
  const skipped = breaks.length - 1
  const indent = breaks.at(-1)?.length ?? 0
  return {
    line: line + skipped,
    column: column != null && line === 1 ? column + indent : column,
  }
}

/**
 * The file line and column a viewer should land on, from its query string and
 * the file's text: `?line=&col=` as given, or mapped from the index's counting
 * when the link says `lines=index`. Undefined line when there is none.
 *
 * @example
 * landingFromParams(new URLSearchParams('line=1&col=1&lines=index'), '\n\nx') // → { line: 3, column: 1 }
 */
export function landingFromParams(
  params: URLSearchParams,
  text: string
): { line?: number; column?: number } {
  const line = positiveInt(params.get(LINE_PARAM))
  const column = positiveInt(params.get(COLUMN_PARAM))
  if (line == null) return {}
  return params.get(LINE_BASIS_PARAM) === INDEX_LINE_BASIS ? fileLineOf(text, line, column) : { line, column }
}

function positiveInt(raw: string | null): number | undefined {
  const n = raw == null ? NaN : Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : undefined
}

/** Query parameters a file viewer reads to open at a spot (`?line=&col=`, `?page=`). */
export const LINE_PARAM = 'line'
export const COLUMN_PARAM = 'col'
export const PAGE_PARAM = 'page'
/**
 * `lines=index`: the line and column count the indexed text, not the file (a
 * search link). The viewer maps them with `fileLineOf`. A definition jump's
 * `?line=` comes from the editor and counts the file, so it carries none.
 */
export const LINE_BASIS_PARAM = 'lines'
export const INDEX_LINE_BASIS = 'index'

/**
 * The permalink query for a passage: the line and column of its hit, and its
 * page when the document has pages. Each viewer reads the part it can place:
 * the code and text viewers the line, the PDF viewer the page. Empty when the
 * passage has no locator, so the link opens the file as before.
 *
 * @example
 * passageLinkSearch({ lineNum: 866, column: 12, pageNum: null, … }) // → 'line=866&col=12&lines=index'
 */
export function passageLinkSearch(passage: SearchPassage | null | undefined): string {
  if (!passage) return ''
  const params = new URLSearchParams()
  if (passage.lineNum != null) {
    params.set(LINE_PARAM, String(passage.lineNum))
    if (passage.column != null) params.set(COLUMN_PARAM, String(passage.column))
    params.set(LINE_BASIS_PARAM, INDEX_LINE_BASIS)
  }
  if (passage.pageNum != null) params.set(PAGE_PARAM, String(passage.pageNum))
  return params.toString()
}

export const MATCH_KIND_LABEL: Record<MatchKind, string> = {
  name: 'Filename',
  content: 'In content',
  fuzzy: 'Similar name',
  semantic: 'Semantic',
}

export const MATCH_KIND_NOTE: Record<MatchKind, string> = {
  name: 'The query is in the filename.',
  content: 'Literal term hits inside the document.',
  fuzzy: 'Approximate name — no exact occurrence.',
  semantic: 'No literal hit — closest by meaning.',
}

/**
 * Groups render in this order: strongest evidence first.
 *
 * `fuzzy` sits above `semantic` because an approximate filename is still an
 * answer about the name the user typed, where a vector neighbour is a
 * suggestion about something they didn't.
 */
export const MATCH_KIND_ORDER: MatchKind[] = [
  'name',
  'content',
  'fuzzy',
  'semantic',
]

export type ScoreBand = 'strong' | 'related' | 'distant'

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return 'strong'
  if (score >= 40) return 'related'
  return 'distant'
}

/** Literal tint classes — Tailwind only compiles class names it can see. */
export const SCORE_BAND_METER: Record<ScoreBand, string> = {
  strong: 'bg-emerald-600',
  related: 'bg-amber-600',
  distant: 'bg-muted-foreground',
}

/**
 * Copy for the mode badge in `ResultsSummary`.
 *
 * Two modes, not three — `SearchMode` in `@/types/filter.types` is
 * `fuzzy | semantic`, and the header's own toggle is the only thing that
 * writes it.
 */
export const SEARCH_MODE_META: Record<
  SearchMode,
  { label: string; hint: string }
> = {
  fuzzy: {
    label: 'Fuzzy',
    hint: 'Tolerates typos · trigram · ranked',
  },
  semantic: {
    label: 'Semantic',
    hint: 'Meaning · vector embeddings · multilingual',
  },
}
