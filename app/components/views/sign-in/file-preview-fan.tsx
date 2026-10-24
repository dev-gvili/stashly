import { cn } from '@/utils/styles'
import { FilePreview, type FilePreviewKind } from './file-preview'

export interface FanItem {
  id: string
  kind: FilePreviewKind
  label: string
  withChart?: boolean
}

const DEFAULT_ITEMS: FanItem[] = [
  { id: 'deck', kind: 'document', label: 'Q3 Board Deck.pdf', withChart: true },
  { id: 'interview', kind: 'audio', label: 'Interview — Maya Chen.m4a' },
  { id: 'rooftop', kind: 'image', label: 'Lisbon rooftop.jpg' },
]

// Left / centre / right poses — literal classes so Tailwind compiles them.
const POSES = ['-rotate-9 translate-y-4.5 z-10', 'z-20', 'rotate-9 translate-y-4.5 z-10'] as const

export interface FilePreviewFanProps extends React.ComponentProps<'ul'> {
  items?: FanItem[]
}

/** Three stashed files fanned like a hand of cards. Decorative; labels are kept for AT. */
export function FilePreviewFan({ items = DEFAULT_ITEMS, className, ...props }: FilePreviewFanProps) {
  return (
    <ul
      aria-label="Recently stashed files"
      className={cn('relative flex h-59 items-start justify-center', className)}
      {...props}
    >
      {items.slice(0, 3).map((item, i) => (
        <li key={item.id} aria-label={item.label} className={cn('relative -mx-4.5', POSES[i])}>
          <FilePreview kind={item.kind} name={item.label} withChart={item.withChart} />
        </li>
      ))}
    </ul>
  )
}
