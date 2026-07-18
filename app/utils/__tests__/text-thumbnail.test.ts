import { describe, it, expect } from 'vitest'
import { isTextRenderableFile, layoutTextLines } from '../text-thumbnail'

describe('isTextRenderableFile', () => {
  it('accepts plain text by mime type', () => {
    expect(isTextRenderableFile({ name: 'notes', type: 'text/plain' })).toBe(true)
    expect(isTextRenderableFile({ name: 'data', type: 'text/csv' })).toBe(true)
  })

  it('accepts markdown and prose extensions regardless of mime', () => {
    expect(isTextRenderableFile({ name: 'README.md', type: '' })).toBe(true)
    expect(isTextRenderableFile({ name: 'todo.TXT', type: 'application/octet-stream' })).toBe(true)
  })

  it('accepts code files typed as octet-stream by extension', () => {
    expect(isTextRenderableFile({ name: 'main.rs', type: 'application/octet-stream' })).toBe(true)
    expect(isTextRenderableFile({ name: 'deploy.ps1', type: '' })).toBe(true)
    expect(isTextRenderableFile({ name: 'config.yaml' })).toBe(true)
  })

  it('accepts bare well-known filenames without an extension', () => {
    expect(isTextRenderableFile({ name: 'Dockerfile', type: '' })).toBe(true)
    expect(isTextRenderableFile({ name: 'Makefile', type: '' })).toBe(true)
  })

  it('accepts structured-text mimes', () => {
    expect(isTextRenderableFile({ name: 'payload', type: 'application/json' })).toBe(true)
    expect(isTextRenderableFile({ name: 'feed', type: 'application/xml' })).toBe(true)
  })

  it('rejects binary media', () => {
    expect(isTextRenderableFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false)
    expect(isTextRenderableFile({ name: 'doc.pdf', type: 'application/pdf' })).toBe(false)
    expect(isTextRenderableFile({ name: 'song.mp3', type: 'audio/mpeg' })).toBe(false)
    expect(isTextRenderableFile({ name: 'archive.zip', type: 'application/zip' })).toBe(false)
  })
})

describe('layoutTextLines', () => {
  // 6px per char makes widths easy to reason about: maxWidth 60 = 10 chars.
  const measure = (s: string) => s.length * 6

  it('passes short lines through unchanged', () => {
    expect(layoutTextLines(['hello', 'world'], 10, 60, measure)).toEqual(['hello', 'world'])
  })

  it('preserves blank lines', () => {
    expect(layoutTextLines(['a', '', 'b'], 10, 60, measure)).toEqual(['a', '', 'b'])
  })

  it('wraps long lines at word boundaries', () => {
    const out = layoutTextLines(['aaa bbb ccc'], 10, 60, measure)
    expect(out).toEqual(['aaa bbb', 'ccc'])
  })

  it('hard-splits unbroken tokens longer than the line', () => {
    const out = layoutTextLines(['abcdefghijklmnop'], 10, 60, measure)
    expect(out).toEqual(['abcdefghij', 'klmnop'])
  })

  it('clamps output to maxLines', () => {
    const out = layoutTextLines(['a', 'b', 'c', 'd'], 2, 60, measure)
    expect(out).toEqual(['a', 'b'])
  })

  it('clamps mid-wrap when a wrapped line hits the limit', () => {
    const out = layoutTextLines(['aaaaaaaaaa bbbbbbbbbb cccccccccc'], 2, 60, measure)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe('aaaaaaaaaa')
  })

  it('always makes progress even when nothing fits', () => {
    const out = layoutTextLines(['abc'], 5, 1, measure)
    expect(out.join('')).toBe('abc')
    expect(out.length).toBeLessThanOrEqual(5)
  })
})
