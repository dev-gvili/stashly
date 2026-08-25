import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * One ```mermaid fence in a Markdown document, drawn as a diagram.
 *
 * The block starts as `fallback` — the ordinary tokenized code block the reader
 * would otherwise show — and swaps to the SVG once mermaid has parsed and laid
 * the graph out. That ordering is deliberate rather than a spinner: the source
 * *is* the content, so it stays readable while the (lazily downloaded) graph
 * library arrives, during SSR, and permanently if the diagram doesn't parse.
 *
 * Mermaid is imported only from inside the effect below, so a document with no
 * diagrams in it never pays for the library. See `@/.client/mermaid`.
 */
export function MermaidBlock({
  code,
  fallback,
}: {
  code: string
  fallback: ReactNode
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let live = true

    const draw = () => {
      void import('@/.client/mermaid')
        .then((m) => m.renderMermaid(code, host))
        .then((out) => {
          if (!live) return
          setSvg(out)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!live) return
          setSvg(null)
          setError(e instanceof Error ? e.message : 'Could not render diagram')
        })
    }
    draw()

    // Mermaid bakes its palette into the SVG it emits — there are no CSS
    // variables left in the output to re-resolve — so a theme flip has to
    // redraw the diagram rather than restyle it. Same signals the code blocks
    // listen to: the `data-theme` attribute, and the OS query behind 'system'.
    const observer = new MutationObserver(draw)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', draw)
    return () => {
      live = false
      observer.disconnect()
      media.removeEventListener('change', draw)
    }
  }, [code])

  return (
    // The ref is on the outer element so the palette is resolved against a node
    // that is already inside `.markdown-stage` — that is where `--md-ink-hue`
    // is scoped, and reading it from `:root` would silently miss it.
    <div ref={hostRef} className="my-4">
      {svg ? (
        <figure
          // Wide graphs scroll inside the block instead of stretching the
          // reader's measure — the article itself must never scroll sideways.
          className="overflow-x-auto rounded-md border border-input bg-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <>
          {fallback}
          {/* Never silently swallow a broken diagram: the source is shown
              above, and this says why it is still source. */}
          {error && (
            <p className="mt-1 text-xs text-muted-foreground">
              Diagram not rendered — {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
