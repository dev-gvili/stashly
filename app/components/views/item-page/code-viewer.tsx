import { useEffect, useRef, useState } from 'react'
import { LoaderIcon } from '@/components/icons'

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
}: {
  text: string
  fileName: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let viewer: { dispose: () => void } | null = null
    setState('loading')
    ;(async () => {
      try {
        const { createCodeViewer } = await import('@/.client/monaco')
        if (cancelled || !containerRef.current) return
        viewer = createCodeViewer(containerRef.current, text, fileName)
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
  }, [text, fileName])

  if (state === 'error') {
    return (
      <pre className="h-full w-full overflow-auto whitespace-pre p-4 pb-14 font-mono text-sm">
        {text}
      </pre>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <LoaderIcon className="size-6 animate-spin" />
        </div>
      )}
    </div>
  )
}
