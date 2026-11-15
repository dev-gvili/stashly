import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import {
  METADATA_BACKFILL_MAX_AUDIO_BYTES,
  findMetadataBackfillCandidates,
} from '@/services/search-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The backfill asks for the caller's own videos and audio files that have no
 * facet row. It must list exactly those: a file that has one is done, and
 * someone else's file or a trashed one is never handed out. Needs a live
 * database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let otherId: string
let driveId: string
let otherDriveId: string
const ids: Record<string, string> = {}

async function makeFile(
  key: string,
  opts: {
    category: 'video' | 'audio'
    size: number
    owner?: 'me' | 'other'
    status?: 'normal' | 'trashed'
    facet?: boolean
  }
) {
  const id = uid('Item')
  const mine = (opts.owner ?? 'me') === 'me'
  await prisma.item.create({
    data: {
      id,
      name: `${key}.${opts.category === 'video' ? 'mkv' : 'mp3'}`,
      type: 'file',
      category: opts.category,
      status: opts.status ?? 'normal',
      ownerId: mine ? ownerId : otherId,
      driveId: mine ? driveId : otherDriveId,
      parentId: null,
      size: opts.size,
      file: {
        create: {
          id: uid('File'),
          mimeType: opts.category === 'video' ? 'video/matroska' : 'audio/mpeg',
          bucket: 'stashly-test-bucket',
          key: `root/${id}/${key}`,
          uploadPath: `root/${key}`,
        },
      },
    },
  })
  if (opts.facet) {
    if (opts.category === 'video') {
      await prisma.video.create({
        data: { id: uid('Video'), itemId: id, width: 1 },
      })
    } else {
      await prisma.audio.create({
        data: { id: uid('Audio'), itemId: id, duration: 1 },
      })
    }
  }
  ids[key] = id
}

beforeAll(async () => {
  ownerId = uid('User')
  otherId = uid('User')
  for (const [id, label] of [
    [ownerId, 'owner'],
    [otherId, 'other'],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        name: `Backfill ${label}`,
        email: `backfill-${id}@test.local`,
        emailVerified: true,
      },
    })
  }
  driveId = uid('Drive')
  otherDriveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  await prisma.drive.create({ data: { id: otherDriveId, ownerId: otherId } })

  await makeFile('video-bare', { category: 'video', size: 40_000_000 })
  await makeFile('video-done', { category: 'video', size: 5_000, facet: true })
  await makeFile('video-trashed', {
    category: 'video',
    size: 5_000,
    status: 'trashed',
  })
  await makeFile('video-theirs', {
    category: 'video',
    size: 5_000,
    owner: 'other',
  })
  await makeFile('video-empty', { category: 'video', size: 0 })
  await makeFile('audio-bare', { category: 'audio', size: 3_000_000 })
  await makeFile('audio-done', {
    category: 'audio',
    size: 3_000_000,
    facet: true,
  })
  await makeFile('audio-huge', {
    category: 'audio',
    size: METADATA_BACKFILL_MAX_AUDIO_BYTES + 1,
  })
})

afterAll(async () => {
  await wipeTestUsers([ownerId, otherId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
})

describe('findMetadataBackfillCandidates', () => {
  it('lists the caller’s own files that have no facet, with a signed URL', async () => {
    const found = await findMetadataBackfillCandidates(ownerId, null, 50)
    expect(found.map((c) => c.id).sort()).toEqual(
      [ids['video-bare'], ids['audio-bare']].sort()
    )
    const video = found.find((c) => c.id === ids['video-bare'])!
    expect(video).toMatchObject({
      kind: 'video',
      size: 40_000_000,
      mimeType: 'video/matroska',
    })
    // A video has no size cap (it is read from its header); the URL is signed.
    expect(new URL(video.url).searchParams.get('X-Amz-Signature')).toBeTruthy()
  })

  it('continues after a cursor, oldest id first', async () => {
    const all = await findMetadataBackfillCandidates(ownerId, null, 50)
    const first = await findMetadataBackfillCandidates(ownerId, null, 1)
    expect(first.map((c) => c.id)).toEqual([all[0].id])
    const rest = await findMetadataBackfillCandidates(ownerId, first[0].id, 50)
    expect(rest.map((c) => c.id)).toEqual(all.slice(1).map((c) => c.id))
  })
})
