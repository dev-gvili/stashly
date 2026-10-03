/**
 * PDF OCR — recovering text from a scan that has no text layer.
 *
 * Split out of the former `thumbnail-pipeline.ts` so it can actually be code-split. Both
 * call sites already reached it through `await import()`, but while it lived in
 * the pipeline module that bought nothing: the same files import the pipeline
 * statically for the stage helpers, so rolldown reported
 * `INEFFECTIVE_DYNAMIC_IMPORT` and kept the whole thing in the main chunk.
 * These three functions are the only members anyone wants lazily, so they are
 * the only ones that moved.
 *
 * The model wrappers below were already lazy and stay that way — a session that
 * never meets a scanned PDF must never pull one in, let alone download it.
 * Keeping them behind `await import()` *inside* this module is what makes them
 * separate chunks again once this one is itself split.
 *
 * React-free, like `@/utils/thumbnail-stages`: progress rides a DOM event so a
 * caller with no component tree can still report it.
 */
import { classifyDegradation, reportDegraded } from '@/utils/report-degraded'
import { compute } from '@/utils/compute-worker'

/**
 * Recover text from a PDF that has no text layer, by rendering its pages and
 * reading them with a vision model.
 *
 * Best-effort by construction. A browser without WebGPU, a model that won't
 * download, a page that won't rasterize — each leaves the document indexed by
 * name and tags exactly as before, which is what it would have been anyway.
 * The failure is reported rather than swallowed so a systematically broken
 * OCR path is visible instead of looking like "this PDF just has no text".
 *
 * Rasterization goes through the compute worker (off the main thread);
 * inference runs on the main thread through the shared AI queue, matching how
 * every other model in the app is scheduled.
 */
/**
 * OCR a PDF one page at a time, handing each page's text to `onPage` as soon
 * as it exists.
 *
 * The streaming counterpart to {@link ocrPdfFallback}, and the one the upload
 * path uses. Two problems it solves:
 *
 *   • **Durability.** OCR is ~30s per page, so a 15-page scan is minutes of
 *     work. Returning one string at the end meant a closed tab at page 12 threw
 *     away all twelve. Each page is now persisted as it completes.
 *   • **Memory.** Rendering every page up front holds N decoded bitmaps while
 *     the model works through them serially. Here exactly one page is alive:
 *     rendered, transcribed, handed over, then dropped before the next.
 *
 * `onPage` is awaited, so persistence back-pressures rendering rather than
 * queueing work behind a fast producer.
 *
 * @returns Total characters recovered across all pages.
 */
export async function streamOcrPdf(
  file: File,
  onPage: (page: { pageNum: number; text: string }) => Promise<void> | void,
  options: { maxPages?: number } = {},
): Promise<number> {
  try {
    console.info(
      `[ocr] "${file.name}" has no text layer — streaming OCR page by page.`
    )
    const { OCR_MAX_PAGES, OCR_MAX_PIXELS, ocrSinglePage } = await import(
      '@/workers/ocr.ai'
    )
    const maxPages = options.maxPages ?? OCR_MAX_PAGES

    // Keep the engine switch working here too. Streaming can run either single
    // engine; `compare` needs both over an identical page set, so it defers to
    // the batch path rather than doubling every page of a streamed run.
    const { getOcrEngine, getOcrMaxPixels } = await import('@/utils/ocr-engine')
    const engine = getOcrEngine()
    // Prefill dominates a page and scales with pixel count, so this is the
    // knob worth A/B-ing. Overridable at runtime to avoid a rebuild per trial.
    const maxPixels = getOcrMaxPixels(OCR_MAX_PIXELS)

    const transcribePage = async (
      blob: Blob,
      pageNum: number,
      totalPages: number,
    ) => {
      if (engine === 'florence') {
        const { ocrImageFlorence } = await import('@/workers/ocr-florence.ai')
        return { text: await ocrImageFlorence(blob) }
      }
      return ocrSinglePage({ blob, pageNum }, { totalPages })
    }

    if (engine === 'compare') {
      console.info(
        '[ocr] engine="compare" — using the batch path so both engines see identical pages.'
      )
      const text = await ocrPdfFallback(file)
      if (text) await onPage({ pageNum: 1, text })
      return text?.length ?? 0
    }

    let totalChars = 0
    let pageCount = Infinity

    for (let pageNum = 1; pageNum <= Math.min(maxPages, pageCount); pageNum++) {
      const rendered = await compute<'pdfPageAt'>({
        kind: 'pdfPageAt',
        file,
        pageNum,
        maxPixels,
      })
      if (rendered.kind !== 'pdfPageAt' || !rendered.result) {
        console.error(`[ocr] could not render page ${pageNum} of "${file.name}"`)
        break
      }

      // Learned on the first render, which lets the loop run without a
      // separate metadata pass.
      pageCount = rendered.result.pageCount

      try {
        const { text } = await transcribePage(
          rendered.result.blob,
          pageNum,
          Math.min(maxPages, pageCount),
        )
        if (text) {
          totalChars += text.length
          // Awaited so a slow save throttles the next render rather than
          // letting rendered pages pile up behind it.
          await onPage({ pageNum, text })
        }
      } catch (err) {
        // One unreadable page must not discard the pages already saved —
        // which, unlike before, are already durable on the server.
        console.error(`[ocr] page ${pageNum} failed`, err)
      }

      reportOcrProgress(file.name, {
        page: pageNum,
        totalPages: Math.min(maxPages, pageCount),
        charsSoFar: totalChars,
      })
    }

    reportOcrProgress(file.name, null)
    console.info(
      `[ocr] streaming done — ${totalChars} chars from "${file.name}"`
    )
    return totalChars
  } catch (err) {
    console.error('[ocr] streaming pdf fallback failed', file.name, err)
    reportDegraded('ocr', classifyDegradation(err))
    reportOcrProgress(file.name, null)
    return 0
  }
}

export async function ocrPdfFallback(file: File): Promise<string | null> {
  try {
    console.info(
      `[ocr] "${file.name}" has no text layer — falling back to OCR.`
    )
    const { OCR_MAX_PAGES, OCR_MAX_PIXELS } = await import('@/workers/ocr.ai')

    // Explicit type argument: `TKind` can't be inferred from an object literal
    // that carries kind-specific optional fields, so it widens to the whole
    // union and `Omit` collapses to the keys every variant shares.
    const rendered = await compute<'pdfPages'>({
      kind: 'pdfPages',
      file,
      maxPages: OCR_MAX_PAGES,
      maxPixels: OCR_MAX_PIXELS,
    })
    if (rendered.kind !== 'pdfPages' || !rendered.result) {
      console.error(
        `[ocr] rasterizing failed for "${file.name}":`,
        rendered.kind === 'error' ? rendered.message : 'no result'
      )
      return null
    }
    const { pages } = rendered.result
    if (pages.length === 0) {
      console.error(`[ocr] no pages rendered for "${file.name}"`)
      return null
    }
    console.info(`[ocr] rasterized ${pages.length} page(s) of "${file.name}"`)

    // Which implementation runs is a developer switch (see `ocr-engine.ts`),
    // defaulting to GLM-OCR so a normal upload keeps its existing cost.
    const { getOcrEngine } = await import('@/utils/ocr-engine')
    const engine = getOcrEngine()
    const onPage = (progress: {
      page: number
      totalPages: number
      charsSoFar: number
    }) => reportOcrProgress(file.name, progress)

    // Every import here is lazy: a session that never meets a scanned PDF
    // must never pull in a model wrapper, and never trigger its download.
    let text = ''

    if (engine === 'florence') {
      const { ocrPagesFlorence } = await import('@/workers/ocr-florence.ai')
      text = (await ocrPagesFlorence(pages, { onPage })).text
    } else if (engine === 'compare') {
      // Both, over the identical rendered pages, sequentially — they share one
      // WebGPU context, so overlapping them would measure contention rather
      // than the models. GLM's output is what gets indexed, keeping the
      // comparison observational: switching to 'compare' changes what is
      // logged, not what is stored.
      console.info(
        `[ocr] engine="compare" — running both pipelines over ${pages.length} page(s) of "${file.name}". ` +
          `This downloads ~960MB on a cold cache and takes roughly twice as long.`,
      )

      const glmStart = performance.now()
      const { ocrPages } = await import('@/workers/ocr.ai')
      const glm = await ocrPages(pages, { onPage })
      const glmMs = Math.round(performance.now() - glmStart)

      const florenceStart = performance.now()
      const { ocrPagesFlorence } = await import('@/workers/ocr-florence.ai')
      const florence = await ocrPagesFlorence(pages, { onPage })
      const florenceMs = Math.round(performance.now() - florenceStart)

      const { printUploadComparison } = await import('@/utils/ocr-compare')
      printUploadComparison(file.name, pages.length, [
        { label: 'GLM-OCR', ms: glmMs, text: glm.text },
        { label: 'Florence-2', ms: florenceMs, text: florence.text },
      ])

      text = glm.text
    } else {
      const { ocrPages } = await import('@/workers/ocr.ai')
      text = (await ocrPages(pages, { onPage })).text
    }

    reportOcrProgress(file.name, null)
    return text || null
  } catch (err) {
    console.error('[ocr] pdf fallback failed', file.name, err)
    reportDegraded('ocr', classifyDegradation(err))
    reportOcrProgress(file.name, null)
    return null
  }
}

/**
 * Broadcasts OCR progress on a DOM event.
 *
 * A custom event rather than an imported store because this module is
 * deliberately React-free (see the file header) and is also reachable from
 * contexts that have no component tree. Anything that wants to show progress
 * subscribes; nothing has to.
 */
function reportOcrProgress(
  fileName: string,
  progress: { page: number; totalPages: number; charsSoFar: number } | null,
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('stashly:ocr-progress', {
      detail: { fileName, progress },
    }),
  )
}
