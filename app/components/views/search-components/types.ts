/**
 * Local types for the search results layout.
 *
 * The result shape itself is not redeclared here — `SearchResult` in
 * `@/types/stash.types` is what `/api/search/:type` actually returns, and a
 * parallel `{ item, score, … }` wrapper would only add a mapping layer between
 * the hook and the card for no gain.
 */
import type { SearchMode } from '@/components/filters/filter.types'

export type { MatchKind, SearchResult } from '@/types/stash.types'

/** The matching text as a card renders it, already windowed for reading. */
export interface EvidenceSnippet {
  /** The excerpt, trimmed to a readable window around the match. */
  text: string
  /** Where it sits in the document — `page 5`. Absent when the source has no pagination. */
  locator?: string
  /** Ellipsis hints for text dropped either side of the window. */
  truncatedStart?: boolean
  truncatedEnd?: boolean
}

/** What the results header needs to describe the search that produced them. */
export interface SearchQueryState {
  query: string
  mode: SearchMode
  /**
   * Terms the vector index added by meaning. No server field feeds this yet —
   * while it is absent the dotted highlight tier and its legend never render,
   * which is the correct degradation rather than a gap.
   */
  expandedTerms?: string[]
}
