import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { Ref } from 'react'
import { ArrowLeftFillIcon, InfoFillIcon } from '@/components/icons'
import { Button } from '@/components/ui'
import { useStableCallback } from '@/hooks/useStableCallback'
import type { CodeViewerHandle } from '@/.client/monaco'
import type { OutlineSymbol } from '@/.client/monaco-outline'
import { StageSkeletonLoader } from './stage-skeleton-loader'

/** How long a formatting result stays on screen. */
const NOTICE_MS = 4000

/** What a mounted viewer exposes to the stage around it. */
export type CodeViewerRef = Pick<CodeViewerHandle, 'reveal'>

/**
 * CodeViewer — mounts Monaco (VS Code's editor) as a read-only viewer.
 * The editor lives in `@/.client/monaco` and is dynamic-imported from an
 * effect, so it never runs during SSR and its ~MB chunk only downloads when
 * a code file is actually opened. If Monaco fails to load, degrades to a
 * plain scrollable <pre> so the file stays readable.
 */
export function CodeViewer({
  text,
  fileName,
  itemId,
  revealLine,
  revealColumn,
  onLineCount,
  onOutline,
  onCursorLine,
  onNavigate,
  ref,
}: {
  text: string
  fileName: string
  itemId?: string
  /**
   * Line to scroll to once the editor is up — how a Go to Definition jump
   * lands on its symbol instead of at the top of the file it navigated to.
   */
  revealLine?: number
  revealColumn?: number
  /**
   * Receives the editor's live line count — at mount, and again after Format
   * Document / Revert Formatting rewrite the buffer.
   */
  onLineCount?: (count: number) => void
  /** Receives the document's symbol tree, rebuilt as the language service answers. */
  onOutline?: (symbols: OutlineSymbol[]) => void
  /** Receives the cursor's line, so an outline can mark the symbol it sits in. */
  onCursorLine?: (line: number) => void
  /**
   * Go to Definition resolved to another uploaded file: the stage routes to
   * that file's page. See `CodeViewerOptions.onNavigate`.
   */
  onNavigate?: (target: {
    itemId: string
    folderId: string
    line: number
    column: number
  }) => void
  /** Exposes `reveal`, so the outline rail can jump the editor to a symbol. */
  ref?: Ref<CodeViewerRef>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CodeViewerHandle | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  /**
   * Set while the editor is showing a definition from a file that has no page
   * of its own (`lib.es5.d.ts`, an `@types` package). The page around it —
   * URL, breadcrumbs, item panel — still describes `fileName`, so the banner
   * is what stops that from reading as a lie.
   */
  const [detour, setDetour] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The handle is stable while the live viewer behind it is swapped on every
  // remount, so the rail never holds a disposed editor.
  useImperativeHandle(
    ref,
    () => ({ reveal: (target) => viewerRef.current?.reveal(target) }),
    []
  )

  // Stable wrappers: these land in the mount effect's dependencies, so an
  // inline callback from the parent would otherwise rebuild Monaco every render.
  const reportLineCount = useStableCallback(onLineCount)
  const reportOutline = useStableCallback(onOutline)
  const reportCursorLine = useStableCallback(onCursorLine)
  const requestNavigate = useStableCallback(onNavigate)

  // Stable identity ([] deps): the mount effect takes this as a dependency, so
  // a fresh callback per render would tear down and rebuild Monaco on every
  // message it produced.
  const showNotice = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    let viewer: CodeViewerHandle | null = null
    setState('loading')
    setNotice(null)
    // A fresh editor always opens on the page's own file.
    setDetour(null)
    // A new document starts with no outline until its language service answers.
    reportOutline([])
    reportCursorLine(1)
    ;(async () => {
      try {
        // Fetch the file's project context (root, alias paths, real path) in
        // parallel with the Monaco chunk, so it adds no latency. Used to mount
        // the model at its real path (relative imports resolve) and to drive
        // cross-file type acquisition. Only meaningful for TS/JS.
        const wantsTypes = /\.(mts|cts|tsx?|mjs|cjs|jsx?)$/i.test(fileName)
        const [{ createCodeViewer }, sourceContext] = await Promise.all([
          import('@/.client/monaco'),
          itemId && wantsTypes
            ? import('@/.client/cross-file-types')
                .then(async (m) => {
                  const context = await m.fetchSourceContext(itemId)
                  // Acquired libs are registered at project-relative paths, so
                  // a different upload holding the same path would silently
                  // reuse this one's source. Drop the previous project's libs
                  // here, before `createCodeViewer` applies the new alias map —
                  // that call restarts the TS worker, which re-parses whatever
                  // is still registered.
                  if (context) m.resetForRoot(context.rootId)
                  return context
                })
                .catch(() => null)
            : Promise.resolve(null),
        ])
        if (cancelled || !containerRef.current) return
        viewer = createCodeViewer(containerRef.current, text, fileName, {
          onNotice: showNotice,
          onLineCount: reportLineCount,
          onOutline: reportOutline,
          onCursorLine: reportCursorLine,
          onNavigate: requestNavigate,
          onDetour: setDetour,
          sourceContext,
        })
        viewerRef.current = viewer
        // Arriving from a definition jump: put its line on screen. Done here
        // rather than in the editor options because the target is a property of
        // *this navigation*, not of the document.
        if (revealLine) {
          const column = revealColumn ?? 1
          viewer.reveal({ line: revealLine, column, endColumn: column })
        }
        setState('ready')
      } catch (err) {
        console.error('[code-viewer] failed to load Monaco', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      viewerRef.current = null
      viewer?.dispose()
    }
  }, [
    text,
    fileName,
    itemId,
    revealLine,
    revealColumn,
    showNotice,
    reportLineCount,
    reportOutline,
    reportCursorLine,
    requestNavigate,
  ])

  if (state === 'error') {
    return (
      <pre className="h-full w-full overflow-auto whitespace-pre p-4 pb-14 font-mono text-sm">
        {text}
      </pre>
    )
  }

  return (
    // Column rather than an overlay: the banner claims its own height instead
    // of covering the first lines of the file it is announcing. Monaco runs
    // with `automaticLayout`, so it re-measures when the strip appears.
    <div className="relative flex h-full w-full flex-col">
      {detour && (
        <DetourBanner
          fileName={fileName}
          onBack={() => viewerRef.current?.goBack()}
          path={detour}
        />
      )}
      <div ref={containerRef} className="min-h-0 w-full flex-1 font-stashly!" />
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <p className="max-w-[90%] truncate rounded-md border border-input bg-card px-3 py-1.5 font-stashly text-xs text-muted-foreground shadow-lg">
            {notice}
          </p>
        </div>
      )}
      {state === 'loading' && (
        <StageSkeletonLoader variant="code" className="absolute inset-0" />
      )}
    </div>
  )
}

/**
 * Says out loud that the editor and the page have come apart: Go to Definition
 * landed in a file that lives only inside the language service — a `lib.d.ts`,
 * an `@types` package — so there was no page to navigate to and the source was
 * opened in place. Everything else on screen still describes `fileName`.
 */
function DetourBanner({
  path,
  fileName,
  onBack,
}: {
  /** The file on screen, e.g. `node_modules/@types/react/index.d.ts`. */
  path: string
  /** The file the page is actually about. */
  fileName: string
  onBack: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-input bg-sidebar px-3 py-2 font-stashly text-xs">
      <InfoFillIcon className="size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        Showing <span className="text-foreground">{path}</span> — a definition
        outside this file. The page still describes {fileName}.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 bg-card!"
        onClick={onBack}
      >
        <ArrowLeftFillIcon className="size-5" />
        Back to {fileName}
      </Button>
    </div>
  )
}
