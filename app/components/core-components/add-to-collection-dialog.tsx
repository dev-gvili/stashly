import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher, useLocation, useRouteLoaderData, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog, DialogClose, DialogPortal, DialogTrigger } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { ScrollArea } from '@/ui/scroll-area'
import { Checkbox } from '@/ui/checkbox'
import {
  CollectionIcon,
  RemoveIcon,
  RemoveSquareIcon,
  SearchIcon,
} from '@/components/icons'
import { cn } from '@/utils/styles'
import { formatSize } from '@/utils/formaters'
import type { StashItem, StashPickerItem } from '@/types/stash.types'
import { CATEGORIES } from '@/components/filters/filter.data'
import { ItemCard } from '@/components/stash/item-card'
import { ItemCardContext } from '@/hooks/useItemCard'
import type { Route } from '../../routes/+types/layout'
import { SearchInput } from '@/components/core-components/search-input'
import { Filters } from '../filters/filters'
import { useFilters } from '@/hooks/useFilters'
import { GridLayout } from '../views/grid-view'
import { LoadMoreItems } from './buttons'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AddToCollectionItem = StashPickerItem

interface AddToCollectionDialogProps {
  collectionId: string
  collectionName: string
  items: AddToCollectionItem[]
  existingItemIds?: string[]
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

/** Bucket items by precomputed `_dateLabel`. O(n), no Date allocation. */
function groupByDate(
  items: Array<AddToCollectionItem & { _dateLabel: string }>
): [string, AddToCollectionItem[]][] {
  const map = new Map<string, AddToCollectionItem[]>()
  for (const item of items) {
    const arr = map.get(item._dateLabel)
    if (arr) arr.push(item)
    else map.set(item._dateLabel, [item])
  }
  return Array.from(map.entries())
}

function getYearsFromGroups(
  groups: [string, AddToCollectionItem[]][]
): string[] {
  const years = new Set<string>()
  for (const [label] of groups) {
    const match = label.match(/\d{4}/)
    if (match) years.add(match[0])
  }
  return Array.from(years).sort((a, b) => Number(b) - Number(a))
}

// ---------------------------------------------------------------------------
// Item thumbnail grid cell
// ---------------------------------------------------------------------------

type GridItemUser = NonNullable<Route.ComponentProps['loaderData']>['user']

const GridItem = React.memo(function GridItem({
  item,
  selected,
  existing,
  onToggle,
  user,
  searchParams,
  setSearchParams,
}: {
  item: AddToCollectionItem
  selected: boolean
  existing: boolean
  onToggle: (id: string) => void
  user: GridItemUser
  searchParams: URLSearchParams
  setSearchParams: ReturnType<typeof useSearchParams>[1]
}) {
  if (item.type === 'folder' || item.type === 'collection') return null

  const contextValue = useMemo(
    () => ({
      ...item,
      status: 'normal' as const,
      inclusiveSize: item.size,
      updatedAt: null,
      parentId: null,
      ownerId: '',
      workspaceId: null,
      driveId: '',
      tags: [],
      thumbnails: item.thumbnailUrl
        ? [
            {
              id: item.id,
              url: item.thumbnailUrl,
              width: null,
              height: null,
              size: 'medium' as const,
              view: 'grid' as const,
            },
          ]
        : [],
      favorites: [],
      file: null,
      folder: null,
      user,
      searchParams,
      setSearchParams,
    }),
    [item, user, searchParams, setSearchParams]
  )

  return (
    <ItemCardContext.Provider value={contextValue}>
      <button
        type="button"
        onClick={() => !existing && onToggle(item.id)}
        className={cn(
          'relative group surface-glass aspect-square rounded-md overflow-hidden border border-input transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          existing && 'cursor-default'
        )}
        aria-pressed={selected || existing}
        aria-label={`${selected ? 'Deselect' : 'Select'} ${item.name}`}
      >
        <ItemCard.Thumbnail className="rounded-none aspect-square">
          <ItemCard.ThumbnailImage />
          <ItemCard.ThumbnailFallback className="p-0 bg-sidebar" />
        </ItemCard.Thumbnail>

        {/* dark overlay on hover when not selected */}
        {!selected && !existing && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
        )}

        {/* selection checkbox */}
        <Checkbox
          className="absolute top-2 left-2 size-6 rounded flex items-center justify-center transition-all"
          checked={selected || existing}
          hidden={existing}
        />

        {/* item name tooltip on hover */}
        <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4 translate-y-full group-hover:translate-y-0 transition-transform duration-150 pointer-events-none">
          <p className="text-white text-sm truncate font-medium">{item.name}</p>
          <p className="text-white/80 text-xs">
            {formatSize('byte', 'unit', Number(item.size))}
          </p>
        </div>

        {/* "already added" badge */}
        {existing && (
          <div className="absolute top-2 right-2">
            <Badge className="rounded bg-background text-foreground">
              Added
            </Badge>
          </div>
        )}
      </button>
    </ItemCardContext.Provider>
  )
})

// ---------------------------------------------------------------------------
// Year scrubber (right rail)
// ---------------------------------------------------------------------------

function YearScrubber({
  years,
  onJump,
}: {
  years: string[]
  onJump: (year: string) => void
}) {
  return (
    <div className="absolute right-0 top-0 h-full flex flex-col items-center justify-center gap-1 pr-2 z-10 select-none">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => onJump(y)}
          className="text-xs text-muted-foreground hover:text-foreground font-stashly leading-none py-0.5 transition-colors"
        >
          {y}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddToCollectionDialog({
  collectionId,
  collectionName,
  items: initialItems,
  existingItemIds = [],
  children,
}: AddToCollectionDialogProps) {
  const pickerFetcher = useFetcher<{
    items: StashPickerItem[]
    nextCursor: string | null
    hasMore: boolean
  }>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Map<string, HTMLElement>>(new Map())
  const existingSet = useMemo(() => new Set(existingItemIds), [existingItemIds])
  const filters = useFilters()
  // Hoisted hooks — avoid each GridItem subscribing to router context (was causing 20–30s lag on URL change)
  const user =
    useRouteLoaderData<Route.ComponentProps['loaderData']>('layout')!.user
  const [searchParams, setSearchParams] = useSearchParams()

  // Picker items are driven by the `initialItems` prop (the parent's loaderData.availableItems).
  // Do NOT use usePagination here — it reads useLoaderData() from the host route, which inside
  // a collection route returns the in-collection items (not the picker source) and clobbers
  // local state after every action redirect.
  const [items, setItems] = useState<StashPickerItem[]>(() => {
    // Seed the picker with the initial items from the parent route's loaderData.
    // This ensures the picker is populated immediately on open, without waiting for an API call.
    // Subsequent pages are fetched via the "Load more" button, which appends to this state.
    return initialItems
  })
  const [nextCursor, setNextCursor] = useState<string | null>(
    pickerFetcher.data?.nextCursor ?? null
  )
  const [hasMore, setHasMore] = useState(
    pickerFetcher.data?.hasMore ?? initialItems.length >= 50
  )

  // Re-sync when the parent reloads availableItems (after add/remove triggers a revalidation).
  useEffect(() => {
    setItems(initialItems)
    setNextCursor('')
    setHasMore(initialItems.length >= 50)
  }, [initialItems])

  // Append fetched pages.
  useEffect(() => {
    if (pickerFetcher.state !== 'idle' || !pickerFetcher.data) return
    setItems((prev) => {
      const existing = new Set(prev.map((i) => i.id))
      return [
        ...prev,
        ...pickerFetcher.data!.items.filter((i) => !existing.has(i.id)),
      ]
    })
    setNextCursor(pickerFetcher.data.nextCursor)
    setHasMore(pickerFetcher.data.hasMore)
  }, [pickerFetcher.state, pickerFetcher.data])

  const isLoading = pickerFetcher.state !== 'idle'

  const loadMore = useCallback(() => {
    if (!hasMore) return
    const params = new URLSearchParams()
    params.set('cursor', pickerFetcher.data?.nextCursor ?? '')
    params.set('take', '60')
    pickerFetcher.load(`/api/collections/${collectionId}?${params.toString()}`)
  }, [isLoading, hasMore, nextCursor, pickerFetcher, collectionId])

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Pre-compute the formatted date label + lowercase name ONCE per items array.
  // Without this, every keystroke re-runs `new Date(...).toLocaleDateString()` for every item.
  const indexedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        _dateLabel: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString(undefined, DATE_FMT)
          : 'Unknown date',
        _nameLower: item.name.toLowerCase(),
      })),
    [items]
  )

  const filteredItems = useMemo(() => {
    let result = indexedItems
    if (query) {
      const q = query.toLowerCase()
      result = result.filter((i) => i._nameLower.includes(q))
    }
    if (filters.state.category.length > 0) {
      result = result.filter((i) => filters.state.category.includes(i.category))
    }
    return result
  }, [indexedItems, query, filters.state.category])

  const groups = useMemo(() => groupByDate(filteredItems), [filteredItems])
  const years = useMemo(() => getYearsFromGroups(groups), [groups])

  function jumpToYear(year: string) {
    for (const [label, el] of groupRefs.current.entries()) {
      if (label.includes(year)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }

  function handleAdd() {
    pickerFetcher.submit(
      {
        intent: 'add_items_to_collection',
        collectionId,
        itemIds: Array.from(selected).join(','),
      },
      { method: 'post', action: '/api/collections' }
    )
    setSelected(new Set())
  }

  const selectedCount = selected.size
  const isSubmitting = pickerFetcher.state !== 'idle'

  return (
    <Dialog
      onOpenChange={(open) => {
        filters.clearAll()
        if (open) {
          setSelected(new Set())
          setQuery('')
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogPortal>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />

        {/* Full-screen panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal
          aria-label={`Add items to ${collectionName}`}
        >
          {/* ── Header (close + title + filters + search + counts) ── */}
          <header className="z-40 flex items-center h-14 bg-background backdrop-blur-xl px-4 py-2 shrink-0 gap-2 overflow-x-auto scrollbar-none justify-between">
            <section className="flex items-center gap-2 flex-1">
              {/* Title */}
              <span className="font-stashly  text-lg truncate shrink-0 hidden sm:block">
                Add to collection
              </span>

              {/* Selected count */}
              <AnimatePresence>
                {selectedCount > 0 && (
                  <Badge variant="default" className="rounded" asChild>
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="font-stashly  tabular-nums shrink-0"
                    >
                      {selectedCount} selected
                    </motion.span>
                  </Badge>
                )}
              </AnimatePresence>
            </section>
            <section className="flex items-center gap-2 flex-2">
              {/* Filters */}

              <Filters filters={filters}>
                <Filters.Popover>
                  <Filters.Trigger />
                  <Filters.Panel>
                    <Filters.Tabs defaultTab="category">
                      <Filters.Tab
                        id="category"
                        label="Categories"
                        items={CATEGORIES}
                      />
                    </Filters.Tabs>
                    <Filters.Actions />
                  </Filters.Panel>
                </Filters.Popover>
                <Filters.Sort />
              </Filters>
              {/* Search */}
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search"
                hideModeToggle
                className="flex-1 max-w-max"
              />

              {/* Result count (when searching) */}
              {query && (
                <span className="font-stashly text-xs text-muted-foreground tabular-nums shrink-0">
                  {filteredItems.length} result
                  {filteredItems.length !== 1 ? 's' : ''}
                </span>
              )}
            </section>
            {/* Close */}
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Close"
                className="font-stashly bg-card! border-input rounded-md!"
              >
                <RemoveIcon className="size-5" />
              </Button>
            </DialogClose>
          </header>

          {/* ── Content ── */}
          <div className="flex-1 relative overflow-hidden backdrop-blur-2xl bg-background/80">
            <YearScrubber years={years} onJump={jumpToYear} />

            <ScrollArea className="h-full pr-8" ref={scrollRef}>
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <SearchIcon className="size-10 opacity-30" />
                  <p className="text-sm font-stashly">No items found</p>
                </div>
              ) : (
                <div className="p-4 space-y-8">
                  {groups.map(([dateLabel, groupItems]) => (
                    <section
                      key={dateLabel}
                      ref={(el) => {
                        if (el) groupRefs.current.set(dateLabel, el)
                        else groupRefs.current.delete(dateLabel)
                      }}
                    >
                      <DateGroupHeader
                        label={dateLabel}
                        items={groupItems}
                        selected={selected}
                        existingSet={existingSet}
                        onToggleAll={(ids) => {
                          setSelected((prev) => {
                            const next = new Set(prev)
                            const allSelected = ids.every(
                              (id) => next.has(id) || existingSet.has(id)
                            )
                            ids.forEach((id) => {
                              if (existingSet.has(id)) return
                              if (allSelected) next.delete(id)
                              else next.add(id)
                            })
                            return next
                          })
                        }}
                      />

                      <GridLayout>
                        {groupItems.map((item) => (
                          <GridItem
                            key={item.id}
                            item={item}
                            selected={selected.has(item.id)}
                            existing={existingSet.has(item.id)}
                            onToggle={toggleItem}
                            user={user}
                            searchParams={searchParams}
                            setSearchParams={setSearchParams}
                          />
                        ))}
                      </GridLayout>
                    </section>
                  ))}
                </div>
              )}
              <LoadMoreItems
                hasMore={hasMore}
                isLoading={isLoading}
                loadMore={loadMore}
              />
            </ScrollArea>
          </div>

          {/* ── Footer action bar (appears when items selected) ── */}
          <AnimatePresence>
            {selectedCount > 0 && (
              <motion.div
                initial={{ y: 48, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 48, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="sticky bottom-0 w-full inline-flex gap-2 p-2 items-center bg-sidebar z-40 h-12 border-t border-input shrink-0"
              >
                <CollectionIcon className="size-5 text-muted-foreground" />
                <span className="font-stashly text-sm font-medium truncate max-w-50">
                  {collectionName}
                </span>
                <Badge variant="default" className="rounded">
                  {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                </Badge>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    className="font-stashly"
                  >
                    Clear
                  </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={isSubmitting}
                      className="font-stashly bg-foreground text-background border-input rounded-md"
                    >
                      {isSubmitting
                        ? 'Adding…'
                        : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
                    </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogPortal>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Date group header with select-all checkbox
// ---------------------------------------------------------------------------

function DateGroupHeader({
  label,
  items,
  selected,
  existingSet,
  onToggleAll,
}: {
  label: string
  items: AddToCollectionItem[]
  selected: Set<string>
  existingSet: Set<string>
  onToggleAll: (ids: string[]) => void
}) {
  const selectableIds = items
    .map((i) => i.id)
    .filter((id) => !existingSet.has(id))
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someSelected = selectableIds.some((id) => selected.has(id))

  if (selectableIds.length === 0) {
    return (
      <h3 className="text-sm font-medium text-muted-foreground font-stashly">
        {label}
      </h3>
    )
  }

  return (
    <div
      className="flex items-center gap-2 group/header cursor-pointer"
      onClick={() => onToggleAll(selectableIds)}
    >
      <Checkbox
        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
        onCheckedChange={() => onToggleAll(selectableIds)}
        onClick={(e) => e.stopPropagation()}
        className="size-5 place-self-start hover:cursor-pointer"
        aria-label={`Select all items from ${label}`}
      />
      <h3 className="text-sm font-medium font-stashly group-hover/header:text-foreground transition-colors">
        {label}
      </h3>
      <span className="text-xs text-muted-foreground">
        {items.length} item{items.length !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trigger helper — wraps any element to open the dialog
// ---------------------------------------------------------------------------

// export function AddToCollectionTrigger({
//   children,
//   ...props
// }: Omit<AddToCollectionDialogProps, 'open' | 'onOpenChange'> & {
//   children: React.ReactNode
// }) {
//   const [open, setOpen] = useState(false)

//   return (
//     <>
//       <span onClick={() => setOpen(true)} className="contents">
//         {children}
//       </span>
//       <AddToCollectionDialog open={open} onOpenChange={setOpen} {...props} />
//     </>
//   )
// }
