import { ResumeFillIcon } from '@/components/icons'
import { KIND_ICON } from '@/components/views/home-components/home-format'
import type { FileKind } from '@/types/home.types'
import { cn } from '@/utils/styles'

const PAGE_LINES = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6', 'w-2/3']
const WAVE = ['h-3', 'h-5', 'h-8', 'h-6', 'h-10', 'h-7', 'h-4', 'h-9', 'h-12', 'h-8', 'h-5', 'h-10', 'h-6', 'h-3', 'h-7', 'h-11', 'h-8', 'h-4', 'h-6', 'h-9', 'h-5', 'h-3', 'h-7', 'h-4']
const CODE_ROWS: [string, string][][] = [
  [['w-8', 'bg-primary/70'], ['w-14', 'bg-muted-foreground/40']],
  [['w-4', 'bg-transparent'], ['w-10', 'bg-muted-foreground/40'], ['w-6', 'bg-primary/40']],
  [['w-4', 'bg-transparent'], ['w-16', 'bg-muted-foreground/25']],
  [['w-8', 'bg-transparent'], ['w-6', 'bg-primary/70'], ['w-12', 'bg-muted-foreground/40']],
  [['w-4', 'bg-transparent'], ['w-9', 'bg-muted-foreground/25']],
  [['w-3', 'bg-muted-foreground/40']],
  [['w-10', 'bg-primary/40'], ['w-8', 'bg-muted-foreground/25']],
]

/**
 * Category preview for a file tile: thumbnail, page, waveform, video poster or
 * code. Fills its (relative) parent.
 */
export function HomeFilePreview({
  kind,
  thumbnailUrl,
  duration,
  className,
}: {
  kind: FileKind
  thumbnailUrl?: string
  duration?: string
  className?: string
}) {
  const Icon = KIND_ICON[kind]

  if (thumbnailUrl)
    return (
      <div className={cn('absolute inset-0 bg-muted', className)}>
        <img src={thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
        {kind === 'video' && <VideoChrome duration={duration} />}
      </div>
    )

  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-muted', className)}>
      {kind === 'document' && (
        <div className="absolute inset-x-7 top-4 -bottom-3 flex flex-col gap-1.5 rounded-sm border border-border/50 bg-card p-3 shadow-md">
          <div className="mb-1 h-1.5 w-1/2 rounded-full bg-primary" />
          {PAGE_LINES.map((w, i) => (
            <div key={i} className={cn('h-1 rounded-full bg-border', w)} />
          ))}
        </div>
      )}
      {kind === 'audio' && (
        <div className="absolute inset-0 flex items-center gap-0.5 px-4">
          {WAVE.map((h, i) => (
            <div key={i} className={cn('flex-1 rounded-full', h, i < 9 ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
      )}
      {kind === 'video' && (
        <div className="absolute inset-0 bg-secondary">
          <VideoChrome duration={duration} />
        </div>
      )}
      {kind === 'code' && (
        <div className="absolute inset-0 flex flex-col gap-2 p-4">
          {CODE_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map(([w, c], j) => (
                <div key={j} className={cn('h-1 rounded-full', w, c)} />
              ))}
            </div>
          ))}
        </div>
      )}
      {kind === 'image' && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Icon className="size-7" />
        </div>
      )}
    </div>
  )
}

function VideoChrome({ duration }: { duration?: string }) {
  return (
    <>
      <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/60 text-foreground backdrop-blur-sm">
        <ResumeFillIcon className="size-4.5" />
      </span>
      <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-2">
        <div className="h-0.75 flex-1 overflow-hidden rounded-full bg-foreground/20">
          <div className="h-full w-1/3 rounded-full bg-foreground" />
        </div>
        {duration && <span className="font-stashly text-2xs text-foreground tabular-nums">{duration}</span>}
      </div>
    </>
  )
}
