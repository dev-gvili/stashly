import { useEffect, useState } from 'react'
import {
  extractMarkdownHeadings,
  loadMarkdownText,
  type MarkdownHeading,
} from '@/utils/markdown'

/**
 * Fetches a Markdown document client-side and extracts its heading outline.
 * Loads the raw text via `loadMarkdownText(src)`, then derives the heading list
 * with `extractMarkdownHeadings` for a table-of-contents sidebar. The fetch is
 * cancellable: changing `src` (or unmounting) aborts the in-flight load so a
 * stale response never overwrites newer state. While loading, `text`/`headings`
 * default to empty and `ready` is `false`.
 *
 * @param src - URL of the Markdown file to fetch (typically an S3 presigned URL).
 *   An empty string short-circuits to the `'No file URL'` error.
 *
 * @example
 * // Render a document with a heading-driven outline
 * const { text, headings, ready, error } = useMarkdownDocument(fileUrl)
 * if (error) return <ErrorState message={error} />
 * if (!ready) return <Spinner />
 * return (
 *   <>
 *     <Outline headings={headings} />
 *     <MarkdownRenderer source={text} />
 *   </>
 * )
 *
 * @example
 * // `headings` powers a scroll-spy table of contents
 * const { headings } = useMarkdownDocument(src)
 * <nav>{headings.map((h) => <a key={h.id} href={`#${h.id}`} data-depth={h.depth}>{h.text}</a>)}</nav>
 */
export function useMarkdownDocument(src: string) {
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
