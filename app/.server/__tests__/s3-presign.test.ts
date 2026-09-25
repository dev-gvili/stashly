import { describe, it, expect } from 'vitest'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { signGetObjectUrl } from '../s3'

/**
 * `signGetObjectUrl` replaces the AWS SDK presigner on the GET path because
 * the SDK's signing held Node's event loop long enough to starve Postgres.
 * The replacement is only safe if the store cannot tell the two apart — so
 * this pins its signature to the SDK's, byte for byte, across the inputs that
 * trip SigV4 implementations up: spaces, parentheses, reserved characters,
 * non-ASCII, and the response-* overrides the app relies on.
 */

const creds = {
  accessKeyId: 'tid_TESTACCESSKEY',
  secretAccessKey: 'tsec_TestSecretKey/with+special=chars',
}
const region = 'auto'
const endpointHost = 'fly.storage.tigris.dev'
const sdk = new S3Client({
  region,
  endpoint: `https://${endpointHost}`,
  credentials: creds,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const date = new Date('2026-09-24T02:00:00.000Z')
const bucket = 'stashly-test-abc123'

const KEYS = [
  'item_5QruxGRgGZFgiD3502byFQ/Cross-File_Type_Resolution.mp4',
  'item_x/Fixing_Stashly_s_470MB_bug (1).m4a',
  'thumbnails/item_ddgBCu5UC2bjAeKEgTE12w.webp',
  "a/b c/it's!*~.txt",
  'ünïcødé/файл+&=?#%.bin',
]

const OVERRIDES: Array<{ cache?: string; disposition?: string }> = [
  {},
  { cache: 'no-store' },
  {
    cache: 'private, max-age=3600',
    disposition: 'inline; filename="item_x-s2.webp"',
  },
]

describe('signGetObjectUrl', () => {
  for (const key of KEYS) {
    for (const o of OVERRIDES) {
      it(`matches the SDK: ${key} ${JSON.stringify(o)}`, async () => {
        const expected = new URL(
          await getSignedUrl(
            sdk,
            new GetObjectCommand({
              Bucket: bucket,
              Key: key,
              ResponseCacheControl: o.cache,
              ResponseContentDisposition: o.disposition,
            }),
            { expiresIn: 7200, signingDate: date }
          )
        )

        const query: Record<string, string> = {}
        if (o.cache) query['response-cache-control'] = o.cache
        if (o.disposition) query['response-content-disposition'] = o.disposition
        const actual = new URL(
          signGetObjectUrl(
            { ...creds, region, endpointHost },
            { bucket, key, expiresIn: 7200, date, query }
          )
        )

        expect(actual.origin).toBe(expected.origin)
        expect(actual.pathname).toBe(expected.pathname)
        expect(Object.fromEntries(actual.searchParams)).toEqual(
          Object.fromEntries(expected.searchParams)
        )
      })
    }
  }

  it('is deterministic for a fixed date, which is what makes caching exact', () => {
    const sign = () =>
      signGetObjectUrl(
        { ...creds, region, endpointHost },
        { bucket, key: KEYS[0], expiresIn: 7200, date }
      )
    expect(sign()).toBe(sign())
  })
})
