/**
 * Pure helpers behind the search results layout: what to highlight, how to
 * group, and the literal class maps Tailwind needs to see.
 */
import { buildSnippet } from '@/utils/search-query'
import type { SearchMode } from '@/components/filters/filter.types'
import type { MatchKind, SearchPassage } from '@/types/stash.types'
import type { EvidenceSnippet } from './types'

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
export function passageLocator(passage: SearchPassage): string | undefined {
  if (passage.section) return `§ ${passage.section}`
  if (passage.pageNum != null) return `page ${passage.pageNum}`
  if (passage.lineNum != null) return `line ${passage.lineNum}`
  return undefined
}

/**
 * A passage → the excerpt a card shows.
 *
 * `buildSnippet` does the windowing (it already knows how to centre on the
 * densest run of matches); this only adds the human-readable locator, so the
 * two never disagree about what the user is looking at.
 */
export function toEvidenceSnippet(
  passage: SearchPassage,
  query: string
): EvidenceSnippet {
  const snippet = buildSnippet(passage.content, query)
  return {
    text: snippet.text,
    locator: passageLocator(passage),
    truncatedStart: snippet.truncatedStart,
    truncatedEnd: snippet.truncatedEnd,
  }
}

export const MATCH_KIND_LABEL: Record<MatchKind, string> = {
  name: 'Filename',
  content: 'In content',
  semantic: 'Semantic',
}

export const MATCH_KIND_NOTE: Record<MatchKind, string> = {
  name: 'The query is in the filename.',
  content: 'Literal term hits inside the document.',
  semantic: 'No literal hit — closest by meaning.',
}

/** Groups render in this order: strongest evidence first. */
export const MATCH_KIND_ORDER: MatchKind[] = ['name', 'content', 'semantic']

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

const WIDTH_STEPS = [
  'w-[0%]', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]', 'w-[25%]', 'w-[30%]',
  'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-[50%]', 'w-[55%]', 'w-[60%]', 'w-[65%]',
  'w-[70%]', 'w-[75%]', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-[100%]',
] as const

/** Same technique as `overview-helpers.widthForPercent`: pick, never interpolate. */
export function widthForPercent(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent))
  return WIDTH_STEPS[Math.round(clamped / 5)]
}

/**
 * Copy for the mode badge in `ResultsSummary`.
 *
 * Two modes, not three — `SearchMode` in `filter.types` is `fuzzy | semantic`,
 * and the header's own toggle is the only thing that writes it.
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
