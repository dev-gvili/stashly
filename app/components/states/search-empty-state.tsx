import { href, Link } from 'react-router'
import { InfoIcon, SearchFillIcon } from '@/components/icons'
import { GenericEmptyState } from './generic-empty-state'
import { Button } from '@/ui/button'
import { MIN_QUERY_LENGTH } from '@/utils/search-query'

/** Nothing typed yet — the resting state of the search page. */
export const SearchIdleState = ({ me }: { me: string }) => (
  <GenericEmptyState
    icon={<SearchFillIcon className="size-16 text-muted-foreground" />}
    title="Search your stash"
    description={`Type at least ${MIN_QUERY_LENGTH} characters to search by name, tag or file contents. Switch to semantic mode to search by meaning instead of wording.`}
  >
    <Button variant="outline" asChild>
      <Link to={href('/:me/stash/all', { me })} className="font-stashly">
        Browse all files
      </Link>
    </Button>
  </GenericEmptyState>
)

/** A query ran and matched nothing. */
export const SearchNoResultsState = ({ query }: { query: string }) => (
  <GenericEmptyState
    icon={<SearchFillIcon className="size-16 text-muted-foreground" />}
    title="No matches"
    description={`Nothing in your stash matches “${query}”. Try fewer words, check the spelling, or clear your filters.`}
  />
)

/**
 * Semantic mode is on but the drive has no embedded passages to match
 * against — an empty dense half here means "not indexed", not "no matches",
 * and saying so is the difference between a bug report and a shrug.
 *
 * Documents index on upload; older items and any upload whose tab closed
 * mid-run are healed by `useEmbeddingBackfill` on a later visit. The count is
 * live (`getSearchIndexStats`), and the caller re-reads it while this notice
 * is on screen, so it disappears on its own once the backlog drains.
 */
export const SearchNotIndexedNotice = ({
  pendingChunks,
}: {
  pendingChunks: number
}) => (
  <div className="flex items-start gap-2 rounded-md border border-input bg-card p-3 font-stashly text-sm">
    <InfoIcon className="size-5 shrink-0 text-muted-foreground" />
    <p className="text-muted-foreground text-pretty">
      {pendingChunks > 0 ? (
        <>
          Showing keyword matches only — none of the{' '}
          <span className="tabular-nums">
            {pendingChunks.toLocaleString()}
          </span>{' '}
          extracted passages have been embedded yet. Embedding runs in this
          browser when it is idle and needs WebGPU.
        </>
      ) : (
        'No document contents are indexed yet. Upload a PDF or Markdown file to make its text searchable by meaning; names and tags are always searchable.'
      )}
    </p>
  </div>
)
