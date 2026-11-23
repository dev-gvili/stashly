import { prisma } from '@/services/db'
import {
  emailFromIdToken,
  getAiPreferences,
  getNotificationPreferences,
  listLinkedAccounts,
  PREFERENCE_DEFAULTS,
  setAiPreference,
  setNotificationPreference,
  unlinkAccount,
  validateProfileName,
} from '@/services/settings-actions'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('validateProfileName', () => {
  it('trims the name it stores', () => {
    expect(validateProfileName('  Alon Gvili  ')).toEqual({ ok: true, name: 'Alon Gvili' })
  })

  it('refuses an empty or blank name', () => {
    expect(validateProfileName('')).toMatchObject({ ok: false })
    expect(validateProfileName('   ')).toMatchObject({ ok: false })
  })

  it('accepts 50 characters and refuses 51, the width of User.name', () => {
    expect(validateProfileName('a'.repeat(50))).toMatchObject({ ok: true })
    expect(validateProfileName('a'.repeat(51))).toMatchObject({ ok: false })
  })
})

describe('emailFromIdToken', () => {
  const token = (claims: object) =>
    `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`

  it('reads the email claim', () => {
    expect(emailFromIdToken(token({ email: 'me@example.com' }))).toBe('me@example.com')
  })

  it('is null without a token, an email claim or a readable payload', () => {
    expect(emailFromIdToken(null)).toBeNull()
    expect(emailFromIdToken(token({ sub: '1' }))).toBeNull()
    expect(emailFromIdToken('not-a-jwt')).toBeNull()
    expect(emailFromIdToken('a.%%%.c')).toBeNull()
  })
})

// Against the dev database: the guard and the preference rows are only
// worth testing where the real constraints and defaults apply.
describe('connected accounts and preferences (database)', () => {
  const userId = `user_settings_test_${Date.now()}`

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Settings Test',
        email: `${userId}@example.test`,
        emailVerified: true,
        accounts: {
          create: [
            { id: `${userId}_gh`, accountId: 'gh-1', providerId: 'github' },
            { id: `${userId}_go`, accountId: 'go-1', providerId: 'google' },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('lists every provider, linked or not', async () => {
    const accounts = await listLinkedAccounts(userId)
    expect(accounts.map((a) => [a.providerId, a.connected])).toEqual([
      ['github', true],
      ['google', true],
      ['microsoft', false],
    ])
  })

  it('unlinks a provider while another remains, then refuses the last one', async () => {
    await expect(unlinkAccount({ userId, providerId: 'github' })).resolves.toBe(true)
    await expect(unlinkAccount({ userId, providerId: 'google' })).rejects.toMatchObject({
      status: 409,
    })
    expect(await prisma.account.count({ where: { userId } })).toBe(1)
  })

  it('reads the defaults with no row, then saves one switch without touching the rest', async () => {
    expect(await getNotificationPreferences(userId)).toEqual({
      comments: PREFERENCE_DEFAULTS.notifyComments,
      shares: PREFERENCE_DEFAULTS.notifyShares,
      ai: PREFERENCE_DEFAULTS.notifyAi,
      weekly: PREFERENCE_DEFAULTS.notifyWeekly,
    })
    await setNotificationPreference({ userId, key: 'ai', value: true })
    await setAiPreference({ userId, key: 'index', value: false })
    expect(await getNotificationPreferences(userId)).toEqual({
      comments: true,
      shares: true,
      ai: true,
      weekly: true,
    })
    expect(await getAiPreferences(userId)).toEqual({
      transcribe: true,
      transcribeVideo: true,
      caption: true,
      index: false,
    })
  })
})
