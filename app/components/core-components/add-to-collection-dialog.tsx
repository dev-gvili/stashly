import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  CollectionItemCard,
  KindFilter,
  kindOf,
  KIND_LABELS,
  type Kind,
} from '@/components/core-components/collection-item-card'
import { LoadMoreItems } from '@/components/core-components/buttons'
import { SearchFillIcon } from '@/components/icons'
import { useCollectionMutations } from '@/hooks/useCollectionMutations'
import type { StashPickerItem } from '@/types/stash.types'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/ui/input-group'
import { Label } from '@/ui/label'
import { ScrollArea } from '@/ui/scroll-area'
import { Switch } from '@/ui/switch'

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

const KIND_OPTIONS = [
  { value: 'all', label: 'All' },
  ...(Object.keys(KIND_LABELS) as Kind[]).map((k) => ({
    value: k,
    label: KIND_LABELS[k],
  })),
]

/**
 * Picker for adding files to a collection. A centred dialog (not full-screen)
 * with search, a kind filter, "Hide added", files grouped by upload day, and a
 * footer whose CTA reads "Add N files". Files already in the collection show
 * dimmed with an "In collection" badge and cannot be re-added.
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
  const [kind, setKind] = useState('all')
  const [hideAdded, setHideAdded] = useState(false)
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

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setSelected(new Set())
      setQuery('')
      setKind('all')
      setHideAdded(false)
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
      <DialogContent className="h-dialog-lg flex max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl bg-background p-0 sm:max-w-5xl max-sm:h-dvh max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader className="px-5 pt-5 pb-4 pr-16">
          <DialogTitle className="font-stashly text-lg font-semibold tracking-tight">
            Add to “{collectionName}”
          </DialogTitle>
          <DialogDescription className="font-stashly text-sm">
            Pick files from your stash. They stay where they are — the
            collection only lists them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-input px-5 pb-3.5">
          <InputGroup className="h-8.5 max-w-80 flex-1 basis-55">
            <InputGroupAddon>
              <SearchFillIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              className="font-stashly"
              placeholder="Search your stash"
              aria-label="Search your stash"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <KindFilter value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="picker-hide-added"
              checked={hideAdded}
              onCheckedChange={setHideAdded}
            />
            <Label htmlFor="picker-hide-added" className="font-stashly text-sm">
              Hide added
            </Label>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5.5 px-5 pt-4 pb-6">
            {groups.length === 0 ? (
              <p className="font-stashly py-12 text-center text-sm text-muted-foreground">
                No files match. Try another search or type.
              </p>
            ) : (
              groups.map(([label, group]) => (
                <section key={label} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <h3 className="font-stashly text-sm font-semibold whitespace-nowrap">
                      {label}
                    </h3>
                    <span className="font-stashly text-xs text-muted-foreground">
                      {group.length}
                    </span>
                  </div>
                  <div className="grid-cards-sm grid gap-2.5">
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
                  </div>
                </section>
              ))
            )}
            <LoadMoreItems
              hasMore={hasMore}
              isLoading={isLoading}
              loadMore={loadMore}
            />
          </div>
        </ScrollArea>

        <div className="flex flex-wrap items-center gap-3 border-t border-input bg-sidebar px-5 py-3">
          <span className="font-stashly text-sm whitespace-nowrap">
            {count === 0
              ? 'Select files to add'
              : `${count} ${count === 1 ? 'file' : 'files'} selected`}
          </span>
          {count > 0 && (
            <Button
              variant="link"
              className="font-stashly h-auto p-0"
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
