import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  toChipQueries,
  toExtension,
  toFileKind,
  toNeedsYouEntries,
  toQueryFromName,
  toQueueEntries,
  type ReceivedInvitation,
} from '../home-data'

describe('toFileKind', () => {
  it('maps categories onto the five home kinds', () => {
    expect(toFileKind('graphic')).toBe('image')
    expect(toFileKind('script')).toBe('code')
    expect(toFileKind('pdf')).toBe('document')
    expect(toFileKind('video')).toBe('video')
  })
})

describe('toExtension / formatDuration', () => {
  it('reads the last extension, upper-cased', () => {
    expect(toExtension('Q3 deck.pdf')).toBe('PDF')
    expect(toExtension('README')).toBeUndefined()
  })
  it('formats minutes and hours', () => {
    expect(formatDuration(401)).toBe('6:41')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})

describe('toQueueEntries', () => {
  it('labels kind and duration, and omits an unknown duration', () => {
    const [a, b] = toQueueEntries([
      { id: '1', name: 'a.mp4', kind: 'video', durationSec: 401 },
      { id: '2', name: 'b.mp3', kind: 'audio', durationSec: null },
    ])
    expect(a.meta).toBe('Video · 6:41')
    expect(b.meta).toBe('Audio')
  })
})

const invite = (over: Partial<ReceivedInvitation>): ReceivedInvitation => ({
  id: 'inv1',
  createdAt: '2026-11-01T10:00:00Z',
  sender: { id: 's1', name: 'Sam Ortiz' },
  recipients: [{ id: 'r1', email: 'Me@x.com', status: 'pending', role: 'write' }],
  item: { id: 'i1', name: 'Episode 12' },
  workspace: null,
  ...over,
})

describe('toNeedsYouEntries', () => {
  it('lists pending invites for this email, newest first, with the recipient id', () => {
    const rows = toNeedsYouEntries(
      [
        invite({}),
        invite({ id: 'inv2', createdAt: '2026-11-02T10:00:00Z', item: null, workspace: { id: 'w', name: 'Acme' } }),
        invite({ id: 'inv3', recipients: [{ id: 'r3', email: 'me@x.com', status: 'accepted', role: 'read' }] }),
      ],
      'me@x.com'
    )
    expect(rows.map((r) => r.id)).toEqual(['inv2', 'inv1'])
    expect(rows[0].text).toBe('invited you to join Acme')
    expect(rows[1].text).toBe('invited you to edit Episode 12')
    expect(rows[1].recipientId).toBe('r1')
  })
})

describe('chips', () => {
  it('derives queries from names', () => {
    expect(toQueryFromName('Q3_board-deck.final.pdf')).toBe('Q3 board deck.final')
    expect(toQueryFromName('a.pdf')).toBe('')
  })
  it('only suggests indexed files, without repeats', () => {
    const files = [
      { id: '1', name: 'Budget plan.pdf' },
      { id: '2', name: 'Unindexed notes.md' },
      { id: '3', name: 'Budget plan.docx' },
      { id: '4', name: 'Trip photos.zip' },
    ]
    expect(toChipQueries(files, ['1', '3', '4'])).toEqual(['Budget plan', 'Trip photos'])
  })
})
