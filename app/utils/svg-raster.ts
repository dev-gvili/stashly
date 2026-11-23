/**
 * Pure helpers for rasterising SVGs into thumbnails. Shared by the SVG
 * producer (`thumbnail-stages/svg.ts`) and the worker that renders
 * (`workers/svg-raster.worker.ts`), and kept free of imports so the worker
 * doesn't pull the producer (and its `new Worker(...)`) into its own bundle.
 */

export const SVG_MIME = 'image/svg+xml'

/**
 * Whether a file is an SVG, by mime or by extension (an SVG stored without a
 * mime arrives as `application/octet-stream` or empty).
 *
 * @example
 * isSvgFile({ name: 'logo.svg', type: '' }) // → true
 */
export function isSvgFile(file: { type: string; name: string }): boolean {
  return file.type === SVG_MIME || /\.svg$/i.test(file.name)
}

/**
 * The pixel size to rasterise an SVG at, fitting `maxSize` on its long side.
 * A vector has no native resolution, so a small one is scaled *up* to fill
 * the box rather than kept tiny. A side that isn't a positive number (no
 * intrinsic size) falls back to a square.
 *
 * @example
 * svgRasterSize(24, 12, 512) // → { width: 512, height: 256 }
 * svgRasterSize(0, 0, 512)   // → { width: 512, height: 512 }
 */
export function svgRasterSize(
  naturalWidth: number,
  naturalHeight: number,
  maxSize: number
): { width: number; height: number } {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    return { width: maxSize, height: maxSize }
  }
  const ratio = maxSize / Math.max(naturalWidth, naturalHeight)
  return {
    width: Math.max(1, Math.round(naturalWidth * ratio)),
    height: Math.max(1, Math.round(naturalHeight * ratio)),
  }
}
