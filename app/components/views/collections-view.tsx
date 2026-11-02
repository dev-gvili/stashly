import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CollectionCard,
  CollectionListHeader,
  type CollectionCardItem,
} from '@/components/core-components/collection-card'
import { NewCollectionDialog } from '@/components/core-components/collection-dialogs'
import { LayoutSegments, type CollectionLayout } from '@/components/collections'
import { AddIcon, SearchFillIcon, SortListIcon } from '@/components/icons'
import { CollectionEmptyState } from '@/components/states/collection-empty-state'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group'
import { cn } from '@/utils/styles'

interface CollectionsViewProps {
  collections: CollectionCardItem[]
}

/**
 * Sort options map to the loader's `?orderBy[...]` (server-side, so it holds
 * across reloads). "Newest" is the loader's default, creation date; there is no
 * `updatedAt` on a collection card yet, so "Recently updated" isn't offered.
 */
const SORTS = [
  { label: 'Newest', param: null },
  { label: 'Name', param: ['name', 'asc'] },
  { label: 'Size', param: ['size', 'desc'] },
] as const

function currentSortIndex(searchParams: URLSearchParams) {
  const idx = SORTS.findIndex((s) => s.param && searchParams.has(`orderBy[${s.param[0]}]`))
  return idx === -1 ? 0 : idx
}

/**
 * Collections index: header with the one "New collection" CTA, a filter /
 * sort / view toolbar, and the collections as cards or rows. With no
 * collections the empty state owns the CTA.
 *
 * @example
 * <CollectionsView collections={loaderData.collections} />
 */
export function CollectionsView({ collections }: CollectionsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const [query, setQuery] = useState('')

  const view: CollectionLayout = searchParams.get('layout') === 'list' ? 'list' : 'grid'
  const sortIdx = currentSortIndex(searchParams)
  const hasCollections = collections.length > 0

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? collections.filter((c) => c.name.toLowerCase().includes(q))
      : collections
  }, [collections, query])

  function cycleSort() {
    const next = SORTS[(sortIdx + 1) % SORTS.length]
    setSearchParams(
      (prev) => {
        for (const key of [...prev.keys()]) {
          if (key.startsWith('orderBy')) prev.delete(key)
        }
        if (next.param) prev.set(`orderBy[${next.param[0]}]`, next.param[1])
        return prev
      },
      { preventScrollReset: true }
    )
  }

  function setLayout(next: CollectionLayout) {
    setSearchParams(
      (prev) => {
        prev.set('layout', next)
        return prev
      },
      { preventScrollReset: true }
    )
  }

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-10 pt-9 pb-30 max-sm:px-4">
      <div className="bg-dots mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-72" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="font-stashly text-3xl font-semibold tracking-tighter">
              Collections
            </h1>
            <Badge variant="secondary" className="font-stashly text-xs">
              {collections.length}
            </Badge>
          </div>
          <p className="font-stashly max-w-lg text-sm text-pretty text-muted-foreground">
            Group files without moving them. One file can sit in several
            collections.
          </p>
        </div>
        {hasCollections && (
          <Button className="font-stashly" onClick={() => setNewOpen(true)}>
            <AddIcon className="size-5" />
            New collection
          </Button>
        )}
      </div>

      {hasCollections ? (
        <>
          <div className="relative flex flex-wrap items-center justify-between gap-2.5">
            <InputGroup className="h-8.5 w-75 max-w-full">
              <InputGroupAddon>
                <SearchFillIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                className="font-stashly"
                placeholder="Filter collections"
                aria-label="Filter collections"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-stashly bg-card"
                onClick={cycleSort}
              >
                <SortListIcon className="size-4" />
                {SORTS[sortIdx].label}
              </Button>
              <LayoutSegments value={view} onValueChange={setLayout} className="shrink-0" />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="font-stashly py-12 text-center text-sm text-muted-foreground">
              No collections match “{query}”.
            </p>
          ) : view === 'list' ? (
            <div className="flex flex-col">
              <CollectionListHeader />
              {visible.map((c) => (
                <CollectionCard key={c.id} collection={c} view="list" />
              ))}
            </div>
          ) : (
            <div className={cn('grid-cards-lg grid gap-4')}>
              {visible.map((c) => (
                <CollectionCard key={c.id} collection={c} view="grid" />
              ))}
            </div>
          )}
        </>
      ) : (
        <CollectionEmptyState variant="index">
          <Button className="font-stashly" onClick={() => setNewOpen(true)}>
            <AddIcon className="size-5" />
            New collection
          </Button>
        </CollectionEmptyState>
      )}

      <NewCollectionDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
