import { describe, it, expect } from 'vitest'
import { StashlyError, StashlyErrorCode, toErrorInfo } from '../api.errors'

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
