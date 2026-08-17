/**
 * Which OCR implementation the upload pipeline uses.
 *
 * Two implementations exist side by side and the choice between them is still
 * open — GLM-OCR is multilingual-ish and 623MB, Florence-2 is English-only,
 * ~340MB, with a decoder a fifth the size. Rather than settle it by argument,
 * this makes the engine switchable so the same document can be run through
 * either (or both) and the console can show the difference.
 *
 * The preference lives in `localStorage` rather than a setting or an env var:
 * it is a developer switch, it needs to survive a reload mid-experiment, and
 * it must be changeable without a rebuild.
 *
 * @example
 * // In the browser console, then upload a PDF:
 * localStorage.setItem('stashly:ocr-engine', 'compare')
 *
 * @example
 * // Back to the default:
 * localStorage.removeItem('stashly:ocr-engine')
 */

export type OcrEngine =
  /** GLM-OCR 0.9B, ~623MB. The default. */
  | 'glm'
  /** Florence-2 base-ft, ~340MB, English-only. */
  | 'florence'
  /** Both, sequentially, logging a comparison. Costs ~960MB and double the time. */
  | 'compare'

export const OCR_ENGINE_KEY = 'stashly:ocr-engine'

const VALID: ReadonlySet<string> = new Set(['glm', 'florence', 'compare'])

/**
 * The engine to use for the next OCR run.
 *
 * Defaults to `'glm'` so a normal upload keeps its existing cost. Comparison
 * mode is opt-in precisely because it doubles both the download and the
 * runtime, and nobody should discover that by accident.
 */
export function getOcrEngine(): OcrEngine {
  if (typeof window === 'undefined') return 'glm'
  try {
    const stored = window.localStorage.getItem(OCR_ENGINE_KEY)
    return stored && VALID.has(stored) ? (stored as OcrEngine) : 'glm'
  } catch {
    // Private mode / blocked storage — fall back rather than break uploads.
    return 'glm'
  }
}

export const OCR_MAX_PIXELS_KEY = 'stashly:ocr-max-pixels'

/**
 * Pixel budget for OCR page renders, overridable at runtime.
 *
 * Measurement made this the most important knob in the pipeline: ~70% of a
 * page's ~28s is spent before the first token — CPU image preprocessing plus
 * the vision encoder — and both scale with pixel count. Decoding, the thing
 * two earlier tuning passes targeted, is only ~25%.
 *
 * The default matches transformers.js' `smart_resize` ceiling
 * (`14*14*4*1280` ≈ 1.0M px ≈ 1280 visual tokens). Halving it should roughly
 * halve prefill; the open question is what it costs in recognition of small
 * text, which is a judgement only real documents can settle.
 *
 * @example
 * // Halve the budget, then re-upload and compare the `encode` figure:
 * localStorage.setItem('stashly:ocr-max-pixels', String(14 * 14 * 4 * 640))
 */
export function getOcrMaxPixels(fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(OCR_MAX_PIXELS_KEY)
    if (!raw) return fallback
    const parsed = Number(raw)
    // A nonsense override must not silently render a 1-pixel page.
    if (!Number.isFinite(parsed) || parsed < 50_000) return fallback
    return Math.trunc(parsed)
  } catch {
    return fallback
  }
}

/** Set the engine and report what will happen on the next PDF upload. */
export function setOcrEngine(engine: OcrEngine): void {
  if (typeof window === 'undefined') return
  if (!VALID.has(engine)) {
    console.error(`[ocr] unknown engine "${engine}" — use glm | florence | compare`)
    return
  }
  try {
    window.localStorage.setItem(OCR_ENGINE_KEY, engine)
    console.info(
      `[ocr] engine set to "${engine}". Upload a PDF with no text layer to see it run.`,
    )
  } catch (err) {
    console.error('[ocr] could not persist engine preference', err)
  }
}
