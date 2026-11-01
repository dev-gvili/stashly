import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LoadMoreItems } from '@/components/core-components/buttons'
import {
  AddToCollectionDialog,
  type AddToCollectionItem,
} from '@/components/core-components/add-to-collection-dialog'
import { CollectionActionsMenu } from '@/components/core-components/collection-actions-menu'
import {
  CollectionItemCard,
  formatTileDate,
  KIND_LABELS,
  KindFilter,
  KindIcon,
  kindOf,
  type CollectionTileItem,
  type Kind,
} from '@/components/core-components/collection-item-card'
import { SelectionBar } from '@/components/core-components/selection-bar'
import {
  AddIcon,
  ArrowLeftFillIcon,
  GridFillIcon,
  ListFillIcon,
  RemoveIcon,
  SearchFillIcon,
  SortListIcon,
} from '@/components/icons'
import { CollectionEmptyState } from '@/components/states/collection-empty-state'
import { LayoutMenu, LayoutMenuItem } from '@/components/ui/layout-menu'
import {
  useCollectionMutations,
  usePendingRemovedIds,
} from '@/hooks/useCollectionMutations'
import { useCollectionSelection } from '@/hooks/useCollectionSelection'
import { useItemUrl } from '@/hooks/useItemUrl'
import type { StashItem, StashPickerItem } from '@/types/stash.types'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Checkbox } from '@/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/input-group'
import { Tooltip } from '@/ui/tooltip'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionHeader {
  id: string
  name: string
  size: bigint | number
  itemCount: number
}

/**
 * A collection row. `getCollectionItems` selects whole `Item` rows, so these
 * carry `parentId` (the file page needs its folder segment) and real
 * `thumbnails` (the best stored stage, already signed).
 */
type CollectionItem = StashPickerItem & {
  parentId?: string | null
  thumbnails: StashItem['thumbnails']
}

interface CollectionViewProps {
  collection: CollectionHeader
  items: CollectionItem[]
  availableItems: AddToCollectionItem[]
  existingItemIds: string[]
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
  collectionsHref: string
}

type Tile = CollectionTileItem & { parentId: string | null }

// Server-side sort (the loader's `?orderBy[...]`, allow-listed in
// collection-order.ts) so it holds across pages. No param means name ascending.
const SORTS = [
  { label: 'Name', param: null },
  { label: 'Newest', param: ['createdAt', 'desc'] },
  { label: 'Size', param: ['size', 'desc'] },
] as const

function sortIndexOf(searchParams: URLSearchParams) {
  const idx = SORTS.findIndex(
    (s) => s.param && searchParams.has(`orderBy[${s.param[0]}]`)
  )
  return idx === -1 ? 0 : idx
}

function plural(n: number) {
  return `${n} ${n === 1 ? 'file' : 'files'}`
}

// ---------------------------------------------------------------------------
// List row
// ---------------------------------------------------------------------------

function CollectionItemRow({
  item,
  selected,
  selecting,
  onToggle,
  onOpen,
  onRemove,
}: {
  item: Tile
  selected: boolean
  selecting: boolean
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div
      className={cn(
        'font-stashly group flex h-13 items-center gap-3 rounded-lg px-2 hover:bg-secondary',
        selected && 'bg-primary/15'
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle(item.id)}
        aria-label={`Select ${item.name}`}
        className="size-5.5 shrink-0 rounded-full"
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => (selecting ? onToggle(item.id) : onOpen(item.id))}
      >
        <span className="flex h-7.5 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <KindIcon category={item.category} />
          )}
        </span>
        <span className="truncate text-sm font-medium">{item.name}</span>
      </button>
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {formatSize('byte', 'unit', Number(item.size))}
      </span>
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {formatTileDate(item.createdAt)}
      </span>
      <Tooltip content="Remove from collection">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 hover:bg-destructive/15 hover:text-destructive"
          aria-label="Remove from collection"
          onClick={() => onRemove(item.id)}
        >
          <RemoveIcon className="size-4" />
        </Button>
      </Tooltip>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * A single collection: title + meta, an Add items CTA, a kind / search / sort
 * toolbar (swapped in place for the selection bar while files are selected),
 * and the files as tiles or rows.
 *
 * Kind and search filter the loaded pages; sort is server-side. Share, the
 * shared-with avatars, "updated" and bulk Download wait on data and endpoints
 * the loader and API don't have yet.
 *
 * @example
 * <CollectionView collection={c} items={items} availableItems={a} existingItemIds={ids} … />
 */
export function CollectionView({
  collection,
  items,
  availableItems,
  existingItemIds,
  hasMore,
  isLoading,
  loadMore,
  collectionsHref,
}: CollectionViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const itemUrl = useItemUrl()
  const { removeItems } = useCollectionMutations()
  const removing = usePendingRemovedIds(collection.id)

  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')

  const view = searchParams.get('layout') === 'list' ? 'list' : 'grid'
  const sortIdx = sortIndexOf(searchParams)
  const addOpen = searchParams.get('add') === '1'

  // Items still in the collection (optimistic: removals in flight are hidden).
  const tiles = useMemo<Tile[]>(
    () =>
      items
        .filter((i) => !removing.has(i.id))
        .map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          size: i.size,
          createdAt: i.createdAt,
          parentId: i.parentId ?? null,
          thumbnailUrl:
            i.thumbnails?.find((t) => t.url && !t.url.startsWith('#'))?.url ??
            null,
        })),
    [items, removing]
  )

  const itemCount = Math.max(0, collection.itemCount - removing.size)

  const kindOptions = useMemo(() => {
    const counts = new Map<Kind, number>()
    for (const t of tiles) {
      const k = kindOf(t.category)
      if (k !== 'other') counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [
      { value: 'all', label: 'All', count: tiles.length },
      ...(Object.keys(KIND_LABELS) as Kind[])
        .filter((k) => counts.has(k))
        .map((k) => ({ value: k, label: KIND_LABELS[k], count: counts.get(k) })),
    ]
  }, [tiles])

  // A kind whose files were all removed falls back to All.
  const activeKind = kindOptions.some((o) => o.value === kind) ? kind : 'all'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tiles.filter(
      (t) =>
        (activeKind === 'all' || kindOf(t.category) === activeKind) &&
        (!q || t.name.toLowerCase().includes(q))
    )
  }, [tiles, activeKind, query])

  const ids = useMemo(() => filtered.map((t) => t.id), [filtered])
  const sel = useCollectionSelection(ids)
  const col = { id: collection.id, name: collection.name }

  const openItem = useCallback(
    (id: string) => {
      const t = tiles.find((x) => x.id === id)
      if (t)
        navigate(
          itemUrl({ type: 'file', id, parentId: t.parentId ?? '', ownerId: '' })
        )
    },
    [tiles, navigate, itemUrl]
  )

  function setParams(update: (p: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        update(prev)
        return prev
      },
      { preventScrollReset: true }
    )
  }

  function setSort(index: number) {
    setParams((p) => {
      for (const key of [...p.keys()]) if (key.startsWith('orderBy')) p.delete(key)
      const s = SORTS[index]
      if (s.param) p.set(`orderBy[${s.param[0]}]`, s.param[1])
    })
  }

  function handleAddOpenChange(open: boolean) {
    setParams((p) => (open ? p.set('add', '1') : p.delete('add')))
  }

  // New files should be visible right away: clear the filters, newest first.
  function handleAdded() {
    setKind('all')
    setQuery('')
    setSort(1)
  }

  function removeOne(id: string) {
    removeItems(col, [id])
  }

  function removeSelected() {
    removeItems(col, [...sel.selected])
    sel.clear()
  }

  const isEmpty = tiles.length === 0
  const addButton = (
    <Button className="font-stashly">
      <AddIcon className="size-5" />
      Add items
    </Button>
  )

  return (
    <div className="relative mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-8 pt-6 pb-30 max-sm:px-4">
      <div className="bg-dots mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-72" />

      <Button
        variant="ghost"
        size="sm"
        asChild
        className="font-stashly relative self-start whitespace-nowrap"
      >
        <Link to={`${collectionsHref}?layout=grid`}>
          <ArrowLeftFillIcon className="size-4" />
          All collections
        </Link>
      </Button>

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-stashly text-3xl font-semibold tracking-tighter break-words">
            {collection.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-stashly text-xs">
              {plural(itemCount)}
            </Badge>
            <Badge variant="secondary" className="font-stashly text-xs">
              {formatSize('byte', 'unit', Number(collection.size))}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddToCollectionDialog
            collectionId={collection.id}
            collectionName={collection.name}
            items={availableItems}
            existingItemIds={existingItemIds}
            open={addOpen}
            onOpenChange={handleAddOpenChange}
            onAdded={handleAdded}
          >
            {addButton}
          </AddToCollectionDialog>
          <CollectionActionsMenu
            collection={{ ...col, itemCount }}
            variant="detail"
            memberIds={existingItemIds}
          />
        </div>
      </div>

      {isEmpty ? (
        <CollectionEmptyState variant="collection">
          <Button className="font-stashly" onClick={() => handleAddOpenChange(true)}>
            <AddIcon className="size-5" />
            Add items
          </Button>
        </CollectionEmptyState>
      ) : (
        <>
          {sel.isSelecting ? (
            <SelectionBar
              count={sel.count}
              allSelected={sel.allSelected}
              onToggleAll={sel.allSelected ? sel.clear : sel.selectAll}
              onClear={sel.clear}
              onRemove={removeSelected}
            />
          ) : (
            <div className="relative flex min-h-11 flex-wrap items-center justify-between gap-2.5">
              <KindFilter
                value={activeKind}
                onChange={setKind}
                options={kindOptions}
              />
              <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="h-8 w-50 max-sm:w-full">
                  <InputGroupAddon>
                    <SearchFillIcon className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="font-stashly"
                    placeholder="Find in collection"
                    aria-label="Find in collection"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </InputGroup>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-stashly bg-card"
                  onClick={() => setSort((sortIdx + 1) % SORTS.length)}
                >
                  <SortListIcon className="size-4" />
                  {SORTS[sortIdx].label}
                </Button>
                <LayoutMenu value={view} className="shrink-0">
                  <LayoutMenuItem value="grid" tooltip="Grid" aria-label="Grid view">
                    <GridFillIcon className="size-5" />
                  </LayoutMenuItem>
                  <LayoutMenuItem value="list" tooltip="List" aria-label="List view">
                    <ListFillIcon className="size-5" />
                  </LayoutMenuItem>
                </LayoutMenu>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="font-stashly py-12 text-center text-sm text-muted-foreground">
              Nothing in this collection matches.
            </p>
          ) : view === 'list' ? (
            <div className="flex flex-col">
              <div className="font-stashly flex items-center gap-3 border-b border-input px-2 pb-2 text-xs tracking-widest text-muted-foreground uppercase">
                <span className="w-5.5 shrink-0" />
                <span className="flex-1">Name</span>
                <span className="w-24 shrink-0">Size</span>
                <span className="w-24 shrink-0">Uploaded</span>
                <span className="size-8 shrink-0" />
              </div>
              {filtered.map((t) => (
                <CollectionItemRow
                  key={t.id}
                  item={t}
                  selected={sel.selected.has(t.id)}
                  selecting={sel.isSelecting}
                  onToggle={sel.toggle}
                  onOpen={openItem}
                  onRemove={removeOne}
                />
              ))}
            </div>
          ) : (
            <div className="grid-cards-md grid gap-3.5">
              {filtered.map((t) => (
                <CollectionItemCard
                  key={t.id}
                  item={t}
                  selected={sel.selected.has(t.id)}
                  selecting={sel.isSelecting}
                  onToggle={sel.toggle}
                  onOpen={openItem}
                />
              ))}
            </div>
          )}
        </>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <LoadMoreItems
            loadMore={loadMore}
            isLoading={isLoading}
            hasMore={hasMore}
          />
        </div>
      )}
    </div>
  )
}
