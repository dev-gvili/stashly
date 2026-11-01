import { describe, it, expect, vi, afterEach } from 'vitest'
import { createActor, setup, assign, type AnyActorRef } from 'xstate'
import { dbMachine } from '../db.machine'
import { toItemPayload, toFormData, toOutcome } from '../db.utils'
import type { DbResponse } from '@/types/machine.types'

const user = {
  id: 'usr_1',
  bucket: 'bucket-1',
  driveId: 'drv_1',
} as unknown as Parameters<typeof toItemPayload>[1]

const mediaFile = (over: Record<string, unknown> = {}) =>
  ({
    id: 'mf_1',
    file: new File(['x'], 'photo.png', { type: 'image/png' }),
    key: 'fld_root/mf_1/photo.png',
    uploadPath: 'fld_root/nested/photo.png',
    progress: {},
    status: 'done',
    etag: 'etag-1',
    uploadId: 'up-1',
    ...over,
  }) as unknown as Parameters<typeof toItemPayload>[0]

const response = (over: Partial<DbResponse> = {}): DbResponse => ({
  status: 200,
  ok: true,
  redirected: false,
  url: '/api/items',
  contentType: 'application/json',
  body: JSON.stringify({ success: true }),
  ...over,
})

/**
 * A stand-in for the upload manager: records what it is told and, crucially,
 * stays running. Every assertion on `status` below is really asking "did a
 * failed write take the queue down with it".
 */
const recorder = setup({
  types: { context: {} as { replies: { type: string; error?: string }[] } },
}).createMachine({
  context: { replies: [] },
  initial: 'up',
  states: {
    up: {
      on: {
        '*': {
          actions: assign(({ context, event }) => ({
            replies: [...context.replies, event as { type: string }],
          })),
        },
      },
    },
  },
})

/** Runs one creation against a stubbed `fetch` and returns what the parent saw. */
async function create(
  fetchImpl: typeof fetch,
  file = mediaFile(),
  existing?: { db: AnyActorRef; parent: ReturnType<typeof createActor> }
) {
  vi.stubGlobal('fetch', withQuota(fetchImpl))
  const parent = existing?.parent ?? createActor(recorder).start()
  const db =
    existing?.db ??
    createActor(dbMachine, { input: { replayTo: parent } }).start()

  db.send({ type: '@db.item.create', mediaFile: file, user })
  await vi.waitFor(() =>
    expect(parent.getSnapshot().context.replies.length).toBeGreaterThan(
      existing ? 1 : 0
    )
  )

  const replies = parent.getSnapshot().context.replies
  return {
    db,
    parent,
    reply: replies[replies.length - 1],
    parentStatus: parent.getSnapshot().status,
    dbState: String(db.getSnapshot().value),
  }
}

const respondWith = (over: Partial<DbResponse> = {}) =>
  (async () => {
    const r = response(over)
    return {
      status: r.status,
      ok: r.ok,
      redirected: r.redirected,
      url: r.url,
      headers: { get: () => r.contentType },
      text: async () => r.body,
    }
  }) as unknown as typeof fetch

const quotaBody = {
  id: 'qta_1',
  driveId: 'drv_1',
  deleted: 0,
  total: 100,
  used: 1,
  remaining: 99,
  status: 'normal',
}

/** Every `/api/quota` request this test made, as the JSON body it sent. */
let quotaCalls: { action: string; dataSize: number; userId: string }[] = []

/**
 * Serves `/api/quota` from `quota` and everything else from `items`, recording
 * each quota request so a test can assert that none was made.
 */
function withQuota(
  items: typeof fetch,
  quota: () => Promise<unknown> = async () => ({ json: async () => quotaBody })
) {
  return (async (url: string, init?: RequestInit) => {
    if (url !== '/api/quota') return items(url, init)
    quotaCalls.push(JSON.parse(String(init?.body)))
    return quota()
  }) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
  quotaCalls = []
})

describe('toOutcome', () => {
  it('reads a followed redirect as an expired session', () => {
    // `fetch` follows redirects, so the sign-in page arrives as a 200 with
    // HTML. `redirected` is the only signal that the API was never reached.
    const out = toOutcome(
      response({ redirected: true, url: '/auth/sign-in', contentType: 'text/html' }),
      'mf_1'
    )
    expect(out.type).toBe('@db.session.expired')
  })

  it('reads a non-2xx as rejected, with the status in the message', () => {
    const out = toOutcome(response({ ok: false, status: 500 }), 'mf_1')
    expect(out.type).toBe('@db.item.rejected')
    expect(out).toHaveProperty('error', expect.stringContaining('500'))
  })

  it('reads a 200 that is not JSON as failed', () => {
    const out = toOutcome(
      response({ contentType: 'text/html', body: '<!DOCTYPE html>' }),
      'mf_1'
    )
    expect(out.type).toBe('@db.item.failed')
  })

  it('reads an unparseable JSON body as failed rather than throwing', () => {
    expect(() =>
      toOutcome(response({ body: 'not json' }), 'mf_1')
    ).not.toThrow()
    expect(toOutcome(response({ body: 'not json' }), 'mf_1').type).toBe(
      '@db.item.failed'
    )
  })

  it('reads success:false as refused and carries the server message', () => {
    const out = toOutcome(
      response({ body: JSON.stringify({ success: false, error: 'quota exceeded' }) }),
      'mf_1'
    )
    expect(out.type).toBe('@db.item.refused')
    expect(out).toHaveProperty('error', 'quota exceeded')
  })

  it('reads success:true as created', () => {
    expect(toOutcome(response(), 'mf_1').type).toBe('@db.item.created')
  })
})

describe('toItemPayload', () => {
  it("takes the destination root from the upload path's first segment", () => {
    // The middle segments are resolved into folders server-side, so the
    // client sends the root and `createUploadedItem` re-parents the item.
    expect(toItemPayload(mediaFile(), user).parentId).toBe('fld_root')
  })

  it('sends the object key and the upload path apart', () => {
    expect(toItemPayload(mediaFile(), user)).toMatchObject({
      key: 'fld_root/mf_1/photo.png',
      uploadPath: 'fld_root/nested/photo.png',
    })
  })

  it('normalises an absent hash away instead of sending an empty string', () => {
    expect(toItemPayload(mediaFile(), user, '').hash).toBeUndefined()
    expect(toItemPayload(mediaFile(), user, 'sha-1').hash).toBe('sha-1')
  })

  it('rejects a payload the API would reject, before the request', () => {
    const fractional = mediaFile({
      file: { name: 'p.png', type: 'image/png', size: 1.5 },
    })
    expect(() => toItemPayload(fractional, user)).toThrow()
  })
})

describe('toFormData', () => {
  it('carries the intent and stringifies a bigint size', () => {
    const form = toFormData(toItemPayload(mediaFile(), user))
    expect(form.get('intent')).toBe('create_upload_item')
    expect(form.get('size')).toBe('1')
  })

  it('omits absent optional fields rather than sending empty strings', () => {
    const form = toFormData(toItemPayload(mediaFile({ etag: undefined }), user))
    expect(form.has('etag')).toBe(false)
  })
})

describe('dbMachine', () => {
  it('reports success and returns to idle', async () => {
    const { reply, dbState, parentStatus } = await create(respondWith())
    expect(reply.type).toBe('upload.createItem.success')
    expect(dbState).toBe('idle')
    expect(parentStatus).toBe('active')
  })

  // The page inserts this row instead of reloading the folder (item 45).
  it('passes the row the server answered with on to the manager', async () => {
    const item = { id: 'mf_1', name: 'photo.png', size: 1 }
    const { reply } = await create(respondWith({ body: JSON.stringify({ success: true, item }) }))
    expect(reply).toMatchObject({ type: 'upload.createItem.success', mediaFileId: 'mf_1', item })
  })

  it.each([
    ['an expired session', { redirected: true, contentType: 'text/html' }],
    ['a 500', { ok: false, status: 500 }],
    ['an HTML body', { contentType: 'text/html', body: '<html>' }],
    ['an unparseable body', { body: 'not json' }],
    ['a refusal', { body: JSON.stringify({ success: false, error: 'nope' }) }],
  ])('reports %s as an error and leaves the parent running', async (_l, over) => {
    const { reply, parentStatus, dbState } = await create(
      respondWith(over as Partial<DbResponse>)
    )
    expect(reply.type).toBe('upload.createItem.error')
    expect(parentStatus).toBe('active')
    expect(dbState).toBe('idle')
  })

  it('reports a transport failure without rejecting', async () => {
    const { reply, parentStatus } = await create((async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch)

    expect(reply.type).toBe('upload.createItem.error')
    expect(reply).toHaveProperty('error', expect.stringContaining('Failed to fetch'))
    expect(parentStatus).toBe('active')
  })

  it('reports an invalid payload without ever making the request', async () => {
    const fetchSpy = vi.fn()
    const { reply, parentStatus } = await create(
      fetchSpy as unknown as typeof fetch,
      mediaFile({ file: undefined })
    )

    expect(reply.type).toBe('upload.createItem.error')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(parentStatus).toBe('active')
  })

  /**
   * The regression this machine exists for. The promise actor it replaces
   * ended its `catch` with `throw err`; a spawned actor's unhandled rejection
   * stops its parent, so the first file that could not get a row stopped the
   * upload manager and every later file silently lost its row too.
   */
  it('still works after a failure, and the parent never stopped', async () => {
    const first = await create((async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch)

    expect(first.reply.type).toBe('upload.createItem.error')
    expect(first.parentStatus).toBe('active')

    const second = await create(respondWith(), mediaFile({ id: 'mf_2' }), {
      db: first.db,
      parent: first.parent,
    })

    expect(second.reply.type).toBe('upload.createItem.success')
    expect(second.reply).toHaveProperty('mediaFileId', 'mf_2')
    expect(second.parentStatus).toBe('active')
  })

  it('does not fail when nothing is listening', async () => {
    vi.stubGlobal('fetch', withQuota(respondWith()))
    const db = createActor(dbMachine, { input: {} }).start()
    db.send({ type: '@db.item.create', mediaFile: mediaFile(), user })

    await vi.waitFor(() => expect(String(db.getSnapshot().value)).toBe('idle'))
    expect(db.getSnapshot().status).toBe('active')
  })
})

/**
 * The server charges quota inside the transaction that creates the row
 * (`createUploadedItem`). This machine must never post a charge of its own:
 * that was the client-side `items-uploaded` request, which a client could skip
 * or forge, and which `/api/quota` no longer accepts.
 */
describe('dbMachine quota', () => {
  it.each([
    ['a created row', {}],
    ['an expired session', { redirected: true, contentType: 'text/html' }],
    ['a 500', { ok: false, status: 500 }],
    ['a refusal', { body: JSON.stringify({ success: false, error: 'nope' }) }],
  ])('never posts a quota charge after %s', async (_l, over) => {
    await create(respondWith(over as Partial<DbResponse>))
    expect(quotaCalls).toEqual([])
  })
})
