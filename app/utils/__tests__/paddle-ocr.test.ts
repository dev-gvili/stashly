import { describe, it, expect } from 'vitest'
import {
  parseCharacterDict,
  resizeRgba,
  cropRgba,
  detectionInput,
  extractTextBoxes,
  recognitionBatchInput,
  ctcGreedyDecode,
  orderLines,
  pageConfidence,
  type RecognizedLine,
} from '@/utils/paddle-ocr'

function solid(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4)
  return { data, width, height }
}

function line(text: string, x0: number, y0: number, confidence = 0.9): RecognizedLine {
  return { text, confidence, x0, y0, x1: x0 + 100, y1: y0 + 20 }
}

describe('parseCharacterDict', () => {
  it('reads plain, single-quoted, double-quoted and escaped entries in order', () => {
    const yaml = [
      'PostProcess:',
      '  name: CTCLabelDecode',
      '  character_dict:',
      "  - '!'",
      "  - ''''",
      '  - $',
      '  - \\',
      "  - ' '",
      '  - "\\u00e9"',
      '  - 中',
      'Other: 1',
    ].join('\r\n')

    expect(parseCharacterDict(yaml)).toEqual(['!', "'", '$', '\\', ' ', 'é', '中'])
  })

  it('throws when the file has no character list', () => {
    expect(() => parseCharacterDict('Global:\n  model_name: x\n')).toThrow('character_dict')
  })
})

describe('image preparation', () => {
  it('resizes keeping a solid colour solid', () => {
    const out = resizeRgba(solid(10, 6, [200, 100, 50]), 4, 3)
    expect(out.width).toBe(4)
    expect(out.height).toBe(3)
    expect(Array.from(out.data.slice(0, 4))).toEqual([200, 100, 50, 255])
  })

  it('crops clamped to the image', () => {
    const out = cropRgba(solid(10, 10, [1, 2, 3]), { x0: -5, y0: 8, x1: 4, y1: 30 })
    expect([out.width, out.height]).toEqual([4, 2])
  })

  it('scales the detector input to a 960 long side in multiples of 32, BGR first', () => {
    const input = detectionInput(solid(1920, 1000, [255, 0, 0]))
    expect([input.width, input.height]).toEqual([960, 512])
    // Channel 0 is blue (0), channel 2 is red (255).
    const n = input.width * input.height
    expect(input.data[0]).toBeCloseTo((0 - 0.485) / 0.229)
    expect(input.data[2 * n]).toBeCloseTo((1 - 0.406) / 0.225)
  })

  it('never upscales a small page for detection', () => {
    const input = detectionInput(solid(300, 100, [0, 0, 0]))
    expect([input.width, input.height]).toEqual([288, 96])
  })

  it('resizes a line to height 48, keeping its aspect ratio, values in [-1, 1]', () => {
    const input = recognitionBatchInput([solid(200, 24, [255, 255, 255])])
    expect([input.batch, input.width, input.height]).toEqual([1, 400, 48])
    expect(input.data[0]).toBeCloseTo(1)
  })

  it('pads each line of a batch with zeros to the widest line, keeping lines apart', () => {
    // 400 px wide at height 48, and 96 px wide at height 48.
    const input = recognitionBatchInput([
      solid(200, 24, [255, 255, 255]),
      solid(48, 24, [0, 0, 0]),
    ])
    const plane = 48 * 400
    expect([input.batch, input.width]).toEqual([2, 400])
    expect(input.data).toHaveLength(2 * 3 * plane)
    // Line 0 fills its row; line 1 is -1 (black) for 96 px, then padding.
    expect(input.data[399]).toBeCloseTo(1)
    const line1 = 3 * plane
    expect(input.data[line1 + 95]).toBeCloseTo(-1)
    expect(input.data[line1 + 96]).toBe(0)
    // Last channel, last row, past the line: still padding.
    expect(input.data[line1 + 2 * plane + 47 * 400 + 399]).toBe(0)
  })

  it('caps the batch width at 3200', () => {
    const input = recognitionBatchInput([solid(4000, 24, [255, 255, 255])])
    expect(input.width).toBe(3200)
  })
})

describe('extractTextBoxes', () => {
  // A 20 × 10 map with two text kernels, one confident and one faint.
  function map() {
    const width = 20
    const height = 10
    const prob = new Float32Array(width * height)
    const fill = (x0: number, y0: number, x1: number, y1: number, v: number) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) prob[y * width + x] = v
    }
    fill(2, 2, 9, 4, 0.9)
    fill(13, 6, 17, 8, 0.3)
    return { prob, width, height }
  }

  it('keeps regions whose mean probability clears box_thresh, scaled to page pixels', () => {
    const { prob, width, height } = map()
    const boxes = extractTextBoxes(prob, width, height, 2, 2)

    expect(boxes).toHaveLength(1)
    // 8 × 3 region, unclip distance 8·3·1.4 / (2·11) ≈ 1.53, then × 2.
    const grow = (8 * 3 * 1.4) / 22
    expect(boxes[0].x0).toBeCloseTo((2 - grow) * 2)
    expect(boxes[0].x1).toBeCloseTo((10 + grow) * 2)
    expect(boxes[0].y1).toBeCloseTo((5 + grow) * 2)
  })

  it('does not join regions across the left and right edges of a row', () => {
    const width = 4
    const height = 4
    const prob = new Float32Array(width * height)
    // Column 3 of each row and column 0 of the next are adjacent in memory.
    for (let y = 0; y < height; y++) {
      prob[y * width + 3] = 0.9
      prob[y * width] = 0.9
    }
    const boxes = extractTextBoxes(prob, width, height, 1, 1, {
      thresh: 0.2,
      boxThresh: 0.45,
      unclipRatio: 0,
    })
    // Each 1-wide column fails the 3-pixel minimum on its own; a wrapped join would pass.
    expect(boxes).toHaveLength(0)
  })

  it('drops specks under four pixels or three wide', () => {
    const prob = new Float32Array(100)
    prob[55] = 0.99
    expect(extractTextBoxes(prob, 10, 10, 1, 1)).toEqual([])
  })
})

describe('ctcGreedyDecode', () => {
  const dictionary = ['a', 'b']

  // Classes: 0 blank, 1 'a', 2 'b', 3 the trailing space.
  function steps(...rows: number[][]) {
    return { probs: rows.flat(), steps: rows.length, classes: rows[0].length }
  }

  it('drops blanks and collapses repeats, but keeps a letter repeated across a blank', () => {
    const { probs, steps: n, classes } = steps(
      [0.1, 0.8, 0.05, 0.05],
      [0.1, 0.8, 0.05, 0.05],
      [0.9, 0.05, 0.03, 0.02],
      [0.1, 0.7, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.7],
      [0.1, 0.1, 0.6, 0.2],
    )
    const result = ctcGreedyDecode(probs, n, classes, dictionary)

    expect(result.text).toBe('aa b')
    expect(result.confidence).toBeCloseTo((0.8 + 0.7 + 0.7 + 0.6) / 4)
  })

  it('returns empty text and zero confidence for all blanks', () => {
    const { probs, steps: n, classes } = steps([1, 0, 0, 0], [1, 0, 0, 0])
    expect(ctcGreedyDecode(probs, n, classes, dictionary)).toEqual({ text: '', confidence: 0 })
  })
})

describe('orderLines', () => {
  it('reads a row left to right and rows top to bottom', () => {
    const text = orderLines([line('world', 200, 0), line('second', 0, 22), line('hello', 0, 2)])
    expect(text).toBe('hello   world\nsecond')
  })

  it('separates paragraphs at a gap taller than a line', () => {
    const text = orderLines([line('one', 0, 0), line('two', 0, 22), line('three', 0, 80)])
    expect(text).toBe('one\ntwo\n\nthree')
  })

  it('returns an empty string for no lines', () => {
    expect(orderLines([])).toBe('')
  })
})

describe('pageConfidence', () => {
  it('weights each line by its length', () => {
    const confidence = pageConfidence([line('aaaaaaaaa', 0, 0, 0.9), line('b', 0, 30, 0.1)])
    expect(confidence).toBeCloseTo((9 * 0.9 + 1 * 0.1) / 10)
  })

  it('is null for a page with no lines', () => {
    expect(pageConfidence([])).toBeNull()
  })

  it('leaves out empty picture-shaped regions', () => {
    const icons = Array.from({ length: 12 }, (_, i) => ({
      text: '',
      confidence: 0,
      x0: 0,
      y0: 100 + i * 200,
      x1: 200,
      y1: 243 + i * 200,
    }))
    expect(pageConfidence([line('Stashly Technical Atlas', 0, 0, 0.99), ...icons])).toBeCloseTo(0.99)
    expect(pageConfidence(icons)).toBeNull()
  })

  it('counts empty line-shaped regions as unread text, so a page of them reads 0', () => {
    // 100 × 20 boxes from `line()`: aspect 5, a strip of text the model could not read.
    const unread = Array.from({ length: 6 }, (_, i) => line('', 0, i * 30, 0))
    expect(pageConfidence(unread)).toBe(0)
  })
})
