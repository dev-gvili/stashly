import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Await,
  href,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  CheckIcon,
  CopyIcon,
  DocumentFillIcon,
  ItemPanelFillIcon,
  OutlineFillIcon,
  SymbleOutlineFillIcon,
} from '@/components/icons'
import { Button, SidebarTrigger } from '@/components/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClipboard } from '@/hooks/useClipboard'
import { useLandingScroll } from '@/hooks/useLandingScroll'
import type { StashItemText, TextDoc } from '@/types/stash.types'
import { landingFromParams, landingWordEnd } from '@/utils/search-evidence'
import { countLines, isMonoFile, splitLines } from '@/utils/text-thumbnail'
import type { OutlineSymbol } from '@/.client/monaco-outline'
import { CodeOutline, CODE_OUTLINE_SIDEBAR_ID } from './code-outline'
import { CodeViewer } from './code-viewer'
import type { CodeViewerRef } from './code-viewer'
import { StageSkeletonLoader } from './stage-skeleton-loader'

/**
 * DOM guard for the prose path only — past this many lines the tail is
 * dropped with a notice. Code files render through Monaco, which virtualizes
 * and needs no cap.
 */
const MAX_RENDER_LINES = 10_000


/**
 * TextStage — read-only viewer for text-based files. Suspense/Await boundary
 * around the server-loaded body, mirroring MarkdownStage: the file loader
 * returns the S3 read as an unawaited promise so the page shell paints while
 * the document streams.
 *
 * Code-ish files (per `isMonoFile`) render in Monaco — VS Code's editor —
 * with syntax highlighting, find, folding, and virtualized rendering for
 * huge files; prose files render as a wrapped reading column.
 */
export function TextStage({
  item,
  textDoc,
}: {
  item: StashItemText
  textDoc: Promise<TextDoc> | null
}) {
  if (!textDoc) return <TextError message="No file URL" />
  const mono = isMonoFile({
    name: item.name,
    type: item.file?.mimeType ?? undefined,
  })
  return (
    <Suspense
      fallback={<StageSkeletonLoader variant={mono ? 'code' : 'document'} />}
    >
      <Await resolve={textDoc} errorElement={<TextError />}>
        {(doc: TextDoc) => (
          <TextReader
            fileName={item.name}
            itemId={item.id}
            mono={mono}
            text={doc.text}
          />
        )}
      </Await>
    </Suspense>
  )
}

function TextError({
  message = 'Could not load this file',
}: {
  message?: string
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <DocumentFillIcon className="size-10 opacity-40" />
      <p className="font-stashly text-sm">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TextReader — renders the resolved document
// ---------------------------------------------------------------------------

function TextReader({
  text,
  mono,
  fileName,
  itemId,
}: {
  text: string
  mono: boolean
  fileName: string
  itemId?: string
}) {
  if (mono) {
    return <CodeReader fileName={fileName} itemId={itemId} text={text} />
  }
  return <ProseReader text={text} />
}

/**
 * CodeReader — Monaco path, laid out like `MarkdownReader`: the outline rail
 * sits beside the editor card, its open state living in the shared sidebar
 * provider so the toolbar's `SidebarTrigger` drives it and the choice
 * persists in the sidebar cookie.
 *
 * The line count is owned by the editor, not by the loaded text: Format
 * Document rewrites the whole buffer (and Revert Formatting puts it back), so
 * a count derived from `text` goes stale the moment either runs. The seed
 * keeps the toolbar honest while the Monaco chunk downloads, and while the
 * plain-<pre> fallback is showing.
 */
function CodeReader({
  text,
  fileName,
  itemId,
}: {
  text: string
  fileName: string
  itemId?: string
}) {
  const viewerRef = useRef<CodeViewerRef>(null)
  const [lineCount, setLineCount] = useState(() => countLines(text))
  const [symbols, setSymbols] = useState<OutlineSymbol[]>([])
  const [cursorLine, setCursorLine] = useState(1)
  useEffect(() => setLineCount(countLines(text)), [text])

  const hasOutline = symbols.length > 0

  // Go to Definition across files is a real navigation: the target file has a
  // page, so routing to it keeps the URL, breadcrumbs and item panel in step
  // with the source on screen. The symbol's position rides along in the query
  // string, which is also what makes the landing spot survive a refresh or a
  // pasted link.
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  // A definition jump's `?line=` counts the file; a search link's counts the
  // index (`lines=index`) and is mapped back to the file here.
  const landing = useMemo(() => landingFromParams(searchParams, text), [searchParams, text])

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 gap-2 overflow-hidden">
      <CodeOutline
        cursorLine={cursorLine}
        hasOutline={hasOutline}
        onSelect={(symbol) => viewerRef.current?.reveal(symbol)}
        symbols={symbols}
      />

      {/* border-2 rather than ring-2: a ring paints *outside* the box, and the
          stage is flush against `main`'s overflow-hidden clip, which sheared the
          line off the top, left and bottom edges. Same 2px of `border-input`,
          drawn inside, so the frame closes on all four sides. */}
      <div className="relative h-[calc(100vh-4rem)] min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border-2 border-input bg-card! shadow-stashly">
        <CodeViewer
          ref={viewerRef}
          fileName={fileName}
          itemId={itemId}
          onCursorLine={setCursorLine}
          onLineCount={setLineCount}
          onNavigate={({ itemId: fileId, folderId, line, column }) =>
            navigate(
              `${href('/:me/stash/folders/:folderId/files/:fileId', {
                me: params.me ?? '',
                folderId,
                fileId,
              })}?line=${line}&col=${column}`
            )
          }
          onOutline={setSymbols}
          revealColumn={landing.column}
          revealLine={landing.line}
          text={text}
        />
        <StageToolbar
          label={`${lineCount.toLocaleString()} ${lineCount === 1 ? 'line' : 'lines'}`}
          text={text}
        >
          {hasOutline && (
            <SidebarTrigger
              sidebarId={CODE_OUTLINE_SIDEBAR_ID}
              asChild
              tooltip="Toggle Outline"
            >
              <Button
                variant="ghost"
                size="icon"
                className="rounded-md border-none"
              >
                <SymbleOutlineFillIcon className="size-5 text-muted-foreground rotate-180 rotate-x-180" />
              </Button>
            </SidebarTrigger>
          )}
        </StageToolbar>
      </div>
    </div>
  )
}

function ProseReader({ text }: { text: string }) {
  const lines = useMemo(() => splitLines(text), [text])
  const truncated = lines.length > MAX_RENDER_LINES
  const shown = truncated ? lines.slice(0, MAX_RENDER_LINES) : lines

  // A search permalink (`?line=&col=`): that line is tinted for a moment and
  // its hit word marked, and the reading column scrolls to it.
  const [searchParams] = useSearchParams()
  const { line, column } = useMemo(() => landingFromParams(searchParams, text), [searchParams, text])
  const landing = line != null && line >= 1 && line <= shown.length ? line : undefined
  const landingRef = useRef<HTMLSpanElement>(null)
  useLandingScroll(landingRef, landing)
  const label = truncated
    ? `${MAX_RENDER_LINES.toLocaleString()} / ${lines.length.toLocaleString()} lines`
    : `${lines.length.toLocaleString()} ${lines.length === 1 ? 'line' : 'lines'}`

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-md border-2 border-input bg-card! shadow-stashly">
      <ScrollArea key="text" type="hover" className="h-[calc(100vh-4rem)]">
        <pre className="mx-auto w-full max-w-3xl whitespace-pre-wrap wrap-break-word px-4 py-8 font-stashly text-sm leading-7">
          {landing == null ? (
            shown.join('\n')
          ) : (
            // Three runs rather than a node per line: one element is enough to
            // scroll to and tint, and a 10,000-line file stays one text node
            // either side of it.
            <>
              {landing > 1 && `${shown.slice(0, landing - 1).join('\n')}\n`}
              <span
                ref={landingRef}
                key={`${landing}:${column ?? ''}`}
                className="animate-stashly-line-flash -mx-1 rounded-[4px] px-1"
              >
                <LandingLine text={shown[landing - 1]} column={column} />
              </span>
              {landing < shown.length && `\n${shown.slice(landing).join('\n')}`}
            </>
          )}
        </pre>

        {truncated && (
          <p className="px-4 pb-8 text-center font-stashly text-xs text-muted-foreground">
            Showing the first {MAX_RENDER_LINES.toLocaleString()} of{' '}
            {lines.length.toLocaleString()} lines — download the file for the
            rest.
          </p>
        )}

        <StageToolbar
          label={label}
          text={text}
          title={
            truncated
              ? `Rendering the first ${MAX_RENDER_LINES.toLocaleString()} lines`
              : undefined
          }
        />
      </ScrollArea>
    </div>
  )
}

/**
 * A landing line with its hit word marked: the word that starts at `column`
 * (1-based), as the search card highlighted it. Without a usable column the
 * line shows plain, tinted by its parent.
 */
function LandingLine({ text, column }: { text: string; column?: number }) {
  if (column == null || column < 1 || column > text.length) return <>{text}</>
  const start = column - 1
  const end = landingWordEnd(text, start)
  return (
    <>
      {text.slice(0, start)}
      <mark className="border-primary/40 bg-primary/20 text-foreground rounded-[4px] border px-0.5 font-semibold">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  )
}

function StageToolbar({
  text,
  label,
  title,
  children,
}: {
  text: string
  label: string
  title?: string
  /** Stage-specific actions, rendered ahead of the shared ones. */
  children?: ReactNode
}) {
  const { copy, copied } = useClipboard()
  return (
    <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-lg">
      {children}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-md border-none"
        title={copied ? 'Copied' : 'Copy contents'}
        onClick={() => copy(text)}
      >
        {copied ? (
          <CheckIcon className="size-5 text-muted-foreground" />
        ) : (
          <CopyIcon className="size-5 text-muted-foreground" />
        )}
      </Button>
      <span
        className="px-1 font-stashly text-xs tabular-nums text-muted-foreground"
        title={title}
      >
        {label}
      </span>
      <SidebarTrigger
        sidebarId="item_panel"
        asChild
        tooltip="Toggle Item Panel"
      >
        <Button variant="ghost" size="icon" className="rounded-md border-none">
          <ItemPanelFillIcon className="size-5 text-muted-foreground" />
        </Button>
      </SidebarTrigger>
    </div>
  )
}
