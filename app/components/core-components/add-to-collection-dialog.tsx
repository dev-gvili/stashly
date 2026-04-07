import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useFetcher } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog, DialogPortal } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Badge } from '@/ui/badge'
import { ScrollArea } from '@/ui/scroll-area'
import { Checkbox } from '@/ui/checkbox'
import { SearchIcon, XIcon } from 'lucide-react'
import {
  CheckIcon,
  CollectionIcon,
  FileIcon,
  FolderIcon,
} from '@/components/icons'
import { toIcon } from '@/utils/converters'
import { cn } from '@/utils/styles'
import { formatSize } from '@/utils/formaters'
import type { Item, ItemCategory, ItemType } from '@/prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AddToCollectionItem = Pick<
  Item,
  'id' | 'name' | 'type' | 'category' | 'size' | 'createdAt'
> & {
  thumbnailUrl?: string | null
}

interface AddToCollectionDialogProps {
  /** Whether the dialog is open */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The collection to add items to */
  collectionId: string
  collectionName: string
  /** All items available to add */
  items: AddToCollectionItem[]
  /** IDs already in the collection (greyed out, pre-checked) */
  existingItemIds?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDate(items: AddToCollectionItem[]): [string, AddToCollectionItem[]][] {
  const map = new Map<string, AddToCollectionItem[]>()
  for (const item of items) {
    const key = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown date'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries())
}

function getYearsFromGroups(groups: [string, AddToCollectionItem[]][]): string[] {
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

function GridItem({
  item,
  selected,
  existing,
  onToggle,
}: {
  item: AddToCollectionItem
  selected: boolean
  existing: boolean
  onToggle: (id: string) => void
}) {
  const Icon = toIcon(item.category as ItemCategory) ?? FileIcon

  return (
    <button
      type="button"
      onClick={() => !existing && onToggle(item.id)}
      className={cn(
        'relative group aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected || existing
          ? 'border-primary'
          : 'border-transparent hover:border-muted-foreground/40',
        existing && 'opacity-60 cursor-default'
      )}
      aria-pressed={selected || existing}
      aria-label={`${selected ? 'Deselect' : 'Select'} ${item.name}`}
    >
      {/* thumbnail / icon */}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-sidebar">
          {item.type === 'folder' ? (
            <FolderIcon className="size-10 text-amber-500" />
          ) : item.type === 'collection' ? (
            <CollectionIcon className="size-10 text-violet-500" />
          ) : (
            <Icon className="size-10 text-muted-foreground" />
          )}
        </div>
      )}

      {/* dark overlay on hover when not selected */}
      {!selected && !existing && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
      )}

      {/* selected overlay */}
      {(selected || existing) && (
        <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
      )}

      {/* selection circle / checkmark */}
      <div
        className={cn(
          'absolute top-2 left-2 size-6 rounded-full border-2 flex items-center justify-center transition-all',
          selected || existing
            ? 'bg-primary border-primary'
            : 'bg-black/30 border-white/70 group-hover:border-white opacity-0 group-hover:opacity-100'
        )}
      >
        {(selected || existing) && (
          <CheckIcon className="size-3.5 text-primary-foreground" />
        )}
      </div>

      {/* item name tooltip on hover */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 translate-y-full group-hover:translate-y-0 transition-transform duration-150 pointer-events-none">
        <p className="text-white text-xs truncate font-medium">{item.name}</p>
        <p className="text-white/70 text-[10px]">
          {formatSize('byte', 'unit', Number(item.size))}
        </p>
      </div>

      {/* "already added" badge */}
      {existing && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            Added
          </Badge>
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

const FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: 'Images', value: 'image' as const },
  { label: 'Folders', value: 'folder' as const },
  { label: 'Files', value: 'file' as const },
] as const

type FilterValue = (typeof FILTERS)[number]['value']

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-sm font-medium transition-colors shrink-0',
        active
          ? 'bg-foreground text-background'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

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
          className="text-[10px] text-muted-foreground hover:text-foreground font-stashly leading-none py-0.5 transition-colors"
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
  open,
  onOpenChange,
  collectionId,
  collectionName,
  items,
  existingItemIds = [],
}: AddToCollectionDialogProps) {
  const fetcher = useFetcher()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Map<string, HTMLElement>>(new Map())
  const existingSet = useMemo(() => new Set(existingItemIds), [existingItemIds])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setQuery('')
      setFilter('all')
    }
  }, [open])

  // Close on successful submit
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data != null) {
      onOpenChange(false)
    }
  }, [fetcher.state, fetcher.data])

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filteredItems = useMemo(() => {
    let result = items
    if (query) {
      const q = query.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (filter === 'image') result = result.filter((i) => i.category === 'image')
    else if (filter === 'folder') result = result.filter((i) => i.type === 'folder')
    else if (filter === 'file')
      result = result.filter((i) => i.type === 'file' && i.category !== 'image')
    return result
  }, [items, query, filter])

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

  function handleDone() {
    if (selected.size === 0) {
      onOpenChange(false)
      return
    }
    fetcher.submit(
      {
        intent: 'add_items_to_collection',
        collectionId,
        itemIds: Array.from(selected).join(','),
      },
      { method: 'post', action: '/api/collections' }
    )
  }

  const selectedCount = selected.size
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-background"
        />

        {/* Full-screen panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden"
          role="dialog"
          aria-modal
          aria-label={`Add items to ${collectionName}`}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            {/* Close */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
              aria-label="Close"
            >
              <XIcon className="size-5" />
            </button>

            {/* Title */}
            <span className="font-semibold text-base font-stashly truncate shrink-0 hidden sm:block">
              Add to collection
            </span>

            {/* Search */}
            <div className="relative flex-1 max-w-xl mx-auto">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your stash"
                className="pl-9 bg-muted border-none h-9 rounded-full focus-visible:ring-1"
                autoFocus={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {/* Selected count badge */}
              <AnimatePresence>
                {selectedCount > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-sm text-muted-foreground tabular-nums"
                  >
                    {selectedCount} selected
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Done */}
              <Button
                onClick={handleDone}
                disabled={isSubmitting}
                size="sm"
                className="font-stashly rounded-full px-5"
              >
                {isSubmitting ? 'Adding…' : selectedCount > 0 ? `Add ${selectedCount}` : 'Done'}
              </Button>
            </div>
          </div>

          {/* ── Filter pills ── */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <FilterPill
                key={f.value}
                active={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </FilterPill>
            ))}

            {query && (
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 relative overflow-hidden">
            <YearScrubber years={years} onJump={jumpToYear} />

            <ScrollArea className="h-full pr-8" ref={scrollRef}>
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <SearchIcon className="size-10 opacity-30" />
                  <p className="text-sm font-stashly">No items found</p>
                </div>
              ) : (
                <div className="px-4 py-4 space-y-8">
                  {groups.map(([dateLabel, groupItems]) => (
                    <section
                      key={dateLabel}
                      ref={(el) => {
                        if (el) groupRefs.current.set(dateLabel, el)
                        else groupRefs.current.delete(dateLabel)
                      }}
                    >
                      {/* Date header with select-all for this group */}
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

                      {/* Grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-1 mt-2">
                        {groupItems.map((item) => (
                          <GridItem
                            key={item.id}
                            item={item}
                            selected={selected.has(item.id)}
                            existing={existingSet.has(item.id)}
                            onToggle={toggleItem}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── Footer action bar (appears when items selected) ── */}
          <AnimatePresence>
            {selectedCount > 0 && (
              <motion.div
                initial={{ y: 64, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 64, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="border-t bg-background px-6 py-3 flex items-center justify-between shrink-0"
              >
                <div className="flex items-center gap-3">
                  <CollectionIcon className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {collectionName}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    className="font-stashly"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDone}
                    disabled={isSubmitting}
                    className="font-stashly rounded-full px-6"
                  >
                    {isSubmitting ? 'Adding…' : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
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
  const selectableIds = items.map((i) => i.id).filter((id) => !existingSet.has(id))
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
    <div className="flex items-center gap-2 group/header cursor-pointer" onClick={() => onToggleAll(selectableIds)}>
      <Checkbox
        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
        onCheckedChange={() => onToggleAll(selectableIds)}
        onClick={(e) => e.stopPropagation()}
        className="size-4"
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

export function AddToCollectionTrigger({
  children,
  ...props
}: Omit<AddToCollectionDialogProps, 'open' | 'onOpenChange'> & {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>
      <AddToCollectionDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  )
}
