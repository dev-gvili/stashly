import { cn } from '@/utils/styles'

export type FilePreviewKind = 'document' | 'audio' | 'image'

export interface FilePreviewProps extends React.ComponentProps<'div'> {
  kind: FilePreviewKind
  /** Document only: draw the small bar chart under the text lines. */
  withChart?: boolean
}

// Tailwind only compiles classes it can see, so data-driven sizes are literal lookups.
const LINE_WIDTHS = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3', 'w-full', 'w-4/5'] as const
const CHART_HEIGHTS = ['h-2.5', 'h-3.5', 'h-3', 'h-4.5', 'h-4', 'h-6'] as const
const WAVE_HEIGHTS = [
  'h-10', 'h-18', 'h-28', 'h-36', 'h-30', 'h-20', 'h-12', 'h-16', 'h-26', 'h-38',
  'h-32', 'h-22', 'h-14', 'h-8', 'h-14', 'h-24', 'h-34', 'h-28', 'h-18', 'h-10',
  'h-12', 'h-20', 'h-30', 'h-38', 'h-34', 'h-24', 'h-14', 'h-10', 'h-16', 'h-28',
  'h-36', 'h-26', 'h-16', 'h-10', 'h-18', 'h-28', 'h-32', 'h-22', 'h-12', 'h-8',
] as const
const PLAYED_BARS = 15

function DocumentPreview({ withChart }: { withChart?: boolean }) {
  return (
    <div className="absolute inset-x-7 top-4 -bottom-2.5 flex flex-col gap-1.25 rounded-sm bg-neutral-50 px-3 py-3.5 shadow-lg">
      <div className="mb-1.25 h-1.5 w-1/2 rounded-xs bg-primary" />
      {LINE_WIDTHS.map((width, i) => (
        <div key={i} className={cn('h-0.75 rounded-xs bg-neutral-300', width)} />
      ))}
      {withChart ? (
        <div className="mt-1.5 flex h-6.5 items-end gap-0.75">
          {CHART_HEIGHTS.map((height, i) => (
            <div key={i} className={cn('flex-1 rounded-xs bg-primary', height)} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AudioPreview() {
  return (
    <div className="absolute inset-x-4 inset-y-0 flex items-center gap-0.5">
      {WAVE_HEIGHTS.map((height, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-xs', height, i < PLAYED_BARS ? 'bg-primary' : 'bg-border')}
        />
      ))}
    </div>
  )
}

/** A dusk rooftop photo, drawn with palette gradients so no binary asset ships. */
function ImagePreview() {
  return (
    <div className="absolute inset-0 bg-linear-to-b from-orange-200 via-orange-300 to-orange-400">
      <div className="absolute top-10 right-8 size-6 rounded-sm bg-amber-50 shadow-lg shadow-amber-200" />
      <div className="absolute inset-x-0 bottom-0 h-7/12 bg-orange-800" />
      <div className="absolute inset-x-0 bottom-0 h-5/12 bg-orange-900" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-stone-800" />
    </div>
  )
}

export function FilePreview({ kind, withChart, className, ...props }: FilePreviewProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-muted', className)} {...props}>
      {kind === 'document' ? <DocumentPreview withChart={withChart} /> : null}
      {kind === 'audio' ? <AudioPreview /> : null}
      {kind === 'image' ? <ImagePreview /> : null}
    </div>
  )
}
