import { describe, expect, it, vi } from 'vitest'
import { forwardSetCookies, needsOnboardingFields, withOnboardingFields } from '@/services/session-user'

/**
 * With the session cookie cache on, a new user's cached session predates
 * onboarding: no bucket, root or drive. The fallback reads them from the
 * database for that case only, so every other cached read stays query-free.
 */
const onboarded = { id: 'usr_1', bucket: 'stashly-usr-1', rootId: 'item_root', driveId: 'drv_1' }
const stored = { bucket: 'stashly-usr-1', rootId: 'item_root', driveId: 'drv_1' }

describe('withOnboardingFields', () => {
  it('reads nothing for an onboarded user', async () => {
    const read = vi.fn()
    expect(await withOnboardingFields(onboarded, read)).toBe(onboarded)
    expect(read).not.toHaveBeenCalled()
  })

  it.each([
    ['the placeholder bucket', { bucket: 'default-bucket' }],
    ['no bucket', { bucket: null }],
    ['no root', { rootId: null }],
    ['no drive', { driveId: undefined }],
  ])('fills the fields from the database for a user with %s', async (_, missing) => {
    const user = { ...onboarded, ...missing, name: 'New user' }
    const read = vi.fn(async () => stored)
    expect(await withOnboardingFields(user, read)).toEqual({ ...onboarded, name: 'New user' })
    expect(read).toHaveBeenCalledWith('usr_1')
  })

  it('returns the session user unchanged when the row is gone', async () => {
    const user = { ...onboarded, bucket: 'default-bucket' }
    expect(await withOnboardingFields(user, async () => null)).toBe(user)
  })
})

describe('needsOnboardingFields', () => {
  it('is false only when bucket, root and drive are all real', () => {
    expect(needsOnboardingFields(onboarded)).toBe(false)
    expect(needsOnboardingFields({ ...onboarded, bucket: 'default-bucket' })).toBe(true)
  })
})

describe('forwardSetCookies', () => {
  const refreshed = () => {
    const headers = new Headers()
    headers.append('set-cookie', 'better-auth.session_data=abc; Path=/; Max-Age=300')
    return headers
  }

  it('copies the refreshed cache cookie onto the response', () => {
    const response = forwardSetCookies(new Response('ok'), refreshed())
    expect(response.headers.getSetCookie()).toEqual(['better-auth.session_data=abc; Path=/; Max-Age=300'])
  })

  it('keeps cookies the route already set', () => {
    const response = new Response('ok', { headers: { 'set-cookie': 'color-scheme=dark; Path=/' } })
    forwardSetCookies(response, refreshed())
    expect(response.headers.getSetCookie()).toHaveLength(2)
  })

  it('returns a response with immutable headers untouched', () => {
    const response = Response.redirect('http://localhost/auth/sign-in', 302)
    expect(forwardSetCookies(response, refreshed())).toBe(response)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('leaves the response alone when nothing was refreshed', () => {
    const response = new Response('ok')
    expect(forwardSetCookies(response, new Headers())).toBe(response)
  })
})
