import { describe, expect, it } from 'vitest'
import { getRememberedAccount, rememberAccount } from '../remembered-account'

/**
 * The sign-in page's "Continue as …" card reads this cookie. It must never
 * render something that isn't a real, supported OAuth sign-in.
 */
const ACCOUNT = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  provider: 'github',
}

function requestWith(setCookie: string) {
  return new Request('http://localhost/auth/sign-in', {
    headers: { Cookie: setCookie.split(';')[0] },
  })
}

describe('remembered account cookie', () => {
  it('round-trips a supported sign-in', async () => {
    const setCookie = await rememberAccount(ACCOUNT)
    expect(setCookie).toMatch(/^last-account=.*HttpOnly/)
    expect(await getRememberedAccount(requestWith(setCookie!))).toEqual(ACCOUNT)
  })

  it('refuses a provider the app does not offer', async () => {
    expect(await rememberAccount({ ...ACCOUNT, provider: 'credential' })).toBeNull()
    expect(await rememberAccount({ ...ACCOUNT, provider: undefined })).toBeNull()
  })

  it('reads nothing when the cookie is missing or tampered with', async () => {
    expect(await getRememberedAccount(new Request('http://localhost/'))).toBeNull()
    const setCookie = await rememberAccount(ACCOUNT)
    const [pair] = setCookie!.split(';')
    const tampered = pair.slice(0, -2) + (pair.endsWith('A') ? 'BB' : 'AA')
    expect(await getRememberedAccount(requestWith(tampered))).toBeNull()
  })
})
