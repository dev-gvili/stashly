import { describe, it, expect } from 'vitest'
import { parseOrRespond, rethrowAsResponse, StashlyError, StashlyErrorCode, toErrorInfo } from '../api.errors'

describe('toErrorInfo', () => {
  it('reads the status off a StashlyError', () => {
    const err = new StashlyError(StashlyErrorCode.ITEM_NOT_FOUND)
    expect(toErrorInfo(err).status).toBe(404)
  })

  it('reads statusCode off an ad-hoc guard error', () => {
    const err: any = new Error('forbidden')
    err.statusCode = 403
    expect(toErrorInfo(err)).toEqual({ status: 403, message: 'forbidden' })
  })

  it('prefers status when both fields are present', () => {
    const err: any = new Error('boom')
    err.status = 409
    err.statusCode = 403
    expect(toErrorInfo(err).status).toBe(409)
  })

  it('omits the status for an untyped error so callers fall back', () => {
    expect(toErrorInfo(new Error('plain'))).toEqual({
      status: undefined,
      message: 'plain',
    })
  })

  it('ignores values outside the HTTP error range', () => {
    const err: any = new Error('weird')
    err.status = 200
    expect(toErrorInfo(err).status).toBeUndefined()

    const bogus: any = new Error('weird')
    bogus.statusCode = 'no'
    expect(toErrorInfo(bogus).status).toBeUndefined()
  })

  it('survives non-error throws', () => {
    expect(toErrorInfo(undefined)).toEqual({
      status: undefined,
      message: undefined,
    })
    expect(toErrorInfo('a string')).toEqual({
      status: undefined,
      message: undefined,
    })
  })
})
describe('rethrowAsResponse and parseOrRespond', () => {
  const invalid = () => {
    throw new StashlyError(StashlyErrorCode.INVALID_INPUT, 'itemId is required')
  }
  const thrown = (fn: () => unknown) => {
    try {
      fn()
    } catch (e) {
      return e as { data: unknown; init: { status: number } }
    }
    throw new Error('did not throw')
  }

  it('answers the parser error as 400 JSON, or as text for a page loader', () => {
    expect(thrown(() => parseOrRespond(invalid))).toMatchObject({
      data: { success: false, error: 'itemId is required' },
      init: { status: 400 },
    })
    expect(thrown(() => parseOrRespond(invalid, 'text'))).toMatchObject({
      data: 'itemId is required',
      init: { status: 400 },
    })
  })

  it('returns the parsed value when the parser succeeds', () => {
    expect(parseOrRespond(() => 42)).toBe(42)
  })

  // A handler whose parse sits inside a try sends the thrown response through
  // toErrorInfo in its catch; status and message must both survive that.
  it('keeps status and message when a catch block reads it with toErrorInfo', () => {
    const e = thrown(() => rethrowAsResponse(new StashlyError(StashlyErrorCode.INVALID_INPUT, 'bad intent')))
    expect(toErrorInfo(e)).toEqual({ status: 400, message: 'bad intent' })
  })
})
