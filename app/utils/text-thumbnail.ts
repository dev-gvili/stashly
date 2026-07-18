/**
 * Text thumbnail rendering — "screenshot" of the first part of a text-based
 * file (plain text, markdown, code, config) onto an A4-proportioned page.
 *
 * Mirrors `@/utils/pdf`: worker-compatible (OffscreenCanvas only, no DOM),
 * dependency-free, returns WebP Blobs. Dispatched from the compute worker via
 * the `tinyText` / `resizeText` RPC kinds; text items stop after stage 2 like
 * PDFs.
 */

// ---------------------------------------------------------------------------
// File-type detection
// ---------------------------------------------------------------------------

/**
 * Extensions rendered in a monospace face (code, scripts, config, data).
 * Everything else that passes `isTextRenderableFile` renders sans-serif
 * (prose: .txt, markdown, …). Many of these arrive as `text/plain` or
 * `application/octet-stream`, so extension wins over mime for font choice.
 */
const MONO_EXTENSIONS = new Set([
  // web
  'html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml',
  // backend / system
  'java', 'c', 'cpp', 'h', 'cs', 'php', 'py', 'rb', 'go', 'rs', 'swift', 'kt', 'dart',
  // scripts
  'ps1', 'psm1', 'psd1', 'sh', 'bat', 'cmd', 'zsh', 'bash',
  // config / data
  'yaml', 'yml', 'toml', 'ini', 'sql', 'graphql', 'env', 'gitignore',
  'csv', 'tsv', 'log', 'dockerfile', 'makefile',
])

const PROSE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'mdown', 'mkd', 'text'])

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  // No dot → the whole name may be a known bare filename (Dockerfile, Makefile).
  return (dot === -1 ? name : name.slice(dot + 1)).toLowerCase()
}

/** True for files whose content is text we can screenshot into a thumbnail. */
export function isTextRenderableFile(file: { name: string; type?: string }): boolean {
  const ext = fileExtension(file.name)
  if (MONO_EXTENSIONS.has(ext) || PROSE_EXTENSIONS.has(ext)) return true
  const type = file.type ?? ''
  if (type.startsWith('text/')) return true
  return /\b(json|xml|javascript|typescript|yaml|sql)\b/.test(type)
}

function isMonoFile(file: { name: string; type?: string }): boolean {
  const ext = fileExtension(file.name)
  if (MONO_EXTENSIONS.has(ext)) return true
  if (PROSE_EXTENSIONS.has(ext)) return false
  // Unknown extension with a code-ish mime → monospace; plain text → prose.
  const type = file.type ?? ''
  return /\b(json|xml|javascript|typescript|yaml|sql|html|css)\b/.test(type)
}

// ---------------------------------------------------------------------------
// Line layout (pure — unit-testable with a fake measure function)
// ---------------------------------------------------------------------------

/**
 * Greedy-wrap source lines to `maxWidth`, clamped to `maxLines` output lines.
 * `measure` returns the rendered width of a string (ctx.measureText in prod).
 * Long unbroken tokens are hard-split; wraps prefer the last space when it is
 * past the halfway point of the fitting prefix.
 */
export function layoutTextLines(
  sourceLines: string[],
  maxLines: number,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = []
  for (const source of sourceLines) {
    if (out.length >= maxLines) break
    if (source.trim() === '') {
      out.push('')
      continue
    }
    let rest = source
    while (rest.length > 0 && out.length < maxLines) {
      if (measure(rest) <= maxWidth) {
        out.push(rest)
        break
      }
      // Binary-search the longest prefix that fits (always consume ≥1 char).
      let lo = 1
      let hi = rest.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (measure(rest.slice(0, mid)) <= maxWidth) lo = mid
        else hi = mid - 1
      }
      let cut = lo
      const space = rest.lastIndexOf(' ', cut)
      if (space > cut * 0.5) cut = space
      out.push(rest.slice(0, cut).trimEnd())
      rest = rest.slice(cut).trimStart()
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** ISO A-series portrait ratio — matches how a PDF page thumbnail lands. */
const PAGE_RATIO = Math.SQRT2
/** Only the top of the file is screenshotted; one page never needs more. */
const MAX_SOURCE_BYTES = 32 * 1024

const PAGE_BG = '#ffffff'
const INK = '#1f2937'

async function readSourceLines(file: File): Promise<string[] | null> {
  const raw = await file.slice(0, MAX_SOURCE_BYTES).text()
  const text = raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
  const lines = text.split('\n')
  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  return lines.length > 0 && lines.some((l) => l.trim() !== '') ? lines : null
}

/**
 * Render the first page-worth of a text file to a WebP Blob at fit scale.
 * Worker-compatible (uses OffscreenCanvas). Returns null for empty files or
 * on canvas failure — no thumbnail beats a blank page.
 */
export async function renderTextPageToBlob(
  file: File,
  maxSize = 512,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const sourceLines = await readSourceLines(file)
    if (!sourceLines) return null

    const height = maxSize
    const width = Math.round(maxSize / PAGE_RATIO)
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('[text-thumbnail] renderTextPageToBlob: getContext returned null')
      return null
    }

    ctx.fillStyle = PAGE_BG
    ctx.fillRect(0, 0, width, height)

    const padding = Math.round(width * 0.09)
    const fontSize = Math.max(4, Math.round(width / 36))
    const lineHeight = Math.round(fontSize * 1.55)
    const family = isMonoFile(file) ? 'monospace' : 'sans-serif'
    ctx.font = `${fontSize}px ${family}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = INK

    const maxLines = Math.floor((height - padding * 2) / lineHeight)
    const lines = layoutTextLines(
      sourceLines,
      maxLines,
      width - padding * 2,
      (s) => ctx.measureText(s).width,
    )
    lines.forEach((line, i) => {
      if (line) ctx.fillText(line, padding, padding + i * lineHeight)
    })

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
    if (!blob) {
      console.error('[text-thumbnail] renderTextPageToBlob: convertToBlob returned null')
      return null
    }
    return { blob, width, height }
  } catch (err) {
    console.error('[text-thumbnail] renderTextPageToBlob failed', err)
    return null
  }
}

/**
 * 8×8 WebP tiny preview for stage 1 — renders the page small and downscales,
 * mirroring `generatePdfThumbnail`.
 */
export async function generateTextThumbnail(file: File): Promise<Blob | null> {
  const rendered = await renderTextPageToBlob(file, 64)
  if (!rendered) return null
  try {
    const bitmap = await createImageBitmap(rendered.blob)
    const tiny = new OffscreenCanvas(8, 8)
    const ctx = tiny.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, 8, 8)
    bitmap.close()
    return await tiny.convertToBlob({ type: 'image/webp', quality: 0.5 })
  } catch (err) {
    console.error('[text-thumbnail] generateTextThumbnail failed', err)
    return null
  }
}
