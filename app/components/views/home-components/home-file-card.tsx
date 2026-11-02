import { Link } from 'react-router'
import { AIFillIcon, PinFillIcon, PinItemFillIcon } from '@/components/icons'
import { HomeFilePreview } from '@/components/views/home-components/home-file-preview'
import { KIND_ICON, relativeTime } from '@/components/views/home-components/home-format'
import type { HomeFile } from '@/types/home.types'
import { Card } from '@/ui/card'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

/**
 * File tile for the home feed: category preview over name + "size · updated".
 * The whole card is a link; the pin toggle sits above it.
 */
export function HomeFileCard({
  file,
  onTogglePin,
  className,
}: {
  file: HomeFile
  onTogglePin?: (file: HomeFile) => void
  className?: string
}) {
  const Icon = KIND_ICON[file.kind]

  return (
    <Card
      data-slot="home-file-card"
      className={cn(
        'group relative min-w-0 gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card p-0 shadow-none transition-[border-color,box-shadow] hover:border-border hover:shadow-stashly',
        className
      )}
    >
      <Link
        to={file.href}
        aria-label={'Open ' + file.name}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="relative aspect-4/3 border-b border-border/50">
        <HomeFilePreview kind={file.kind} thumbnailUrl={file.thumbnailUrl} duration={file.duration} />
        {file.extension && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-background/80 px-1.5 py-0.5 font-stashly text-2xs text-muted-foreground backdrop-blur-sm">
            {file.extension}
          </span>
        )}
        {onTogglePin && (
          <button
            type="button"
            aria-pressed={!!file.pinned}
            aria-label={file.pinned ? 'Unpin ' + file.name : 'Pin ' + file.name}
            onClick={() => onTogglePin(file)}
            className={cn(
              'absolute top-2.5 right-2.5 z-20 grid size-7 place-items-center rounded-lg border-0 bg-background/80 backdrop-blur-sm transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              file.pinned ? 'text-primary opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
            )}
          >
            {file.pinned ? <PinFillIcon className="size-3.5" /> : <PinItemFillIcon className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        <span className="truncate font-stashly text-sm font-medium tracking-tight">{file.name}</span>
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate font-stashly text-2xs">
            {formatSize('byte', 'unit', file.size)} · {relativeTime(file.updatedAt)}
          </span>
          {file.searchable && <AIFillIcon aria-label="Searchable" className="ml-auto size-3.5 shrink-0 text-primary" />}
        </div>
      </div>
    </Card>
  )
}
