import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
// Loaded only when this stage renders (React 19 hoists & dedupes the link to
// <head> via `precedence`), so the ligature font never ships on non-markdown
// pages. Code blocks use 'JetBrains Mono Variable' — see `.markdown-stage code`.
import {
  DocumentFillIcon,
  LoaderIcon,
  SidebarFillIcon,
} from '@/components/icons'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/utils/styles'
import { Button, SidebarTrigger, useSidebar } from '@/components/ui'
import {
  extractMarkdownHeadings,
  loadMarkdownText,
  type MarkdownHeading,
} from '@/utils/markdown'
import type { Route } from '../../../+types/root'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkdownItemShape = {
  id: string
  name: string
  markdown: {
    title: string | null
    headingCount: number | null
  } | null
}

const RAIL_WIDTH = '18rem' // expanded outline rail width

// Sanitize schema: start from the GitHub-flavoured default (which already
// blocks `javascript:` hrefs, event handlers, <script>, etc.) and additionally
// allow `className` (task-list / code-language classes) plus per-cell
// `text-align` on table cells. Heading ids come from rehype-slug, which runs
// *after* sanitize so its ids are never stripped.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
    td: [...(defaultSchema.attributes?.td ?? []), 'style'],
    th: [...(defaultSchema.attributes?.th ?? []), 'style'],
  },
}

const REMARK_PLUGINS = [remarkGfm]
// rehype-sanitize first (cleans the tree), then rehype-slug (adds heading ids).
const REHYPE_PLUGINS = [[rehypeSanitize, sanitizeSchema], rehypeSlug] as never

// ---------------------------------------------------------------------------
// useMarkdownDocument — fetches the raw document client-side
// ---------------------------------------------------------------------------

function useMarkdownDocument(src: string) {
  const [state, setState] = useState<{
    text: string
    headings: MarkdownHeading[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState(null)
    setError(null)
    if (!src) {
      setError('No file URL')
      return
    }
    ;(async () => {
      try {
        const text = await loadMarkdownText(src)
        if (cancelled) return
        setState({ text, headings: extractMarkdownHeadings(text) })
      } catch (err) {
        if (cancelled) return
        console.error('[markdown-stage] failed to load document', err)
        setError('Could not load this document')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [src])

  return { ...(state ?? { text: '', headings: [] }), ready: !!state, error }
}

// ---------------------------------------------------------------------------
// MarkdownStage — exported main component
// ---------------------------------------------------------------------------

export function MarkdownStage({
  item,
  src,
}: {
  item: MarkdownItemShape
  src: string
}) {
  // The outline rail's open state lives in the app's shared sidebar provider
  // (keyed by id) so the SidebarTrigger toggle and cookie persistence integrate
  // with the rest of the app — same pattern as the PDF page rail.
  const { open: railOpen } = useSidebar('md_outline_rails')
  const { text, headings, ready, error } = useMarkdownDocument(src)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headingEls = useRef(new Map<string, HTMLElement>())
  const [activeId, setActiveId] = useState<string | null>(null)

  // Index rendered heading elements by id once the HTML mounts.
  useEffect(() => {
    if (!ready) return
    const root = scrollRef.current
    if (!root) return
    headingEls.current.clear()
    for (const el of root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')) {
      if (el.id) headingEls.current.set(el.id, el)
    }
    setActiveId(headings[0]?.id ?? null)
  }, [ready, text, headings])

  // Track which heading dominates the viewport for the outline highlight.
  useEffect(() => {
    if (!ready) return
    const ratios = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set((entry.target as HTMLElement).id, entry.intersectionRatio)
        }
        let best: string | null = null
        let bestRatio = -1
        for (const [id, r] of ratios) {
          if (r > bestRatio) {
            best = id
            bestRatio = r
          }
        }
        if (bestRatio > 0 && best) setActiveId(best)
      },
      { threshold: [0, 0.5, 1], rootMargin: '0px 0px -60% 0px' }
    )
    for (const el of headingEls.current.values()) io.observe(el)
    return () => io.disconnect()
  }, [ready, text])

  // Scroll only the viewer's own viewport — scrollIntoView would also scroll
  // every scrollable ancestor and shove the stage under the sticky app header.
  const goToHeading = (id: string) => {
    const el = headingEls.current.get(id)
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!el || !viewport) return
    const top =
      viewport.scrollTop +
      el.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top -
      24
    viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  const hasOutline = useMemo(() => headings.length > 0, [headings])

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <DocumentFillIcon className="size-10 opacity-40" />
        <p className="font-stashly text-sm">{error}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-background text-muted-foreground">
        <LoaderIcon className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden gap-2">
      {/* Outline rail — inline collapsible panel nested after the app sidebar.
          Driven by the shared provider state; width animates to 0 when
          collapsed. */}
      <div
        data-state={railOpen ? 'expanded' : 'collapsed'}
        className={cn(
          'h-[calc(100vh-4rem)] shrink-0 overflow-hidden bg-card transition-[width,display] duration-200 ease-linear border-input flex w-full flex-col rounded-lg border shadow-stashly',
          railOpen && hasOutline ? `w-[${RAIL_WIDTH}] max-w-80` : 'hidden'
        )}
      >
        <ScrollArea className={`h-full w-[${RAIL_WIDTH}]`} type="auto">
          <div className="flex flex-col gap-0.5  pt-4">
            <span className="px-2 pb-2 font-stashly text-xs uppercase text-muted-foreground">
              Outline
            </span>
            <ul className="flex flex-col gap items-start w-full">
              {headings.map((h) => (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  key={h.id}
                  onClick={() => goToHeading(h.id)}
                  aria-current={activeId === h.id || undefined}
                  className={cn(
                    'font-stashly text-xs transition-colors hover:cursor-pointer',
                    activeId === h.id
                      ? 'bg-transparent text-current font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  style={{ paddingLeft: `${(h.level - 1) * 6}px` }}
                  title={h.text}
                >
                  <li key={h.id}>
                    <span className='w-60 truncate'>{h.text}</span>
                  </li>
                </Button>
              ))}
            </ul>
          </div>
        </ScrollArea>
      </div>

      {/* Main reader */}
      <div
        ref={scrollRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-card! rounded-md p-4 border border-input shadow-stashly h-[calc(100vh-4rem)]"
      >
        <ScrollArea type="auto" className="h-full">
          {/* pb-24: the floating toolbar overlays the bottom — extra padding so
              the last block can scroll fully above it. */}
          <article className="markdown-stage mx-auto w-full max-w-5xl px-8  pb-24 font-stashly">
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              rehypePlugins={REHYPE_PLUGINS}
              components={{
                a: (props) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                img: (props) => <img {...props} loading="lazy" />,
                code: (props) => (
                  <code
                    {...props}
                    className={cn(
                      'bg-foreground! text-background! rounded! font-semibold! text-xs!',
                      props.className
                    )}
                  />
                ),
                pre: (props) => (
                  <pre
                    {...props}
                    className={cn("bg-accent! [&_code]:font-mono! [&_code]:bg-accent! [&_code]:text-accent-foreground!", props.className)}
                  />
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </article>

          {/* Floating toolbar */}
          {hasOutline && (
            <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-lg">
              <SidebarTrigger
                sidebarId="md_outline_rails"
                asChild
                tooltip="Toggle Outline"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-md border-none"
                >
                  <SidebarFillIcon
                    className={cn('size-5 text-muted-foreground')}
                  />
                </Button>
              </SidebarTrigger>
              <span className="px-1 font-stashly text-xs tabular-nums text-muted-foreground">
                {headings.length}{' '}
                {headings.length === 1 ? 'heading' : 'headings'}
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
                  <SidebarFillIcon
                    className={cn('size-5 text-muted-foreground')}
                  />
                </Button>
              </SidebarTrigger>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
