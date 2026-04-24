import { describe, it, expect } from 'vitest'
import { hashToColor } from '../thumbnail'

describe('hashToColor', () => {
  it('returns a valid hex color string', () => {
    const color = hashToColor('photo.jpg', 'image/jpeg')
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is deterministic — same input always yields same color', () => {
    const a = hashToColor('photo.jpg', 'image/jpeg')
    const b = hashToColor('photo.jpg', 'image/jpeg')
    expect(a).toBe(b)
  })

  it('produces different colors for different inputs', () => {
    const a = hashToColor('photo.jpg', 'image/jpeg')
    const b = hashToColor('document.pdf', 'application/pdf')
    expect(a).not.toBe(b)
  })
})
