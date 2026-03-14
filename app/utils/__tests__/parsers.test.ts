import { describe, it, expect } from 'vitest'
import { parseFileExtension, parseEtag } from '../parsers'

describe('parseFileExtension', () => {
  it('extracts the extension from a normal filename', () => {
    expect(parseFileExtension('image.png')).toBe('png')
  })

  it('extracts the last extension for files with multiple dots', () => {
    expect(parseFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns empty string for a filename with no extension', () => {
    expect(parseFileExtension('Makefile')).toBe('')
  })

  it('returns empty string for an empty string', () => {
    expect(parseFileExtension('')).toBe('')
  })

  it('handles filenames starting with a dot (hidden files)', () => {
    // '.gitignore' → split gives ['', 'gitignore'], pop returns 'gitignore'
    expect(parseFileExtension('.gitignore')).toBe('gitignore')
  })

  it('extracts extension correctly for paths with directory separators', () => {
    // The function splits on '.', not '/', so the last dot section is the extension
    expect(parseFileExtension('path/to/file.ts')).toBe('ts')
  })

  it('handles extensions with uppercase letters', () => {
    expect(parseFileExtension('Photo.JPG')).toBe('JPG')
  })
})

describe('parseEtag', () => {
  it('wraps a bare string in double quotes', () => {
    expect(parseEtag('abc123')).toBe('"abc123"')
  })

  it('strips surrounding double quotes then re-wraps', () => {
    expect(parseEtag('"abc123"')).toBe('"abc123"')
  })

  it('strips surrounding single quotes then re-wraps', () => {
    expect(parseEtag("'abc123'")).toBe('"abc123"')
  })

  it('handles escaped quotes inside the value', () => {
    // \\"abc\\" → after cleaning → "abc" → wrapped → ""abc""
    const result = parseEtag('\\"abc\\"')
    expect(result).toBe('"abc"')
  })

  it('handles an empty string', () => {
    expect(parseEtag('')).toBe('""')
  })

  it('handles a value with dashes and numbers (typical S3 ETag)', () => {
    expect(parseEtag('"d8e8fca2dc0f896fd7cb4cb0031ba249-2"')).toBe(
      '"d8e8fca2dc0f896fd7cb4cb0031ba249-2"'
    )
  })
})
