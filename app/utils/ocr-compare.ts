/**
 * Side-by-side benchmark of the two OCR implementations.
 *
 * Exists because the choice between them has so far been argued from model
 * cards — parameter counts, published language lists, benchmark scores — and
 * every time it was actually measured, the measurement contradicted the
 * argument. Qwen3-VL was chosen for Hebrew and lost on speed; a dtype change
 * that "should" have given an order of magnitude gave nothing. This runs both
 * pipelines over the same rendered pages of a real document and prints the
 * numbers.
 *
 * Neither implementation is modified or imported by the other. This module is
 * a pure consumer of both:
 *
 *   • `app/workers/ocr.ai.ts`          — GLM-OCR 0.9B, ~623MB, multilingual-ish
 *   • `app/workers/ocr-florence.ai.ts` — Florence-2 base-ft, ~340MB, English
 *
 * Nothing in the product calls this; it is a developer tool, invoked by hand.
 *
 * @example
 * // In the browser console, with a PDF selected from an <input type="file">:
 * const { compareOcrPipelines } = await import('/app/utils/ocr-compare.ts')
 * await compareOcrPipelines(file)
 *
 * @example
 * // Or, after calling `exposeOcrCompare()` once:
 * await window.__ocrCompare(file, { maxPages: 3 })
 */
import { renderPdfPagesToBlobs } from '@/utils/pdf'

export interface OcrRunResult {
  label: string
  modelId: string
  /** Whole-run wall clock, including model load on a cold cache. */
  totalMs: number
  /** Model load only — dominated by download on the first run. */
  loadMs: number
  /** Per-page wall clock, in page order. */
  pageMs: number[]
  text: string
  chars: number
  pagesRead: number
  error?: string
}

export interface OcrComparison {
  fileName: string
  pageCount: number
  pagesRendered: number
  renderMs: number
  runs: OcrRunResult[]
}

/**
 * Run one pipeline and time it.
 *
 * `loadMs` is inferred from the gap before the first page completes rather
 * than instrumented inside each module — that keeps this file a pure consumer
 * and avoids touching either implementation to measure it.
 */
async function timeRun(
  label: string,
  modelId: string,
  pages: { blob: Blob; pageNum: number }[],
  run: (
    pages: { blob: Blob; pageNum: number }[],
    onPage: () => void,
  ) => Promise<{ text: string; pagesRead: number }>,
): Promise<OcrRunResult> {
  const startedAt = performance.now()
  const pageMs: number[] = []
  let lastMark = startedAt
  let firstPageAt: number | null = null

  try {
    const { text, pagesRead } = await run(pages, () => {
      const now = performance.now()
      if (firstPageAt === null) firstPageAt = now
      pageMs.push(Math.round(now - lastMark))
      lastMark = now
    })

    const totalMs = Math.round(performance.now() - startedAt)
    // The first page's elapsed time includes the model load; later pages don't.
    // Subtracting the median of the rest approximates the load cost.
    const rest = pageMs.slice(1).sort((a, b) => a - b)
    const medianPage = rest.length ? rest[Math.floor(rest.length / 2)] : 0
    const loadMs = pageMs.length ? Math.max(0, pageMs[0] - medianPage) : 0

    return {
      label,
      modelId,
      totalMs,
      loadMs,
      pageMs,
      text,
      chars: text.length,
      pagesRead,
    }
  } catch (err) {
    return {
      label,
      modelId,
      totalMs: Math.round(performance.now() - startedAt),
      loadMs: 0,
      pageMs,
      text: '',
      chars: 0,
      pagesRead: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Proportion of characters that are Hebrew, for the RTL question. */
function hebrewRatio(text: string): number {
  if (!text) return 0
  const hebrew = text.match(/[֐-׿]/g)?.length ?? 0
  const letters = text.match(/[\p{L}]/gu)?.length ?? 0
  return letters === 0 ? 0 : hebrew / letters
}

/**
 * Render a PDF once, then run both OCR pipelines over the identical pages.
 *
 * Rendering happens a single time on purpose: giving each model different
 * pixels would make the comparison meaningless. Both therefore see the same
 * resolution, which is the one imposed by GLM-OCR's processor budget — a
 * deliberate bias worth naming, since Florence-2 might prefer different input.
 *
 * Runs sequentially, never concurrently: they share one WebGPU context through
 * `ai-queue`, and overlapping them would measure contention rather than the
 * models.
 */
export async function compareOcrPipelines(
  file: File,
  options: { maxPages?: number } = {},
): Promise<OcrComparison> {
  const { maxPages = 3 } = options

  console.info(
    `[ocr:compare] rendering up to ${maxPages} page(s) of "${file.name}"…`,
  )
  const renderStart = performance.now()

  const { OCR_MAX_PIXELS } = await import('@/workers/ocr.ai')
  const rendered = await renderPdfPagesToBlobs(file, {
    maxPages,
    maxPixels: OCR_MAX_PIXELS,
  })
  const renderMs = Math.round(performance.now() - renderStart)

  if (!rendered || rendered.pages.length === 0) {
    throw new Error(`[ocr:compare] could not render any page of "${file.name}"`)
  }

  const { pages, pageCount } = rendered
  console.info(
    `[ocr:compare] rendered ${pages.length}/${pageCount} page(s) in ${renderMs}ms`,
  )

  const runs: OcrRunResult[] = []

  const { ocrPages } = await import('@/workers/ocr.ai')
  runs.push(
    await timeRun(
      'GLM-OCR',
      'onnx-community/GLM-OCR-ONNX',
      pages,
      (p, onPage) => ocrPages(p, { maxPages, onPage }),
    ),
  )

  const { ocrPagesFlorence } = await import('@/workers/ocr-florence.ai')
  runs.push(
    await timeRun(
      'Florence-2',
      'onnx-community/Florence-2-base-ft',
      pages,
      (p, onPage) => ocrPagesFlorence(p, { maxPages, onPage }),
    ),
  )

  const comparison: OcrComparison = {
    fileName: file.name,
    pageCount,
    pagesRendered: pages.length,
    renderMs,
    runs,
  }

  printComparison(comparison)
  return comparison
}

/** Print the result as a console table plus a text sample from each run. */
export function printComparison(result: OcrComparison): void {
  console.info(
    `\n[ocr:compare] "${result.fileName}" — ${result.pagesRendered}/${result.pageCount} pages`,
  )

  console.table(
    result.runs.map((run) => ({
      model: run.label,
      'total (s)': (run.totalMs / 1000).toFixed(1),
      'load (s)': (run.loadMs / 1000).toFixed(1),
      'per page (s)': run.pageMs.length
        ? (
            run.pageMs.reduce((a, b) => a + b, 0) /
            run.pageMs.length /
            1000
          ).toFixed(1)
        : '—',
      chars: run.chars,
      'chars/page': run.pagesRead ? Math.round(run.chars / run.pagesRead) : 0,
      hebrew: `${Math.round(hebrewRatio(run.text) * 100)}%`,
      error: run.error ?? '',
    })),
  )

  // The numbers say which is faster; only the text says which is usable.
  for (const run of result.runs) {
    console.info(
      `\n[ocr:compare] ${run.label} — first 400 chars:\n${run.text.slice(0, 400) || '(nothing)'}`,
    )
  }
}

/**
 * Print a comparison for a run driven by the upload pipeline.
 *
 * The full {@link compareOcrPipelines} harness renders its own pages; the
 * upload path has already rendered them and run both engines, so it only needs
 * the reporting half.
 */
export function printUploadComparison(
  fileName: string,
  pageCount: number,
  runs: { label: string; ms: number; text: string }[],
): void {
  console.info(`\n[ocr:compare] "${fileName}" — ${pageCount} page(s)`)
  console.table(
    runs.map((run) => ({
      model: run.label,
      'total (s)': (run.ms / 1000).toFixed(1),
      'per page (s)': (run.ms / 1000 / Math.max(pageCount, 1)).toFixed(1),
      chars: run.text.length,
      'chars/page': Math.round(run.text.length / Math.max(pageCount, 1)),
      hebrew: `${Math.round(hebrewRatio(run.text) * 100)}%`,
    })),
  )
  for (const run of runs) {
    console.info(
      `\n[ocr:compare] ${run.label} — first 400 chars:\n${run.text.slice(0, 400) || '(nothing)'}`,
    )
  }
}

/**
 * Attach the harness to `window` for console use.
 *
 * Deliberately opt-in rather than automatic: nothing in the product should
 * ship a global that pulls ~1GB of model weights if someone taps it.
 */
export function exposeOcrCompare(): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as Record<string, unknown>).__ocrCompare =
    compareOcrPipelines
  console.info(
    '[ocr:compare] ready — call window.__ocrCompare(file, { maxPages: 3 })',
  )
}
