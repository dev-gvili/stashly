import { cn } from '@/utils/styles'
import { FilePreviewFan } from './file-preview-fan'
import { SearchResultPreview } from './search-result-preview'

export interface SignInShowcaseProps extends React.ComponentProps<'section'> {
  headline?: string
  description?: string
}

/** Right-hand panel: dot grid + primary glow, fanned previews, a live-looking search hit. */
export function SignInShowcase({
  headline = 'Search what’s inside, not what it’s called.',
  description = 'Transcripts, captions and OCR — processed right in your browser.',
  className,
  ...props
}: SignInShowcaseProps) {
  return (
    <section
      aria-label="What Stashly does"
      className={cn(
        'relative flex min-h-150 grow basis-120 flex-col items-center justify-center gap-11 overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar px-8 py-12',
        className
      )}
      {...props}
    >
      <div aria-hidden="true" className="bg-dots absolute inset-0 mask-radial-from-25% mask-radial-to-72%" />
      <div
        aria-hidden="true"
        className="absolute top-8 size-140 bg-radial from-primary/40 to-transparent to-62% opacity-55 blur-3xl"
      />
      <FilePreviewFan />
      <SearchResultPreview />
      <div className="relative flex max-w-105 flex-col gap-2 text-center">
        <p className="text-xl font-semibold tracking-tight text-balance text-foreground">{headline}</p>
        <p className="text-sm leading-normal text-pretty text-muted-foreground">{description}</p>
      </div>
    </section>
  )
}
