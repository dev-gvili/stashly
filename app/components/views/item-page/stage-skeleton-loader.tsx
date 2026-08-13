import type { JSX } from 'react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/utils/styles'

/**
 * Which stage layout the placeholder should imitate:
 * - `document` — a centred reading column (markdown / prose text)
 * - `code`     — gutter + indented lines (Monaco-backed viewers)
 * - `pdf`      — page rail + a page sheet on the canvas
 */
export type StageSkeletonVariant = 'document' | 'code' | 'pdf'

/**
 * StageSkeletonLoader — the single loading placeholder shared by every stage in
 * `views/item-page`. Each stage used to ship its own centred spinner, which
 * told the reader nothing about what was arriving and made the page jump when
 * the real layout replaced it. One component, three variants: the skeleton
 * traces the shape of the content that is streaming in, so the transition is a
 * fill-in rather than a swap.
 *
 * Renders as a full-surface block by default; pass `className="absolute inset-0"`
 * to overlay it on a stage that is already mounted (e.g. Monaco booting).
 */
export function StageSkeletonLoader({
  variant = 'document',
  className,
}: {
  variant?: StageSkeletonVariant
  className?: string
}): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        'flex h-full min-h-0 w-full overflow-hidden bg-background',
        className
      )}
    >
      {variant === 'code' ? (
        <CodeSkeleton />
      ) : variant === 'pdf' ? (
        <PdfSkeleton />
      ) : (
        <DocumentSkeleton />
      )}
    </div>
  )
}

// Fixed width patterns rather than randomised ones — a random ragged edge would
// differ between the server and client render and trip hydration.
const PROSE_LINES = ['w-full', 'w-11/12', 'w-full', 'w-10/12', 'w-9/12']
type CodeLine = {
  /** Nesting depth, 0–3. */
  indent: number
  /** How far across the column the line runs — a fraction, so it scales with the editor. */
  width: string
  /** Word-shaped blocks on the line, as fractions of the line's own width. */
  tokens: string[]
  /** Comment lines: one long dim run instead of punchy keyword + arguments. */
  comment?: boolean
}

/**
 * One screenful of imaginary source, shaped like a real module: a header
 * comment, an import cluster, then two nested blocks. Every measurement is a
 * *fraction* rather than a rem width — fixed widths bunched the whole
 * placeholder against the left gutter and left a wide editor visibly empty,
 * whereas fractions let the lines span the column at any width.
 *
 * An empty `tokens` array is a blank line; those breaks are what make the block
 * read as code rather than as a stack of bars.
 */
const CODE_BLOCK: CodeLine[] = [
  { indent: 0, width: 'w-7/12', tokens: ['w-full'], comment: true },
  { indent: 0, width: 'w-9/12', tokens: ['w-full'], comment: true },
  { indent: 0, width: 'w-5/12', tokens: ['w-full'], comment: true },
  { indent: 0, width: 'w-full', tokens: [] },

  // import cluster — short keyword, long specifier, short source
  {
    indent: 0,
    width: 'w-8/12',
    tokens: ['w-2/12', 'w-5/12', 'w-1/12', 'w-3/12'],
  },
  {
    indent: 0,
    width: 'w-6/12',
    tokens: ['w-2/12', 'w-4/12', 'w-1/12', 'w-4/12'],
  },
  {
    indent: 0,
    width: 'w-9/12',
    tokens: ['w-2/12', 'w-6/12', 'w-1/12', 'w-2/12'],
  },
  {
    indent: 0,
    width: 'w-7/12',
    tokens: ['w-2/12', 'w-3/12', 'w-1/12', 'w-5/12'],
  },
  { indent: 0, width: 'w-full', tokens: [] },

  // exported function + body
  { indent: 0, width: 'w-8/12', tokens: ['w-2/12', 'w-4/12', 'w-5/12'] },
  { indent: 1, width: 'w-7/12', tokens: ['w-3/12', 'w-8/12'] },
  { indent: 1, width: 'w-10/12', tokens: ['w-2/12', 'w-4/12', 'w-5/12'] },
  { indent: 2, width: 'w-8/12', tokens: ['w-4/12', 'w-7/12'] },
  { indent: 2, width: 'w-6/12', tokens: ['w-full'] },
  { indent: 1, width: 'w-1/12', tokens: ['w-full'] },
  { indent: 0, width: 'w-full', tokens: [] },

  // a nested branch, deeper indents
  {
    indent: 1,
    width: 'w-9/12',
    tokens: ['w-2/12', 'w-3/12', 'w-3/12', 'w-3/12'],
  },
  { indent: 2, width: 'w-7/12', tokens: ['w-5/12', 'w-6/12'] },
  { indent: 3, width: 'w-8/12', tokens: ['w-4/12', 'w-4/12', 'w-3/12'] },
  { indent: 3, width: 'w-5/12', tokens: ['w-full'] },
  { indent: 2, width: 'w-2/12', tokens: ['w-full'] },
  { indent: 1, width: 'w-1/12', tokens: ['w-full'] },
  { indent: 0, width: 'w-full', tokens: [] },

  {
    indent: 0,
    width: 'w-10/12',
    tokens: ['w-2/12', 'w-5/12', 'w-1/12', 'w-3/12'],
  },
  { indent: 1, width: 'w-6/12', tokens: ['w-4/12', 'w-7/12'] },
  { indent: 1, width: 'w-8/12', tokens: ['w-3/12', 'w-5/12', 'w-3/12'] },
  { indent: 0, width: 'w-1/12', tokens: ['w-full'] },
]

/**
 * The block above, repeated until it overruns any realistic viewport — the
 * point is that the skeleton reaches the bottom edge of the stage on a tall
 * screen instead of stopping halfway and leaving dead space. The overflow is
 * clipped, and the tail is faded out by the gradient in `CodeSkeleton`.
 */
const CODE_LINES = Array.from({ length: 4 }).flatMap(() => CODE_BLOCK)

/**
 * One code row: a fixed 28px band with the bar centred in it, so consecutive
 * lines are separated by real leading rather than sitting on top of each other.
 * `shrink-0` is load-bearing — the column holds far more rows than fit, and
 * without it flexbox compresses every row until the lines collide.
 */
const CODE_ROW = 'flex h-7 shrink-0 items-center'

/** Indent depth → left padding. Indexed, so the steps stay on Tailwind's scale. */
const INDENT_STEPS = ['pl-0', 'pl-6', 'pl-12', 'pl-18']

/** The minimap runs at a sixth of the pitch, so it needs its own longer list. */
const MINIMAP_LINES = Array.from({ length: 4 }).flatMap(() => CODE_LINES)

/** Indent, scaled down to minimap size. */
const MINIMAP_INDENTS = ['ml-0', 'ml-1', 'ml-2', 'ml-3']

function DocumentSkeleton(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <Skeleton className="h-7 w-1/2" />
      <div className="mt-8 flex flex-col gap-8">
        {[0, 1, 2, 3].map((block) => (
          <div key={block} className="flex flex-col gap-3">
            {PROSE_LINES.map((width, i) => (
              <Skeleton key={i} className={cn('h-3.5 shrink-0', width)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * CodeSkeleton — the editor before Monaco arrives: a numbered gutter, tokenized
 * lines that indent and break into paragraphs, and a minimap sliver on the
 * right. Every row is the same fixed height as the next, so when the real
 * editor mounts the text lands on the same rhythm the placeholder drew.
 */
function CodeSkeleton(): JSX.Element {
  return (
    <div className="relative h-full w-full min-w-0 overflow-hidden">
      <div className="flex h-full w-full min-w-0">
        {/* line-number gutter — short bars, right-aligned like real numbers */}
        <div className="flex w-12 shrink-0 flex-col items-end border-r border-input py-4 pr-3">
          {CODE_LINES.map((_, i) => (
            <div key={i} className={cn(CODE_ROW, 'justify-end')}>
              <Skeleton className="h-2 w-4 rounded-sm opacity-50" />
            </div>
          ))}
        </div>

        {/* code lines */}
        <div className="flex min-w-0 flex-1 flex-col py-4 pl-4 pr-6">
          {CODE_LINES.map((line, i) => (
            <div key={i} className={cn(CODE_ROW, INDENT_STEPS[line.indent])}>
              <div className={cn('flex items-center gap-2', line.width)}>
                {line.tokens.map((width, t) => (
                  <Skeleton
                    key={t}
                    className={cn(
                      'h-2 rounded-sm',
                      width,
                      // Comments sit back; on code lines the leading token reads
                      // as the keyword and the rest as its arguments.
                      line.comment ? 'opacity-40' : t > 0 && 'opacity-70'
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* minimap sliver — the editor's right rail, hinted at not drawn.
            Its own longer line list: at a sixth of the code's row pitch it
            would otherwise cover only the top quarter of the column. */}
        <div className="hidden w-16 shrink-0 flex-col gap-1 border-l border-input py-4 pl-3 pr-4 opacity-25 md:flex">
          {MINIMAP_LINES.map((line, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-0.5 shrink-0 rounded-none',
                MINIMAP_INDENTS[line.indent],
                line.tokens.length === 0 ? 'w-0' : line.width
              )}
            />
          ))}
        </div>
      </div>

      {/* Fades the clipped tail instead of cutting it mid-line. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent" />
    </div>
  )
}

function PdfSkeleton(): JSX.Element {
  return (
    <div className="flex h-full w-full min-w-0 gap-2">
      {/* page thumbnail rail — mirrors the collapsible rail in PdfStage */}
      <div className="hidden w-40 shrink-0 flex-col gap-3 border-r border-input p-3 md:flex">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[1/1.414] w-full shrink-0" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 justify-center overflow-hidden p-6">
        <div className="w-full max-w-2xl">
          <Skeleton className="aspect-[1/1.414] w-full" />
        </div>
      </div>
    </div>
  )
}
