import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderIcon } from '@/components/icons'

/** How long a formatting result stays on screen. */
const NOTICE_MS = 4000

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
}: {
  text: string
  fileName: string
  itemId?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    let viewer: { dispose: () => void } | null = null
    setState('loading')
    setNotice(null)
    ;(async () => {
      try {
        const { createCodeViewer } = await import('@/.client/monaco')
        if (cancelled || !containerRef.current) return
        viewer = createCodeViewer(containerRef.current, text, fileName, {
          onNotice: showNotice,
          itemId,
        })
        setState('ready')
      } catch (err) {
        console.error('[code-viewer] failed to load Monaco', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      viewer?.dispose()
    }
  }, [text, fileName, itemId, showNotice])

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
