import type { KeyboardEvent, MouseEvent } from 'react'
import { FilePreview } from '@/components/core-components/collection-cover'
import {
  AudioFillIcon,
  CheckIcon,
  DocumentFillIcon,
  FileFillIcon,
  ImageFillIcon,
  VideoFillIcon,
} from '@/components/icons'
import { Badge } from '@/ui/badge'
import { Checkbox } from '@/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

// ---------------------------------------------------------------------------
// Kinds — the coarse buckets the filters offer
// ---------------------------------------------------------------------------

export type Kind = 'image' | 'document' | 'audio' | 'video'

export const KIND_LABELS: Record<Kind, string> = {
  image: 'Images',
  document: 'Documents',
  audio: 'Audio',
  video: 'Video',
}

/** Maps an `ItemCategory` to a filter kind; categories with no bucket are `other`. */
export function kindOf(category: string): Kind | 'other' {
  switch (category) {
    case 'image':
    case 'graphic':
      return 'image'
    case 'document':
    case 'pdf':
    case 'text':
    case 'spreadsheet':
    case 'presentation':
      return 'document'
    case 'audio':
      return 'audio'
    case 'video':
      return 'video'
    default:
      return 'other'
  }
}

export function KindIcon({
  category,
  className,
}: {
  category: string
  className?: string
}) {
  const kind = kindOf(category)
  const Icon =
    kind === 'image'
      ? ImageFillIcon
      : kind === 'document'
        ? DocumentFillIcon
        : kind === 'audio'
          ? AudioFillIcon
          : kind === 'video'
            ? VideoFillIcon
            : FileFillIcon
  return <Icon className={cn('size-4 text-muted-foreground', className)} />
}

export interface KindOption {
  value: string
  label: string
  count?: number
}

/**
 * Segmented single-choice filter. Never squashes: it keeps its width
 * (`shrink-0`) and scrolls sideways instead, so a narrow toolbar wraps it to
 * its own line.
 *
 * @example
 * <KindFilter value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }]} />
 */
export function KindFilter({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: KindOption[]
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v)}
      className="max-w-full shrink-0 overflow-x-auto rounded-md ring-2 ring-accent scrollbar-none"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          variant="outline"
          className="font-stashly gap-1.5 border-none bg-card text-foreground hover:cursor-pointer hover:bg-muted aria-checked:bg-muted! aria-checked:text-accent-foreground"
        >
          {o.label}
          {o.count !== undefined && (
            <span className="font-stashly text-xs text-muted-foreground">
              {o.count}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// ---------------------------------------------------------------------------
// Item tile
// ---------------------------------------------------------------------------

export interface CollectionTileItem {
  id: string
  name: string
  category: string
  size: bigint | number
  createdAt: Date | string | null
  thumbnailUrl?: string | null
}

const DATE_FMT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

export function formatTileDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, DATE_FMT) : null
}

function tileMeta(item: CollectionTileItem) {
  const date = formatTileDate(item.createdAt)
  const size = formatSize('byte', 'unit', Number(item.size))
  return date ? `${size} · ${date}` : size
}

interface CollectionItemCardProps {
  item: CollectionTileItem
  mode?: 'detail' | 'picker'
  selected: boolean
  /** Detail: a selection exists, so a click toggles instead of opening. */
  selecting?: boolean
  /** Picker: already in the collection. Shown dimmed, not selectable. */
  existing?: boolean
  onToggle: (id: string) => void
  /** Detail: the check itself, so shift-click can extend a range (`useSelection`). */
  onCheckedChange?: (id: string, checked: boolean | 'indeterminate') => void
  onCheckboxMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void
  onOpen?: (id: string) => void
}

/**
 * A selectable file tile for the collection page and the add-items picker.
 * Detail: a left check, a click opens the file unless a selection exists.
 * Picker: a right check and the whole tile toggles.
 *
 * @example
 * <CollectionItemCard item={tile} selected={sel.has(id)} onToggle={sel.toggle} onOpen={open} />
 */
export function CollectionItemCard({
  item,
  mode = 'detail',
  selected,
  selecting = false,
  existing = false,
  onToggle,
  onCheckedChange,
  onCheckboxMouseDown,
  onOpen,
}: CollectionItemCardProps) {
  const picker = mode === 'picker'

  const footer = (
    <div
      className={cn(
        'flex items-center gap-2.25 px-3 py-2.5',
        existing && 'opacity-50'
      )}
    >
      <KindIcon category={item.category} className="size-3.75 shrink-0" />
      <div className="min-w-0">
        <p className="font-stashly truncate text-sm font-medium">{item.name}</p>
        <p className="font-stashly truncate text-xs text-muted-foreground">
          {tileMeta(item)}
        </p>
      </div>
    </div>
  )

  const preview = (
    <div
      className={cn(
        'relative aspect-4/3 overflow-hidden bg-muted',
        // The detail tile separates preview from footer; the picker tile doesn't.
        !picker && 'border-b border-input',
        existing && 'opacity-50'
      )}
    >
      <FilePreview url={item.thumbnailUrl} category={item.category} />
    </div>
  )

  const shell = cn(
    'relative flex flex-col overflow-hidden border border-border/50 bg-card text-left transition-[border-color,box-shadow] hover:border-border',
    picker ? 'rounded-xl' : 'rounded-2xl',
    selected && 'border-primary ring-3 ring-primary/15 hover:border-primary'
  )

  if (picker) {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (existing || (e.key !== ' ' && e.key !== 'Enter')) return
      e.preventDefault()
      onToggle(item.id)
    }
    return (
      <div
        role="checkbox"
        aria-checked={selected || existing}
        aria-disabled={existing}
        aria-label={item.name}
        tabIndex={existing ? -1 : 0}
        onClick={() => !existing && onToggle(item.id)}
        onKeyDown={onKeyDown}
        className={cn(
          shell,
          existing
            ? 'cursor-default'
            : 'cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50'
        )}
      >
        {preview}
        {footer}
        {existing ? (
          <Badge
            variant="secondary"
            className="font-stashly absolute top-2 left-2 gap-1 bg-popover/75 text-xs font-medium backdrop-blur-md"
          >
            <CheckIcon className="size-3" />
            In collection
          </Badge>
        ) : (
          <span
            aria-hidden
            className={cn(
              'absolute top-2 right-2 flex size-5.5 items-center justify-center rounded-full border border-white/75 bg-black/30 text-primary-foreground backdrop-blur-xs',
              selected && 'border-primary bg-primary'
            )}
          >
            {selected && <CheckIcon className="size-3.5" />}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={shell}>
      <button
        type="button"
        className="flex flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => (selecting ? onToggle(item.id) : onOpen?.(item.id))}
      >
        {preview}
        {footer}
      </button>
      <Checkbox
        checked={selected}
        onMouseDown={onCheckboxMouseDown}
        onCheckedChange={(c) =>
          onCheckedChange ? onCheckedChange(item.id, c) : onToggle(item.id)
        }
        aria-label={`Select ${item.name}`}
        className="absolute top-2 left-2 size-5.5 rounded-full border-white/75 bg-black/30 backdrop-blur-xs data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
    </div>
  )
}
