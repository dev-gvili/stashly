import { AIFillIcon, AudioIcon, ImageIcon, Pdf2Icon } from '@/components/icons'
import { cn } from '@/utils/styles'

export type FilePreviewKind = 'document' | 'audio' | 'image'

export interface FilePreviewProps extends React.ComponentProps<'div'> {
  kind: FilePreviewKind
  /** File name shown in the card footer. */
  name: string
  /** Document only: draw the small bar chart under the text lines. */
  withChart?: boolean
}

const KIND_ICONS = { document: Pdf2Icon, audio: AudioIcon, image: ImageIcon } as const

// Tailwind only compiles classes it can see, so data-driven sizes are literal lookups.
const LINE_WIDTHS = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3', 'w-full'] as const
const CHART_HEIGHTS = ['h-2.5', 'h-3.5', 'h-3', 'h-4.5', 'h-4', 'h-6'] as const
const WAVE_HEIGHTS = [
  'h-4', 'h-6', 'h-9', 'h-12', 'h-14', 'h-12', 'h-9', 'h-7',
  'h-5', 'h-7', 'h-10', 'h-13', 'h-11', 'h-8', 'h-6', 'h-4',
  'h-5', 'h-8', 'h-11', 'h-14', 'h-13', 'h-10', 'h-7', 'h-5',
  'h-6', 'h-9', 'h-12', 'h-13', 'h-10', 'h-7', 'h-5', 'h-4',
] as const
const PLAYED_BARS = 12

/** A white sheet in every colour mode — paper doesn't follow the theme. */
function DocumentPreview({ withChart }: { withChart?: boolean }) {
  return (
    <div className="absolute inset-x-7 top-3.5 -bottom-2.5 flex flex-col gap-1.25 rounded-md bg-neutral-50 px-3 py-3 shadow-lg">
      <div className="flex items-center gap-1.5">
        <div className="size-2.5 rounded-sm bg-primary" />
        <div className="h-1.25 w-1/2 rounded-xs bg-neutral-700" />
      </div>
      {LINE_WIDTHS.map((width, i) => (
        <div key={i} className={cn('h-0.75 rounded-xs bg-neutral-300', width)} />
      ))}
      <div className="h-0.75 w-3/4 rounded-xs bg-primary/35" />
      {withChart ? (
        <div className="mt-1.5 flex h-6 items-end gap-0.75">
          {CHART_HEIGHTS.map((height, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-t-xs',
                height,
                i === CHART_HEIGHTS.length - 1 ? 'bg-primary' : 'bg-primary/30'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AudioPreview() {
  return (
    <div className="absolute inset-x-3.5 inset-y-0 flex items-center">
      <div className="flex h-16 w-full items-center gap-0.5">
        {WAVE_HEIGHTS.map((height, i) => (
          <div
            key={i}
            className={cn('flex-1 rounded-xs', height, i < PLAYED_BARS ? 'bg-primary' : 'bg-border')}
          />
        ))}
      </div>
    </div>
  )
}

/** A dusk ridge photo drawn from fixed dusk tokens, so no binary asset ships. */
function ImagePreview() {
  return (
    <div className="absolute inset-0 bg-linear-to-b from-dusk-1 via-dusk-2 to-dusk-3">
      <div className="absolute top-8 right-8 size-5.5 rounded-full bg-white shadow-lg shadow-primary/40" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-ridge-back clip-ridge-back" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-ridge-front clip-ridge-front" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.75 font-mono text-xs text-white backdrop-blur-sm">
        <AIFillIcon className="size-3 shrink-0 text-primary" />
        ridge at dusk
      </div>
    </div>
  )
}

/** A stashed-file card: drawn preview on top, type icon + file name below. */
export function FilePreview({ kind, name, withChart, className, ...props }: FilePreviewProps) {
  const Icon = KIND_ICONS[kind]
  return (
    <div
      className={cn(
        'flex h-53 w-42 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
        className
      )}
      {...props}
    >
      <div aria-hidden className="relative flex-1 overflow-hidden bg-muted bg-preview-glow">
        {kind === 'document' ? <DocumentPreview withChart={withChart} /> : null}
        {kind === 'audio' ? <AudioPreview /> : null}
        {kind === 'image' ? <ImagePreview /> : null}
      </div>
      <div aria-hidden className="flex items-center gap-1.5 border-t border-input bg-card px-3 py-2.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-sans text-xs font-medium text-foreground">{name}</span>
      </div>
    </div>
  )
}
