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
import { cn } from '@/utils/styles'
import { isMonoFile } from '@/utils/text-thumbnail'

/** DOM guard: past this many lines the tail is dropped with a notice. */
const MAX_RENDER_LINES = 10_000

type TextDoc = { text: string }

/**
 * TextStage — read-only viewer for text-based files (plain text, code,
 * config, logs). Suspense/Await boundary around the server-loaded body,
 * mirroring MarkdownStage: the file loader returns the S3 read as an
 * unawaited promise so the page shell paints while the document streams.
 *
 * Code-ish files (per `isMonoFile`) render monospaced with a line-number
 * gutter and horizontal scroll; prose files render as a wrapped column.
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
        {(doc: TextDoc) => <TextReader mono={mono} text={doc.text} />}
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

function TextReader({ text, mono }: { text: string; mono: boolean }) {
  const { copy, copied } = useClipboard()

  // Tabs become 4 spaces so mono column alignment matches the thumbnail
  // renderer (tab-size isn't stylable without arbitrary Tailwind values).
  const lines = useMemo(
    () =>
      text
        .replace(/^﻿/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, '    ')
        .split('\n'),
    [text]
  )
  const truncated = lines.length > MAX_RENDER_LINES
  const shown = truncated ? lines.slice(0, MAX_RENDER_LINES) : lines
  // Gutter width tracks the widest line number so digits never overflow.
  const gutterCh = `${String(shown.length).length + 2}ch`

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-md border border-input bg-card! shadow-stashly">
      <ScrollArea
        key="text"
        type="hover"
        scrollbars={mono ? 'both' : 'vertical'}
        className="h-[calc(100vh-4rem)]"
      >
        {mono ? (
          <div className="min-w-max py-4 pr-8 font-mono text-sm leading-6">
            {shown.map((line, i) => (
              <div key={i} className="flex">
                <span
                  className="sticky left-0 shrink-0 select-none bg-card pr-4 text-right tabular-nums text-muted-foreground"
                  style={{ width: gutterCh }}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <pre className="mx-auto w-full max-w-3xl whitespace-pre-wrap break-words px-4 py-8 font-stashly text-sm leading-7">
            {shown.join('\n')}
          </pre>
        )}

        {truncated && (
          <p className="px-4 pb-8 text-center font-stashly text-xs text-muted-foreground">
            Showing the first {MAX_RENDER_LINES.toLocaleString()} of{' '}
            {lines.length.toLocaleString()} lines — download the file for the
            rest.
          </p>
        )}

        {/* Floating toolbar */}
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
          <span className="px-1 font-stashly text-xs tabular-nums text-muted-foreground">
            {lines.length.toLocaleString()}{' '}
            {lines.length === 1 ? 'line' : 'lines'}
          </span>
          <SidebarTrigger
            sidebarId="item_panel"
            asChild
            tooltip="Toggle Item Panel"
          >
            <Button
              variant="ghost"
              size="icon"
              className="rounded-md border-none"
            >
              <ItemPanelFillIcon className={cn('size-5 text-muted-foreground')} />
            </Button>
          </SidebarTrigger>
        </div>
      </ScrollArea>
    </div>
  )
}
