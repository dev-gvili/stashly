import { toCategory } from '@/utils/converters'
import { dbItemPayload } from '@/schemas/machine.schemas'
import type {
  DbEvents,
  DbItemPayload,
  DbOutcomeEvents,
  DbResponse,
  MediaFile,
} from '@/types/machine.types'

type Owner = Extract<DbEvents, { type: '@db.item.create' }>['user']

/**
 * Builds the payload `createUploadedItem` takes, validated against the same
 * schema the route parses it with.
 *
 * Synchronous on purpose. The hash is resolved by its own step and handed in,
 * so nothing here has to be awaited — assembling fields is not I/O and does
 * not belong behind a promise.
 *
 * @param mediaFile - The finished upload, carrying key, etag and size.
 * @param user - The owner, for bucket and drive routing.
 * @param hash - Content hash, absent when the browser could not finish one.
 * @throws ZodError when a field the API requires is missing or malformed.
 *
 * @example
 * toItemPayload(mediaFile, user, 'sha256-…')
 * // → { id, name, key, uploadPath, size: 12n, bucket, driveId, parentId, … }
 */
export function toItemPayload(
  mediaFile: MediaFile,
  user: Owner,
  hash?: string
): DbItemPayload {
  return dbItemPayload.parse({
    id: mediaFile.id,
    name: mediaFile.file.name,
    key: mediaFile.key,
    uploadPath: mediaFile.uploadPath,
    size: mediaFile.file.size,
    mimeType: mediaFile.file.type || undefined,
    etag: mediaFile.etag,
    hash: hash || undefined,
    bucket: user.bucket,
    driveId: user.driveId,
    // The folder `addBatch` resolved for it, when it did. Otherwise the upload
    // path's first segment, the destination root: `createUploadedItem` then
    // resolves its middle segments into folders and re-parents the item.
    parentId: mediaFile.parentId ?? mediaFile.uploadPath.split('/')[0],
    ownerId: mediaFile.ownerId ?? user.id,
    category: toCategory(mediaFile.file),
    uploadId: mediaFile.uploadId ?? '',
  })
}

/**
 * Serialises a validated payload for `POST /api/items`, which reads its body
 * with `parseFormData`.
 *
 * @example
 * toFormData({ id: 'item_…', size: 12n }) // → FormData with size='12'
 */
export function toFormData(payload: DbItemPayload): FormData {
  const form = new FormData()
  form.append('intent', 'create_upload_item')

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue
    form.append(key, String(value))
  }

  return form
}

/**
 * Decides how a run ended, and says so as the event the machine will raise.
 *
 * Synchronous, total, and the only place a verdict is reached — which is the
 * point. The promise actor this replaces let `res.json()` throw from inside
 * the request step, so an expired session and a dead socket arrived as the
 * same failure.
 *
 * @param response - The flattened response from `postItem`.
 * @param mediaFileId - Echoed back so the parent can match the answer.
 *
 * @example
 * toOutcome({ redirected: true, url: '/auth/sign-in', … }, 'mf_1')
 * // → { type: '@db.session.expired', mediaFileId: 'mf_1', error: '…' }
 */
export function toOutcome(
  response: DbResponse,
  mediaFileId: string
): DbOutcomeEvents {
  // `fetch` follows redirects by default, so an expired session arrives as a
  // 200 carrying the sign-in page — `redirected` is the only honest signal
  // that the request never reached the API.
  if (response.redirected) {
    return {
      type: '@db.session.expired',
      mediaFileId,
      error: `Signed out during upload — /api/items redirected to ${response.url}`,
    }
  }

  if (!response.ok) {
    return {
      type: '@db.item.rejected',
      mediaFileId,
      error: `Item creation failed with status ${response.status}`,
    }
  }

  if (!response.contentType.includes('json')) {
    return {
      type: '@db.item.failed',
      mediaFileId,
      error: `Item creation expected JSON but the server sent ${
        response.contentType || 'no content type'
      }`,
    }
  }

  let envelope: { success?: boolean; error?: string }
  try {
    envelope = JSON.parse(response.body)
  } catch {
    return {
      type: '@db.item.failed',
      mediaFileId,
      error: `Item creation returned a body that is not JSON: ${response.body.slice(0, 80)}`,
    }
  }

  return envelope?.success === true
    ? { type: '@db.item.created', mediaFileId }
    : {
        type: '@db.item.refused',
        mediaFileId,
        error: envelope?.error ?? 'Item creation failed',
      }
}
