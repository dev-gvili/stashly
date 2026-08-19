export { EvidenceCard, EvidenceCardSkeleton } from './evidence-card'
export { MatchGroup } from './match-group'
export { ResultsSummary } from './results-summary'
export { SnippetBlock } from './snippet-block'
export { MatchBadge } from './match-badge'
export { ScoreBadge } from './score-badge'
export { HighlightedText, HighlightedFileName } from './highlighted-text'
export {
  tokenizeQuery,
  highlightSegments,
  toEvidenceSnippet,
  scoreBand,
  MATCH_KIND_LABEL,
  MATCH_KIND_NOTE,
  MATCH_KIND_ORDER,
  SEARCH_MODE_META,
} from '@/utils/search-evidence'
export type {
  HighlightKind,
  HighlightSegment,
  ScoreBand,
} from '@/utils/search-evidence'
export { widthForPercent } from '@/utils/styles'
export type {
  MatchKind,
  SearchResult,
  EvidenceSnippet,
  SearchQueryState,
} from '@/types/stash.types'
