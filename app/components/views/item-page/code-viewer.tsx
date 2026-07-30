import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { Ref } from 'react'
import { LoaderIcon } from '@/components/icons'
import { useStableCallback } from '@/hooks/useStableCallback'
import type { CodeViewerHandle } from '@/.client/monaco'
import type { OutlineSymbol } from '@/.client/monaco-outline'

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
  onLineCount,
  onOutline,
  onCursorLine,
  ref,
}: {
  text: string
  fileName: string
  itemId?: string
  /**
   * Receives the editor's live line count — at mount, and again after Format
   * Document / Revert Formatting rewrite the buffer.
   */
  onLineCount?: (count: number) => void
  /** Receives the document's symbol tree, rebuilt as the language service answers. */
  onOutline?: (symbols: OutlineSymbol[]) => void
  /** Receives the cursor's line, so an outline can mark the symbol it sits in. */
  onCursorLine?: (line: number) => void
  /** Exposes `reveal`, so the outline rail can jump the editor to a symbol. */
  ref?: Ref<CodeViewerRef>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CodeViewerHandle | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
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

  // Stable identity ([] deps): the mount effect takes this as a dependency, so
  // a fresh callback per render would tear down and rebuild Monaco on every
  // message it produced.
  const showNotice = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    let viewer: CodeViewerHandle | null = null
    setState('loading')
    setNotice(null)
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
                .then((m) => m.fetchSourceContext(itemId))
                .catch(() => null)
            : Promise.resolve(null),
        ])
        if (cancelled || !containerRef.current) return
        viewer = createCodeViewer(containerRef.current, text, fileName, {
          onNotice: showNotice,
          onLineCount: reportLineCount,
          onOutline: reportOutline,
          onCursorLine: reportCursorLine,
          sourceContext,
        })
        viewerRef.current = viewer
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
    showNotice,
    reportLineCount,
    reportOutline,
    reportCursorLine,
  ])

  if (state === 'error') {
    return (
      <pre className="h-full w-full overflow-auto whitespace-pre p-4 pb-14 font-mono text-sm">
        {text}
      </pre>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full font-mono!" />
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <p className="max-w-[90%] truncate rounded-md border border-input bg-card px-3 py-1.5 font-stashly text-xs text-muted-foreground shadow-lg">
            {notice}
          </p>
        </div>
      )}
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <LoaderIcon className="size-6 animate-spin" />
        </div>
      )}
    </div>
  )
}
