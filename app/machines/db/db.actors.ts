import { fromPromise } from 'xstate'
import { toFileHash } from '@/utils/file-hash'
import {
  dbHashInput,
  dbHashOutput,
  dbItemPayload,
  dbResponse,
} from '@/schemas/machine.schemas'
import type {
  DbHashInput,
  DbHashOutput,
  DbItemPayload,
  DbResponse,
} from '@/types/machine.types'
import { toFormData } from './db.utils'

/**
 * Waits for the content hash the hash worker started when the file was queued.
 *
 * The one genuinely asynchronous part of building a payload, so it is the one
 * part that is an actor. `toFileHash` gives up after a short grace rather than
 * holding item creation open — an absent hash is stored as null and only costs
 * that duplicate group its `exact` verdict, so a missing hash resolves rather
 * than rejects.
 *
 * Validation is `parseAsync` rather than `parse`. Both behave identically on
 * today's schemas, but `parse` throws `Encountered Promise during synchronous
 * parse` the moment a schema gains an async refinement — and these schemas are
 * exported, so that is someone else's edit to make. Inside an already-async
 * actor the insurance costs 0.004 ms per call (measured, zod 4.6.4).
 *
 * @param input.mediaFileId - Key the hash job was registered under.
 */
export const resolveHash = fromPromise<DbHashOutput, DbHashInput>(
  async ({ input }) => {
    const { mediaFileId } = await dbHashInput.parseAsync(input)
    return await dbHashOutput.parseAsync({ hash: await toFileHash(mediaFileId) })
  }
)

/**
 * POSTs a validated payload and flattens the response to plain data.
 *
 * **The body is read as text, never as JSON.** `POST /api/items` answers an
 * expired session with `throw redirect('/auth/sign-in')`, and `fetch` follows
 * redirects by default — so the client is handed a **200 carrying HTML**, not
 * a 302. Calling `res.json()` here would throw `SyntaxError: Unexpected token
 * '<'` from inside the request step, where it reads as a transport failure.
 * Reading text leaves the verdict to `toOutcome`, which can tell the two
 * apart.
 *
 * Only a genuine transport failure rejects.
 *
 * Validation is `parseAsync` for the same reason as `resolveHash`: identical
 * today, but immune to a schema later gaining an async refinement.
 *
 * @param input - The payload from `toItemPayload`, re-validated before it goes
 *   on the wire. The re-check is not redundant — the payload arrives on an
 *   event, and an event can be sent by anyone holding a ref to this machine.
 */
export const postItem = fromPromise<DbResponse, DbItemPayload>(
  async ({ input, signal }) => {
    const payload = await dbItemPayload.parseAsync(input)

    // `signal` is aborted when this actor is stopped, which now happens when
    // the upload manager's Provider unmounts — leaving the app cancels the
    // request instead of letting it land after the queue is gone.
    const res = await fetch('/api/items', {
      method: 'POST',
      body: toFormData(payload),
      signal,
      // Behind metadata saves, like the upload's other calls (tech-debt 53).
      priority: 'low',
    })

    return await dbResponse.parseAsync({
      status: res.status,
      ok: res.ok,
      redirected: res.redirected,
      url: res.url,
      contentType: res.headers.get('content-type') ?? '',
      body: await res.text(),
    })
  }
)
