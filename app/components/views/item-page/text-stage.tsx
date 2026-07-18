import { Suspense, useMemo } from 'react'
import { Await } from 'react-router'
import {
  CheckIcon,
  CopyIcon,
  DocumentFillIcon,
  ItemPanelFillIcon,
  LoaderIcon,
} from '@/components/icons'
import { Button, SidebarTrigger } from '@/components/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClipboard } from '@/hooks/useClipboard'
import type { StashItemText } from '@/types/stash.types'
import { isMonoFile } from '@/utils/text-thumbnail'
import { CodeViewer } from './code-viewer'

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
          <TextReader fileName={item.name} mono={mono} text={doc.text} />
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
}: {
  text: string
  mono: boolean
  fileName: string
}) {
  if (mono) {
    const lineCount = text.split('\n').length
    return (
      <div className="relative h-[calc(100vh-4rem)] min-h-0 w-full min-w-0 overflow-hidden rounded-md border border-input bg-card! shadow-stashly">
        <CodeViewer fileName={fileName} text={text} />
        <StageToolbar label={`${lineCount.toLocaleString()} lines`} text={text} />
      </div>
    )
  }
  return <ProseReader text={text} />
}

function ProseReader({ text }: { text: string }) {
  const lines = useMemo(
    () =>
      text
        .replace(/^﻿/, '')
        .replace(/\r\n?/g, '\n')
        .split('\n'),
    [text]
  )
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
}: {
  text: string
  label: string
  title?: string
}) {
  const { copy, copied } = useClipboard()
  return (
    <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-lg">
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
