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
  LoaderIcon,
  OutlineFillIcon,
  SymbleOutlineFillIcon,
} from '@/components/icons'
import { Button, SidebarTrigger } from '@/components/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClipboard } from '@/hooks/useClipboard'
import type { StashItemText } from '@/types/stash.types'
import { isMonoFile } from '@/utils/text-thumbnail'
import type { OutlineSymbol } from '@/.client/monaco-outline'
import { CodeOutline, CODE_OUTLINE_SIDEBAR_ID } from './code-outline'
import { CodeViewer } from './code-viewer'
import type { CodeViewerRef } from './code-viewer'

/**
 * DOM guard for the prose path only — past this many lines the tail is
 * dropped with a notice. Code files render through Monaco, which virtualizes
 * and needs no cap.
 */
const MAX_RENDER_LINES = 10_000

type TextDoc = { text: string }

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
    <Suspense fallback={<TextLoading />}>
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

function TextLoading() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-background text-muted-foreground">
      <LoaderIcon className="size-6 animate-spin" />
    </div>
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

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 gap-2 overflow-hidden">
      <CodeOutline
        cursorLine={cursorLine}
        hasOutline={hasOutline}
        onSelect={(symbol) => viewerRef.current?.reveal(symbol)}
        symbols={symbols}
      />

      <div className="relative h-[calc(100vh-4rem)] min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-input bg-card! shadow-stashly">
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
          revealColumn={numberParam(searchParams.get('col'))}
          revealLine={numberParam(searchParams.get('line'))}
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

/**
 * A positive integer from the query string, or `undefined`. Anything else —
 * absent, `0`, a word someone typed over the URL — means "no target", which
 * leaves the viewer at the top of the file.
 */
function numberParam(raw: string | null): number | undefined {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : undefined
}

/** Raw file text → its lines, BOM dropped and line endings normalized to LF. */
function splitLines(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
}

/** Line count of raw file text, matching how Monaco counts a model. */
function countLines(text: string): number {
  return splitLines(text).length
}

function ProseReader({ text }: { text: string }) {
  const lines = useMemo(() => splitLines(text), [text])
  const truncated = lines.length > MAX_RENDER_LINES
  const shown = truncated ? lines.slice(0, MAX_RENDER_LINES) : lines
  const label = truncated
    ? `${MAX_RENDER_LINES.toLocaleString()} / ${lines.length.toLocaleString()} lines`
    : `${lines.length.toLocaleString()} ${lines.length === 1 ? 'line' : 'lines'}`

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-md border border-input bg-card! shadow-stashly">
      <ScrollArea key="text" type="hover" className="h-[calc(100vh-4rem)]">
        <pre className="mx-auto w-full max-w-3xl whitespace-pre-wrap wrap-break-word px-4 py-8 font-stashly text-sm leading-7">
          {shown.join('\n')}
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
