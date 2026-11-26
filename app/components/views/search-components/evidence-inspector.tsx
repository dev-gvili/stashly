import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CopyIcon, FolderOpenIcon, OpenWithIcon, RemoveIcon } from '@/components/icons'
import { toFileKind } from '@/components/views/home-components/home-data'
import { KIND_ICON } from '@/components/views/home-components/home-format'
import { useClipboard } from '@/hooks/useClipboard'
import { Button } from '@/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/ui/sheet'
import { toItemUrl } from '@/utils/converters'
import { formatMediaDate, formatSize } from '@/utils/formaters'
import {
  MATCH_KIND_LABEL,
  SCORE_BAND_METER,
  passageLinkSearch,
  scoreBand,
  toEvidenceSnippet,
} from '@/utils/search-evidence'
import { cn, widthForPercent } from '@/utils/styles'
import type { SearchResult } from '@/types/stash.types'
import { ExtensionChip } from './evidence-parts'
import { HighlightedFileName } from './highlighted-text'
import { ScoreBadge } from './score-badge'
import { HitSnippetBlock } from './snippet-block'

/** What the confidence number is, per scale; see `ScoreBadge`. */
function scoreExplanation(kind: SearchResult['matchKind']): string {
  return kind === 'semantic'
    ? 'Cosine similarity between your query and the closest passage. Absolute: a low number is a distant match.'
    : 'Fused keyword and meaning rank, against the best match for this query (which reads 100).'
}

/**
 * A quick look at one result without leaving the page: the cover, why it
 * matched and how strongly, the matching passage in full, and the ways out
 * (open it, copy a citation, show its folder).
 *
 * The server returns one passage per result, so that is all this shows.
 */
export function EvidenceInspector({
  result,
  me,
  query,
  terms,
  expandedTerms,
  onClose,
}: {
  result: SearchResult | null
  me: string
  query: string
  terms: string[]
  expandedTerms?: string[]
  onClose: () => void
}) {
  return (
    <Sheet open={!!result} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="bg-sidebar border-input w-full gap-0 p-0 sm:max-w-md lg:max-w-lg"
      >
        {result && (
          <InspectorBody
            result={result}
            me={me}
            query={query}
            terms={terms}
            expandedTerms={expandedTerms}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function InspectorBody({
  result,
  me,
  query,
  terms,
  expandedTerms,
}: {
  result: SearchResult
  me: string
  query: string
  terms: string[]
  expandedTerms?: string[]
}) {
  const { passage, score, hitCount, matchKind, ...item } = result
  const { copy, copied } = useClipboard()
  // The passage on screen (the stepper moves it); Open lands on its hit.
  const [shown, setShown] = useState(passage)
  useEffect(() => setShown(passage), [passage])
  const snippet = useMemo(
    () =>
      passage && matchKind !== 'name' && matchKind !== 'fuzzy'
        ? toEvidenceSnippet(passage, query)
        : null,
    [passage, query, matchKind]
  )
  const scored = matchKind !== 'name' && matchKind !== 'fuzzy'
  const KindIcon = KIND_ICON[toFileKind(item.category)]
  const cover = item.thumbnails.find((t) => t.url && !t.url.startsWith('#'))?.url ?? null
  const openUrl = toItemUrl({
    type: item.type,
    id: item.id,
    parentId: item.parentId ?? '',
    me,
    workspaceId: item.workspaceId ?? undefined,
  })
  const at = snippet && item.type !== 'folder' ? passageLinkSearch(shown) : ''
  const openTo = at ? `${openUrl}?${at}` : openUrl
  const folderUrl = item.parentId
    ? toItemUrl({ type: 'folder', id: item.parentId, parentId: '', me, workspaceId: item.workspaceId ?? undefined })
    : null
  const modified = item.updatedAt ?? item.createdAt
  const citation = snippet?.locator ? `${item.name}, ${snippet.locator}` : item.name

  return (
    <>
      <div className="border-input flex items-center justify-between gap-2 border-b p-4">
        <div className="flex min-w-0 items-center gap-2">
          {scored && <ScoreBadge score={score} kind={matchKind} />}
          <span className="text-muted-foreground font-stashly truncate text-xs uppercase">
            {MATCH_KIND_LABEL[matchKind]}
          </span>
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label="Close" className="size-7 shrink-0">
            <RemoveIcon className="size-4" />
          </Button>
        </SheetClose>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-col gap-2">
          <SheetTitle asChild>
            <h2 className="break-words">
              <HighlightedFileName
                name={item.name}
                terms={terms}
                expandedTerms={expandedTerms}
                className="text-foreground font-stashly text-base font-semibold"
              />
            </h2>
          </SheetTitle>
          <SheetDescription asChild>
            <div className="text-muted-foreground font-stashly flex flex-wrap items-center gap-2 text-xs">
              <ExtensionChip extension={item.file?.extension} />
              <span>{formatSize('byte', 'unit', item.size)}</span>
              {modified && (
                <>
                  <span>·</span>
                  <span>
                    {item.updatedAt ? 'Modified' : 'Added'} {formatMediaDate(modified)}
                  </span>
                </>
              )}
              {hitCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-foreground">
                    {hitCount} {hitCount === 1 ? 'hit' : 'hits'}
                  </span>
                </>
              )}
            </div>
          </SheetDescription>
        </div>

        <div className="border-border/50 bg-muted relative flex h-44 items-center justify-center overflow-hidden rounded-xl border">
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <KindIcon className="text-muted-foreground size-10" />
          )}
          <Button asChild size="sm" className="absolute right-3 bottom-3 font-stashly">
            <Link to={openTo} state={{ name: item.name }}>
              Open
              <OpenWithIcon className="size-4" />
            </Link>
          </Button>
        </div>

        {scored && (
          <div className="border-input bg-card flex flex-col gap-2 rounded-xl border p-3.5">
            <div className="font-stashly flex items-center justify-between text-xs">
              <span className="text-foreground uppercase">Retrieval confidence</span>
              <span className="text-foreground tabular-nums">{Math.round(score)} / 100</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-[2px]">
              <div
                className={cn(
                  'h-full rounded-[2px] transition-all duration-300',
                  widthForPercent(score),
                  SCORE_BAND_METER[scoreBand(score)]
                )}
              />
            </div>
            <p className="text-muted-foreground font-stashly text-xs leading-relaxed">
              {scoreExplanation(matchKind)}
            </p>
          </div>
        )}

        {snippet && (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-muted-foreground font-stashly text-xs tracking-wider uppercase">
              Matched passage
            </h3>
            <HitSnippetBlock
              itemId={item.id}
              // Non-null wherever `snippet` is: it is built from this passage.
              passage={passage!}
              query={query}
              terms={terms}
              expandedTerms={expandedTerms}
              hitCount={hitCount}
              onPassage={setShown}
              lines="all"
              className="bg-card"
            />
          </div>
        )}
      </div>

      <div className="border-input flex items-center gap-2 border-t p-3.5">
        <Button
          variant="outline"
          className="font-stashly flex-1 bg-card!"
          onClick={() => copy(citation)}
        >
          <CopyIcon className="size-4" />
          {copied ? 'Copied' : 'Copy citation'}
        </Button>
        {folderUrl && (
          <Button asChild variant="outline" className="font-stashly flex-1 bg-card!">
            <Link to={folderUrl}>
              <FolderOpenIcon className="size-4" />
              Show in folder
            </Link>
          </Button>
        )}
      </div>
    </>
  )
}
