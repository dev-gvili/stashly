import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Loads a PDF document client-side via pdf.js (which never runs during SSR) and
 * measures page 1 to expose a base page size for layout. `@/utils/pdf` is
 * imported lazily so pdf.js stays out of the SSR/initial bundle. The load is
 * cancellable: changing `src` or unmounting destroys the pdf.js loading task,
 * which also aborts in-flight network requests — note teardown lives on the
 * loading task in pdf.js v6, not on the document proxy.
 *
 * @param src - URL of the PDF to load (typically an S3 presigned URL). An empty
 *   string short-circuits to the `'No file URL'` error.
 *
 * @example
 * // Drive a paged PDF viewer
 * const { doc, baseSize, error } = usePdfDocument(fileUrl)
 * if (error) return <ErrorState message={error} />
 * if (!doc || !baseSize) return <Spinner />
 * return Array.from({ length: doc.numPages }, (_, i) => (
 *   <PdfPage key={i} doc={doc} pageNumber={i + 1} baseSize={baseSize} />
 * ))
 *
 * @example
 * // Use `baseSize` to compute a fit-to-width zoom scale
 * const { baseSize } = usePdfDocument(src)
 * const scale = baseSize ? containerWidth / baseSize.width : 1
 */
export function usePdfDocument(src: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [baseSize, setBaseSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // pdfjs v6: teardown lives on the loading task, not the document proxy.
    // Destroying the task also aborts in-flight network requests.
    let task: { destroy: () => Promise<void> } | null = null
    setDoc(null)
    setBaseSize(null)
    setError(null)
    if (!src) {
      setError('No file URL')
      return
    }
    ;(async () => {
      try {
        const { loadPdfDocument } = await import('@/utils/pdf')
        const t = loadPdfDocument(src)
        if (cancelled) {
          t.destroy().catch(() => {})
          return
        }
        task = t
        const d = await t.promise
        if (cancelled) return
        const page = await d.getPage(1)
        const vp = page.getViewport({ scale: 1 })
        page.cleanup()
        if (cancelled) return
        setBaseSize({ width: vp.width, height: vp.height })
        setDoc(d)
      } catch (err) {
        if (cancelled) return // rejection from task.destroy() on unmount
        console.error('[pdf-stage] failed to load document', err)
        setError('Could not load this PDF')
      }
    })()
    return () => {
      cancelled = true
      task?.destroy().catch(() => {})
    }
  }, [src])

  return { doc, baseSize, error }
}
