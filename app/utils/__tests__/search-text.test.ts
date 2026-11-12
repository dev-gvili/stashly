import { describe, expect, it } from 'vitest'
import { stripNulChars } from '@/utils/search-text'

describe('stripNulChars', () => {
  it('drops every NUL, which a Postgres text column refuses', () => {
    expect(stripNulChars('a\0b\0\0c')).toBe('abc')
  })

  it('returns text without NULs unchanged', () => {
    const text = 'Quarterly review\n\nSection 1'
    expect(stripNulChars(text)).toBe(text)
  })

  it('leaves an all-NUL string empty, so callers skip the write', () => {
    expect(stripNulChars('\0\0').trim()).toBe('')
  })
})
