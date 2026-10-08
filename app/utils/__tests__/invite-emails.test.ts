import { describe, expect, it } from 'vitest'
import { isInviteEmail, splitInviteEmails } from '@/utils/invite-emails'

/**
 * The invite dialogs count only valid addresses on their "Send N invites"
 * button and split a pasted list into rows ("Paste emails separated by
 * commas"). Both live in these two functions.
 */
describe('isInviteEmail', () => {
  it('accepts an address, ignoring surrounding spaces', () => {
    expect(isInviteEmail('rachel.chen@acme.com')).toBe(true)
    expect(isInviteEmail('  dana@stashly.dev ')).toBe(true)
  })

  it('refuses what the server would refuse', () => {
    expect(isInviteEmail('not-an-email')).toBe(false)
    expect(isInviteEmail('dana@')).toBe(false)
    expect(isInviteEmail('')).toBe(false)
  })
})

describe('splitInviteEmails', () => {
  it('splits on commas, semicolons and whitespace', () => {
    expect(splitInviteEmails('a@x.com, b@y.com;c@z.com\nd@w.com', [])).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
    ])
  })

  it('drops blanks and repeats, including ones already in the form', () => {
    expect(splitInviteEmails(' , a@x.com,, A@X.com, b@y.com ', ['B@y.com'])).toEqual(['a@x.com'])
  })

  it('keeps an invalid entry so its row can say what is wrong', () => {
    expect(splitInviteEmails('not-an-email, a@x.com', [])).toEqual(['not-an-email', 'a@x.com'])
  })
})
