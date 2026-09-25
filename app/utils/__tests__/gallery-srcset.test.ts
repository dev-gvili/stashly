import { describe, it, expect } from 'vitest'
import { buildSrcSet, isSignedUrl } from '../gallery-layout'

const SIGNED =
  'https://bucket.fly.storage.tigris.dev/thumbnails/itm_a.webp' +
  '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260919T000000Z' +
  '&X-Amz-Expires=7200&X-Amz-SignedHeaders=host&X-Amz-Signature=deadbeef'

describe('isSignedUrl', () => {
  it('recognises a presigned URL', () => {
    expect(isSignedUrl(SIGNED)).toBe(true)
  })

  it('is false for ordinary URLs and empty values', () => {
    expect(isSignedUrl('/api/images?image=a.png')).toBe(false)
    expect(isSignedUrl('https://cdn.example.com/a.webp')).toBe(false)
    expect(isSignedUrl('')).toBe(false)
    expect(isSignedUrl(null)).toBe(false)
    expect(isSignedUrl(undefined)).toBe(false)
  })
})

describe('buildSrcSet', () => {
  it('adds width candidates to an unsigned URL', () => {
    expect(buildSrcSet('https://cdn.example.com/a.webp', [256, 512])).toBe(
      'https://cdn.example.com/a.webp?w=256 256w, https://cdn.example.com/a.webp?w=512 512w'
    )
  })

  it('uses & when the URL already has a query', () => {
    expect(buildSrcSet('/api/images?image=a.png', [256])).toBe(
      '/api/images?image=a.png&w=256 256w'
    )
  })

  // A `w=` param appended here falls outside the SigV4 signature and Tigris
  // rejects the request with 403 — measured 2026-09-16.
  it('never appends to a signed URL', () => {
    const out = buildSrcSet(SIGNED, [256, 512])
    expect(out).toBe(SIGNED)
    expect(out).not.toContain('w=256')
    expect(out).not.toContain(', ')
  })
})
