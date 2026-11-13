import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  kindFilterOptions,
  KindFilterSegments,
  type CollectionKind,
  type KindFilterValue,
} from '@/components/collections/kind-filter-segments'
import {
  CollectionItemCard,
  kindOf,
} from '@/components/core-components/collection-item-card'
import { LoadMoreItems } from '@/components/core-components/buttons'
import { SearchRefineInput } from '@/components/core-components/search-refine'
import { DropdownIcon } from '@/components/icons'
import { INVITE_CAPTION } from '@/components/views/invitations/invite-form-fields'
import { useCollectionMutations } from '@/hooks/useCollectionMutations'
import type { StashPickerItem } from '@/types/stash.types'
import { Button } from '@/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import { Label } from '@/ui/label'
import { ScrollArea } from '@/ui/scroll-area'
import { Switch } from '@/ui/switch'
import { cn } from '@/utils/styles'

export type AddToCollectionItem = StashPickerItem

interface AddToCollectionDialogProps {
  collectionId: string
  collectionName: string
  items: AddToCollectionItem[]
  existingItemIds?: string[]
  /** Called after files are submitted, so the page can reset its filters. */
  onAdded?: () => void
  /** Controlled mode, e.g. opened from `?add=1`. Omit to use the trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Grouping by upload day
// ---------------------------------------------------------------------------

const DAY_FMT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

function dayLabel(value: Date | string | null): string {
  if (!value) return 'Unknown date'
  const d = new Date(value)
  const day = d.toLocaleDateString(undefined, DAY_FMT)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return `Today · ${day}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${day}`
  const year = d.getFullYear() === today.getFullYear() ? '' : `, ${d.getFullYear()}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} · ${day}${year}`
}

type Row = AddToCollectionItem & { _day: string; _nameLower: string }

function groupByDay(rows: Row[]): [string, Row[]][] {
  const map = new Map<string, Row[]>()
  for (const row of rows) {
    const bucket = map.get(row._day)
    if (bucket) bucket.push(row)
    else map.set(row._day, [row])
  }
  return Array.from(map.entries())
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/** The search dialog's text buttons (Clear, Select all): mono caps, muted. */
const TEXT_BUTTON =
  'h-7 px-1.5 font-stashly text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground'

/**
 * Picker for adding files to a collection. A centred dialog (not full-screen)
 * with search, a kind filter, "Hide added", files grouped by upload day (each
 * group collapsible, with its own "Select all"), and a footer whose CTA reads
 * "Add N files". Files already in the collection show dimmed with an
 * "In collection" badge and cannot be re-added.
 *
 * @example
 * <AddToCollectionDialog collectionId={id} collectionName={name} items={available} existingItemIds={ids}>
 *   <Button>Add items</Button>
 * </AddToCollectionDialog>
 */
export function AddToCollectionDialog({
  collectionId,
  collectionName,
  items: initialItems,
  existingItemIds = [],
  onAdded,
  open: openProp,
  onOpenChange,
  children,
}: AddToCollectionDialogProps) {
  const pickerFetcher = useFetcher<{
    items: StashPickerItem[]
    nextCursor: string | null
    hasMore: boolean
  }>()
  const { addItems } = useCollectionMutations()

  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilterValue>('all')
  const [hideAdded, setHideAdded] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const existingSet = useMemo(() => new Set(existingItemIds), [existingItemIds])

  // Seeded from the host route's loaderData; later pages are appended below.
  // Not usePagination: it reads the host route's loader, which here holds the
  // collection's own items and would clobber this list after every action.
  const [items, setItems] = useState<StashPickerItem[]>(initialItems)
  const [hasMore, setHasMore] = useState(initialItems.length >= 50)

  useEffect(() => {
    setItems(initialItems)
    setHasMore(initialItems.length >= 50)
  }, [initialItems])

  useEffect(() => {
    if (pickerFetcher.state !== 'idle' || !pickerFetcher.data) return
    const page = pickerFetcher.data
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id))
      return [...prev, ...page.items.filter((i) => !seen.has(i.id))]
    })
    setHasMore(page.hasMore)
  }, [pickerFetcher.state, pickerFetcher.data])

  const isLoading = pickerFetcher.state !== 'idle'

  const loadMore = useCallback(() => {
    if (!hasMore) return
    const params = new URLSearchParams()
    params.set('cursor', pickerFetcher.data?.nextCursor ?? '')
    params.set('take', '60')
    pickerFetcher.load(`/api/collections/${collectionId}?${params.toString()}`)
  }, [hasMore, pickerFetcher, collectionId])

  const rows = useMemo<Row[]>(
    () =>
      items
        .filter((i) => i.type === 'file')
        .map((i) => ({
          ...i,
          _day: dayLabel(i.createdAt),
          _nameLower: i.name.toLowerCase(),
        })),
    [items]
  )

  // Every kind is listed, even an empty one, so the row never jumps.
  const kindOptions = useMemo(() => {
    const counts: Partial<Record<CollectionKind, number>> = {}
    for (const r of rows) {
      const k = kindOf(r.category)
      if (k !== 'other') counts[k] = (counts[k] ?? 0) + 1
    }
    return kindFilterOptions(counts, { hideEmpty: false })
  }, [rows])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groupByDay(
      rows.filter(
        (r) =>
          (!q || r._nameLower.includes(q)) &&
          (kind === 'all' || kindOf(r.category) === kind) &&
          !(hideAdded && existingSet.has(r.id))
      )
    )
  }, [rows, query, kind, hideAdded, existingSet])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** Selects every file in a day group, or clears them when all are already picked. */
  const toggleGroup = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const all = ids.every((id) => next.has(id))
      for (const id of ids) {
        if (all) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [])

  const setGroupOpen = useCallback((label: string, isOpen: boolean) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setSelected(new Set())
      setQuery('')
      setKind('all')
      setHideAdded(false)
      setCollapsed(new Set())
    }
  }

  function handleAdd() {
    if (selected.size === 0) return
    addItems({ id: collectionId, name: collectionName }, Array.from(selected))
    setSelected(new Set())
    setOpen(false)
    onAdded?.()
  }

  const count = selected.size

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      {/* The search dialog's shell (owner's call: every dialog looks alike):
          bg-card, a 24px corner, the stashly shadow, dashed rules, and no
          close button (Cancel and Esc close it). */}
      <DialogContent
        showCloseButton={false}
        className="h-dialog-lg flex max-w-5xl flex-col gap-0 overflow-hidden rounded-3xl border-input bg-card p-0 font-stashly shadow-stashly outline-none sm:max-w-5xl max-sm:h-dvh max-sm:max-w-full max-sm:rounded-none"
      >
        <DialogHeader className="gap-1.5 px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <DialogTitle className="font-stashly text-lg leading-8 font-normal tracking-wide">
            Add to “{collectionName}”
          </DialogTitle>
          <DialogDescription className="font-stashly text-sm">
            Pick files from your stash. They stay where they are — the
            collection only lists them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2.5 px-6 pb-4 sm:px-8">
          {/* The search dialog's field (owner's call: one search component).
              It filters the loaded files by name here; there is no meaning
              search in the picker. */}
          <SearchRefineInput
            value={query}
            onChange={setQuery}
            aria-label="Search your stash"
            // Shorter than in the search dialog, so a smaller corner: 16px on
            // this 33px field would make it a pill (no fully rounded corners).
            className="max-w-80 flex-1 basis-55 rounded-md py-0"
          />
          <KindFilterSegments
            value={kind}
            onValueChange={setKind}
            options={kindOptions}
            showIcons
          />
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="picker-hide-added"
              shape="square"
              className="border border-input"
              checked={hideAdded}
              onCheckedChange={setHideAdded}
            />
            <Label htmlFor="picker-hide-added" className="font-stashly text-sm">
              Hide added
            </Label>
          </div>
        </div>

        <div className="mx-6 border-t border-dashed border-input sm:mx-8" />

        {/* Radix ScrollArea needs a definite height to scroll: the wrapper takes the flex space, the area fills it. */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-5 px-6 pt-4 pb-6 sm:px-8">
              {groups.length === 0 ? (
                <p className="font-stashly py-12 text-center text-sm text-muted-foreground">
                  No files match. Try another search or type.
                </p>
              ) : (
                groups.map(([label, group]) => {
                  const isOpen = !collapsed.has(label)
                  const selectable = group
                    .filter((r) => !existingSet.has(r.id))
                    .map((r) => r.id)
                  const allPicked =
                    selectable.length > 0 && selectable.every((id) => selected.has(id))
                  return (
                    <Collapsible
                      key={label}
                      open={isOpen}
                      onOpenChange={(o) => setGroupOpen(label, o)}
                      className="flex flex-col gap-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger className="flex min-w-0 items-center gap-2 rounded-[4px] py-1 outline-none hover:cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50">
                          <DropdownIcon
                            aria-hidden
                            className={cn(
                              'size-3 shrink-0 text-muted-foreground transition-transform',
                              !isOpen && '-rotate-90'
                            )}
                          />
                          <h3 className={cn(INVITE_CAPTION, 'whitespace-nowrap text-foreground')}>
                            {label}
                          </h3>
                          <span className="font-stashly text-xs text-muted-foreground tabular-nums">
                            {group.length}
                          </span>
                        </CollapsibleTrigger>
                        <span className="flex-1" />
                        {selectable.length > 0 && (
                          <Button
                            variant="ghost"
                            className={TEXT_BUTTON}
                            onClick={() => toggleGroup(selectable)}
                          >
                            {allPicked ? 'Deselect all' : 'Select all'}
                          </Button>
                        )}
                      </div>
                      <CollapsibleContent className="grid-cards-sm grid gap-2.5">
                        {group.map((item) => (
                          <CollectionItemCard
                            key={item.id}
                            mode="picker"
                            item={item}
                            selected={selected.has(item.id)}
                            existing={existingSet.has(item.id)}
                            onToggle={toggle}
                          />
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })
              )}
              <LoadMoreItems
                hasMore={hasMore}
                isLoading={isLoading}
                loadMore={loadMore}
              />
            </div>
          </ScrollArea>
        </div>

        <div className="mx-6 border-t border-dashed border-input sm:mx-8" />
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 sm:px-8 sm:pb-6">
          <span className={cn(INVITE_CAPTION, 'whitespace-nowrap')}>
            {count === 0
              ? 'Select files to add'
              : `${count} ${count === 1 ? 'file' : 'files'} selected`}
          </span>
          {count > 0 && (
            <Button
              variant="ghost"
              className={TEXT_BUTTON}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            className="font-stashly"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="font-stashly"
            disabled={count === 0}
            onClick={handleAdd}
          >
            {count === 0 ? 'Add files' : `Add ${count} ${count === 1 ? 'file' : 'files'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
