import { describe, expect, it } from 'vitest'
import { isSvgFile, svgRasterSize } from '@/utils/svg-raster'

describe('svgRasterSize', () => {
  it('fits the long side to the box and keeps the aspect ratio', () => {
    expect(svgRasterSize(280, 318, 512)).toEqual({ width: 451, height: 512 })
    expect(svgRasterSize(1000, 500, 512)).toEqual({ width: 512, height: 256 })
  })

  it('scales a small vector up rather than leaving it tiny', () => {
    expect(svgRasterSize(24, 12, 512)).toEqual({ width: 512, height: 256 })
  })

  it('falls back to a square when the SVG has no intrinsic size', () => {
    expect(svgRasterSize(0, 0, 512)).toEqual({ width: 512, height: 512 })
    expect(svgRasterSize(100, 0, 512)).toEqual({ width: 512, height: 512 })
    expect(svgRasterSize(Number.NaN, 50, 8)).toEqual({ width: 8, height: 8 })
  })

  it('never rounds a thin side down to zero', () => {
    expect(svgRasterSize(10_000, 1, 512)).toEqual({ width: 512, height: 1 })
  })
})

describe('isSvgFile', () => {
  it.each([
    [{ name: 'logo.svg', type: 'image/svg+xml' }, true],
    [{ name: 'logo.SVG', type: '' }, true],
    [{ name: 'logo.svg', type: 'application/octet-stream' }, true],
    [{ name: 'drawing', type: 'image/svg+xml' }, true],
    [{ name: 'photo.png', type: 'image/png' }, false],
    [{ name: 'svg.txt', type: 'text/plain' }, false],
  ])('%o → %s', (file, expected) => {
    expect(isSvgFile(file)).toBe(expected)
  })
})
