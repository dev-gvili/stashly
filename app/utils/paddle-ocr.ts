/**
 * The model-free half of PaddleOCR (PP-OCRv6): image preparation before the
 * two ONNX models, and the post-processing after them.
 *
 * PP-OCR reads a page in two steps. A detector (DB, "differentiable
 * binarization") marks every pixel with the probability that it is text; this
 * module turns that map into line boxes. A recognizer then reads each cropped
 * line and emits one character distribution per horizontal step, which CTC
 * decoding collapses into text. Neither step needs a GPU here, and none of it
 * touches ONNX Runtime or the DOM, so it is unit-tested in Node.
 *
 * Constants follow the models' own `inference.yml`, ported from the browser
 * implementation in the `runemic-ai/ocr-arena` Space. The detector thresholds
 * are v6's (0.2 / 0.45 / 1.4), not the v5 values that Space hard-codes.
 */

/** Interleaved RGBA pixels, the shape `ImageData` has. */
export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** A text line's bounding box, in page pixels. */
export interface TextBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A recognized line: its box, its text and the recognizer's confidence. */
export interface RecognizedLine extends TextBox {
  text: string
  confidence: number
}

/** `DBPostProcess` in `PP-OCRv6_small_det_onnx/inference.yml`. */
export const DET_THRESHOLDS = {
  /** A pixel counts as text above this probability. */
  thresh: 0.2,
  /** A region is kept when its mean probability is above this. */
  boxThresh: 0.45,
  /** How far a region grows back out, since DB predicts shrunken text kernels. */
  unclipRatio: 1.4,
} as const

/** The detector's long-side limit. Its input sides must be multiples of 32. */
export const DET_LIMIT_SIDE = 960

/** `RecResizeImg.image_shape` height in the recognizer's `inference.yml`. */
export const REC_HEIGHT = 48

/** Upper bound on a line's resized width, from the recognizer's dynamic shapes. */
export const REC_MAX_WIDTH = 3200

/** Lines read below this confidence are dropped as noise (specks, rules, stamps). */
export const MIN_LINE_CONFIDENCE = 0.3

const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

/**
 * The character list from a recognizer's `inference.yml`
 * (`PostProcess.character_dict`).
 *
 * Index `i` of the result is model class `i + 1`; class 0 is the CTC blank.
 *
 * @example
 * parseCharacterDict("PostProcess:\n  character_dict:\n  - a\n  - ''''\n") // ['a', "'"]
 */
export function parseCharacterDict(yaml: string): string[] {
  const lines = yaml.split(/\r?\n/)
  const start = lines.findIndex((line) => /^\s*character_dict:\s*$/.test(line))
  if (start < 0) throw new Error('No character_dict in inference.yml')
  const indent = lines[start + 1]?.match(/^(\s*)- /)?.[1] ?? '  '
  const characters: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith(`${indent}- `)) break
    const value = line.slice(indent.length + 2)
    if (value.startsWith("'")) {
      characters.push(value.slice(1, value.lastIndexOf("'")).replace(/''/g, "'"))
    } else if (value.startsWith('"')) {
      characters.push(JSON.parse(value) as string)
    } else {
      characters.push(value)
    }
  }
  return characters
}

/** Bilinear resize. */
export function resizeRgba(image: RgbaImage, width: number, height: number): RgbaImage {
  const out = new Uint8ClampedArray(width * height * 4)
  const scaleX = image.width / width
  const scaleY = image.height / height
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * scaleY - 0.5)
    const y0 = Math.floor(fy)
    const y1 = Math.min(image.height - 1, y0 + 1)
    const dy = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * scaleX - 0.5)
      const x0 = Math.floor(fx)
      const x1 = Math.min(image.width - 1, x0 + 1)
      const dx = fx - x0
      const o = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const a = image.data[(y0 * image.width + x0) * 4 + c]
        const b = image.data[(y0 * image.width + x1) * 4 + c]
        const d = image.data[(y1 * image.width + x0) * 4 + c]
        const e = image.data[(y1 * image.width + x1) * 4 + c]
        out[o + c] = (a * (1 - dx) + b * dx) * (1 - dy) + (d * (1 - dx) + e * dx) * dy
      }
      out[o + 3] = 255
    }
  }
  return { data: out, width, height }
}

/** The pixels inside `box`, clamped to the image. */
export function cropRgba(image: RgbaImage, box: TextBox): RgbaImage {
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(image.width, Math.ceil(box.x1))
  const y1 = Math.min(image.height, Math.ceil(box.y1))
  const width = Math.max(1, x1 - x0)
  const height = Math.max(1, y1 - y0)
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = ((y0 + y) * image.width + x0) * 4
    out.set(image.data.subarray(from, from + width * 4), y * width * 4)
  }
  return { data: out, width, height }
}

/**
 * RGBA to the CHW float layout both models take, in BGR channel order (they
 * were trained on OpenCV images).
 */
function toChwBgr(
  image: RgbaImage,
  normalize: (value: number, channel: number) => number,
): Float32Array {
  const n = image.width * image.height
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    out[i] = normalize(image.data[i * 4 + 2], 0)
    out[n + i] = normalize(image.data[i * 4 + 1], 1)
    out[2 * n + i] = normalize(image.data[i * 4], 2)
  }
  return out
}

/**
 * The detector's input: the page scaled so its long side is at most
 * {@link DET_LIMIT_SIDE}, sides rounded to multiples of 32, ImageNet-normalized.
 */
export function detectionInput(page: RgbaImage): {
  data: Float32Array
  width: number
  height: number
} {
  const ratio = Math.min(1, DET_LIMIT_SIDE / Math.max(page.width, page.height))
  const width = Math.max(32, Math.round((page.width * ratio) / 32) * 32)
  const height = Math.max(32, Math.round((page.height * ratio) / 32) * 32)
  const small = resizeRgba(page, width, height)
  const data = toChwBgr(small, (v, c) => (v / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c])
  return { data, width, height }
}

/**
 * Line boxes from the detector's probability map.
 *
 * Each 4-connected region above `thresh` becomes a box, kept when its mean
 * probability clears `boxThresh`, then grown by DB's unclip distance
 * (`area × ratio / perimeter`) and scaled back to page pixels.
 *
 * @param prob - `width × height` probabilities, row-major.
 * @param scaleX - Page pixels per map pixel, horizontally.
 * @param scaleY - Page pixels per map pixel, vertically.
 */
export function extractTextBoxes(
  prob: ArrayLike<number>,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  thresholds: { thresh: number; boxThresh: number; unclipRatio: number } = DET_THRESHOLDS,
): TextBox[] {
  const { thresh, boxThresh, unclipRatio } = thresholds
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const boxes: TextBox[] = []
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || prob[start] <= thresh) continue
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let sum = 0
    let count = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length > 0) {
      const p = stack.pop()!
      const px = p % width
      const py = (p - px) / width
      sum += prob[p]
      count++
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      const neighbours = [
        px > 0 ? p - 1 : -1,
        px < width - 1 ? p + 1 : -1,
        p - width,
        p + width,
      ]
      for (const q of neighbours) {
        if (q < 0 || q >= width * height || seen[q] || prob[q] <= thresh) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    if (count < 4 || Math.min(boxWidth, boxHeight) < 3 || sum / count < boxThresh) continue
    const grow = (boxWidth * boxHeight * unclipRatio) / (2 * (boxWidth + boxHeight))
    boxes.push({
      x0: Math.max(0, (minX - grow) * scaleX),
      y0: Math.max(0, (minY - grow) * scaleY),
      x1: (maxX + 1 + grow) * scaleX,
      y1: (maxY + 1 + grow) * scaleY,
    })
  }
  return boxes
}

/**
 * Lines per recognizer run; its exported dynamic shapes allow batches of 8.
 *
 * Measured 31 Oct 2026 on a real 12-page scan (443 lines, NVIDIA Turing, warm,
 * two runs each): batches of 1 took 23.4 / 23.5 s with 12.9 / 12.8 s in the
 * recognizer; batches of 8 took 17.8 / 17.5 s with 7.0 / 7.1 s. 420 of 443
 * lines read identically; the rest differ in spacing or single characters,
 * about as often better as worse.
 */
export const REC_BATCH_SIZE = 8

/**
 * The recognizer's input for a batch of cropped lines.
 *
 * Each line is resized to height {@link REC_HEIGHT} keeping its aspect ratio,
 * scaled to [-1, 1], and zero-padded on the right to the batch's widest line
 * (capped at {@link REC_MAX_WIDTH}), as PaddleOCR pads. Sort lines by aspect
 * ratio before batching so little of each batch is padding.
 *
 * @returns `batch × 3 × height × width` floats, row-major.
 */
export function recognitionBatchInput(lines: readonly RgbaImage[]): {
  data: Float32Array
  width: number
  height: number
  batch: number
} {
  const widths = lines.map((l) => Math.max(1, Math.ceil((l.width * REC_HEIGHT) / l.height)))
  const width = Math.min(REC_MAX_WIDTH, Math.max(16, ...widths))
  const plane = REC_HEIGHT * width
  const data = new Float32Array(lines.length * 3 * plane)
  lines.forEach((line, b) => {
    const w = Math.min(width, widths[b])
    const chw = toChwBgr(resizeRgba(line, w, REC_HEIGHT), (v) => (v / 255 - 0.5) / 0.5)
    const linePlane = REC_HEIGHT * w
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < REC_HEIGHT; y++) {
        const from = c * linePlane + y * w
        data.set(chw.subarray(from, from + w), b * 3 * plane + c * plane + y * width)
      }
    }
  })
  return { data, width, height: REC_HEIGHT, batch: lines.length }
}

/**
 * Greedy CTC decoding of the recognizer's output.
 *
 * Takes the most likely class at each step, drops blanks (class 0) and
 * collapses repeats. A class past the dictionary is the space the model
 * appends after it. Confidence is the mean probability of the kept classes.
 *
 * @param probs - `steps × classes` probabilities, row-major.
 * @param dictionary - From {@link parseCharacterDict}.
 */
export function ctcGreedyDecode(
  probs: ArrayLike<number>,
  steps: number,
  classes: number,
  dictionary: readonly string[],
): { text: string; confidence: number } {
  let text = ''
  let previous = -1
  let total = 0
  let kept = 0
  for (let s = 0; s < steps; s++) {
    let best = 0
    let bestValue = -Infinity
    for (let c = 0; c < classes; c++) {
      const value = probs[s * classes + c]
      if (value > bestValue) {
        bestValue = value
        best = c
      }
    }
    if (best !== 0 && best !== previous) {
      text += best - 1 < dictionary.length ? dictionary[best - 1] : ' '
      total += bestValue
      kept++
    }
    previous = best
  }
  return { text: text.trim(), confidence: kept > 0 ? total / kept : 0 }
}

/**
 * The page's text from its recognized lines: lines that overlap vertically
 * form a row read left to right, rows run top to bottom, and a gap taller
 * than about one line starts a new paragraph.
 */
export function orderLines(lines: readonly RecognizedLine[]): string {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0)
  const rows: { y0: number; y1: number; items: RecognizedLine[] }[] = []
  for (const line of sorted) {
    const row = rows.find(
      (r) =>
        Math.min(r.y1, line.y1) - Math.max(r.y0, line.y0) >
        0.5 * Math.min(r.y1 - r.y0, line.y1 - line.y0),
    )
    if (row) {
      row.items.push(line)
      row.y0 = Math.min(row.y0, line.y0)
      row.y1 = Math.max(row.y1, line.y1)
    } else {
      rows.push({ y0: line.y0, y1: line.y1, items: [line] })
    }
  }
  rows.sort((a, b) => a.y0 - b.y0)
  const heights = rows.map((r) => r.y1 - r.y0).sort((a, b) => a - b)
  const medianHeight = heights[heights.length >> 1] || 1
  let out = ''
  let previous: (typeof rows)[number] | null = null
  for (const row of rows) {
    row.items.sort((a, b) => a.x0 - b.x0)
    if (previous && row.y0 - previous.y1 > 0.9 * medianHeight) out += '\n'
    out += (out ? '\n' : '') + row.items.map((item) => item.text).join('   ')
    previous = row
  }
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * The page's confidence: the mean of every recognized line's confidence,
 * weighted by its length, including lines too doubtful to keep.
 *
 * Including them is the point. On a script the recognizer has no characters
 * for (Hebrew), most lines come back as low-confidence guesses, and this is
 * the signal that sends the page to the multilingual fallback.
 *
 * @returns null when the page had no lines at all (blank, or a picture).
 */
export function pageConfidence(lines: readonly RecognizedLine[]): number | null {
  let weighted = 0
  let characters = 0
  for (const line of lines) {
    const length = Math.max(1, line.text.length)
    weighted += line.confidence * length
    characters += length
  }
  return characters > 0 ? weighted / characters : null
}
