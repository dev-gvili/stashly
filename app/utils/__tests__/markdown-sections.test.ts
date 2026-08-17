/**
 * Line structure and section offsets in the indexed markdown body.
 *
 * These two outputs have to agree on one coordinate space: `text` is what gets
 * stored as `Search.content` and split by `chunkText`, and `sections[i].start`
 * is an offset into that same string. If they drift, a passage gets labelled
 * with the wrong heading — a locator that is confidently wrong, which is worse
 * than none at all.
 */
import { describe, it, expect } from 'vitest'
import { parseMarkdownMetadata } from '../markdown'
import { assignChunkSections, chunkText } from '@/services/search-actions'

const DOC = `# Title

Intro paragraph about refunds.

## Why chunk?

Single-vector-per-document was rejected.

### Details

More on the rationale here.

## Architecture

The pipeline has three stages.
`

describe('parseMarkdownMetadata — line structure', () => {
  it('keeps line breaks, so a line number can be counted', () => {
    const { text } = parseMarkdownMetadata(DOC)
    expect(text).toContain('\n')
  })

  it('strips heading markers while keeping the heading text', () => {
    const { text } = parseMarkdownMetadata(DOC)
    expect(text).toContain('Why chunk?')
    expect(text).not.toContain('## ')
  })

  it('collapses blank-line runs without collapsing single breaks', () => {
    const { text } = parseMarkdownMetadata('a\n\n\n\n\nb')
    expect(text).toBe('a\n\nb')
  })

  it('still counts words with newlines preserved', () => {
    const { wordCount } = parseMarkdownMetadata(DOC)
    expect(wordCount).toBeGreaterThan(15)
  })
})

describe('parseMarkdownMetadata — sections', () => {
  it('records every heading in document order', () => {
    const { sections } = parseMarkdownMetadata(DOC)
    expect(sections.map((s) => s.title)).toEqual([
      'Title',
      'Why chunk?',
      'Details',
      'Architecture',
    ])
  })

  it('records the heading level', () => {
    const { sections } = parseMarkdownMetadata(DOC)
    expect(sections.map((s) => s.level)).toEqual([1, 2, 3, 2])
  })

  // The whole contract: an offset into `text`, not into the raw markdown.
  it('points at the heading inside the stripped text', () => {
    const { text, sections } = parseMarkdownMetadata(DOC)
    for (const section of sections) {
      expect(text.slice(section.start, section.start + section.title.length)).toBe(
        section.title
      )
    }
  })

  it('keeps duplicate headings in document order', () => {
    const { text, sections } = parseMarkdownMetadata(
      '## Notes\n\nfirst\n\n## Notes\n\nsecond\n'
    )
    expect(sections).toHaveLength(2)
    expect(sections[0].start).toBeLessThan(sections[1].start)
    expect(text.slice(sections[1].start, sections[1].start + 5)).toBe('Notes')
  })

  it('returns no sections for a document without headings', () => {
    expect(parseMarkdownMetadata('just prose, no headings').sections).toEqual([])
  })
})

describe('assignChunkSections', () => {
  it('labels each chunk with the last heading that opened before it', () => {
    const chunks = [
      { content: 'a', charStart: 0, charEnd: 10, pageNum: null },
      { content: 'b', charStart: 50, charEnd: 60, pageNum: null },
      { content: 'c', charStart: 200, charEnd: 210, pageNum: null },
    ]
    const sections = [
      { title: 'Title', start: 0 },
      { title: 'Why chunk?', start: 40 },
      { title: 'Architecture', start: 150 },
    ]
    expect(assignChunkSections(chunks, sections).map((c) => c.section)).toEqual([
      'Title',
      'Why chunk?',
      'Architecture',
    ])
  })

  it('leaves a chunk before the first heading unlabelled', () => {
    const chunks = [{ content: 'a', charStart: 0, charEnd: 10, pageNum: null }]
    const sections = [{ title: 'Later', start: 100 }]
    expect(assignChunkSections(chunks, sections)[0].section).toBeNull()
  })

  it('returns chunks untouched when the document has no headings', () => {
    const chunks = [{ content: 'a', charStart: 0, charEnd: 10, pageNum: null }]
    expect(assignChunkSections(chunks, [])).toEqual(chunks)
  })

  // End to end over the real chunker: every chunk that lands inside a section
  // must name it, or a markdown result silently loses its locator again.
  it('labels real chunks cut from a real document', () => {
    const body = `# Guide\n\n${'Intro prose. '.repeat(120)}\n\n## Refunds\n\n${'Refund policy text. '.repeat(120)}`
    const { text, sections } = parseMarkdownMetadata(body)
    const chunks = assignChunkSections(chunkText(text), sections)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.section != null)).toBe(true)
    expect(chunks.at(-1)?.section).toBe('Refunds')
  })
})
