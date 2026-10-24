import { AIFillIcon, Pdf2Icon } from '@/components/icons'
import { cn } from '@/utils/styles'

export interface SearchResultPreviewProps extends React.ComponentProps<'figure'> {
  query?: string
  fileName?: string
  location?: string
  before?: string
  match?: string
  after?: string
}

/** A frozen semantic-search result: the query, then the passage it matched inside a PDF. */
export function SearchResultPreview({
  query = 'churn after the pricing change',
  fileName = 'Q3 Board Deck.pdf',
  location = 'page 7',
  before = '…churn fell to ',
  match = '2.1% in Q3',
  after = ' after the pricing change…',
  className,
  ...props
}: SearchResultPreviewProps) {
  return (
    <figure
      className={cn(
        'surface-glass relative m-0 flex w-full max-w-105 flex-col gap-1.5 rounded-xl p-1.5 shadow-stashly',
        className
      )}
      {...props}
    >
      <div className="flex h-10 items-center gap-2.5 px-3">
        <AIFillIcon className="size-4 shrink-0 text-primary" />
        <span className="text-sm text-foreground">{query}</span>
      </div>
      <figcaption className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2.5">
        <Pdf2Icon className="size-4.5 shrink-0 text-foreground/85" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="text-sm font-medium text-foreground">
            {fileName}{' '}
            <span className="text-xs font-normal text-muted-foreground">{'· ' + location}</span>
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {before}
            <mark className="rounded-xs bg-primary/15 px-0.75 text-foreground">{match}</mark>
            {after}
          </span>
        </div>
      </figcaption>
    </figure>
  )
}
