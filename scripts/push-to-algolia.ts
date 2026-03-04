// scripts/push-to-algolia.mjs
import { config } from '@dotenvx/dotenvx'
import { algoliasearch, type IndexSettings } from 'algoliasearch'
import pLimit from 'p-limit'
import {
  Prisma,
  PrismaClient,
  type Thumbnail,
} from '../app/.server/prisma/client'
import settings from './algolia-settings.json' assert { type: 'json' }
import { inspect } from 'node:util'

config() // Load .env file

const prisma = new PrismaClient()

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY
const INDEX_NAME = process.env.ALGOLIA_INDEX || 'items_index'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10)
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10)

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  console.error('Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_KEY in env')
  process.exit(1)
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY)
const limit = pLimit(CONCURRENCY)

function formatBytes(n: bigint | number | null | undefined) {
  if (n === null || n === undefined || isNaN(Number(n))) return '0 B'
  let val = Number(n)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let u = 0
  while (val >= 1024 && u < units.length - 1) {
    val /= 1024
    u++
  }
  return `${Math.round(val * 10) / 10} ${units[u]}`
}

async function fetchItems(cursorId: string | null) {
  const take = BATCH_SIZE
  return prisma.item.findMany({
    take,
    skip: cursorId ? 1 : 0,
    cursor: cursorId ? { id: cursorId } : undefined,
    orderBy: { id: 'asc' },
    include: {
      file: true,
      folder: true,
      image: true,
      video: true,
      audio: true,
      thumbnails: true,
      collection: true,
      collectionItems: { include: { collection: true } },
      owner: { select: { id: true } },
      workspace: { select: { id: true, name: true } },
      drive: { select: { id: true, name: true } },
      children: true,
      locked: true,
      favoritedBy: true,
      trash: true,
    },
  })
}

function pickPrimaryMedia(
  item: Prisma.ItemGetPayload<{
    include: {
      file: true
      folder: true
      image: true
      video: true
      audio: true
      collection: true
      thumbnails: true
    }
  }>
) {
  if (item.image) return { type: 'image', id: item.image.id, title: item.name }
  if (item.video) return { type: 'video', id: item.video.id, title: item.name }
  if (item.audio)
    return {
      type: 'audio',
      id: item.audio.id,
      title: item.audio.title || item.name,
    }
  if (item.file) return { type: 'file', id: item.file.id, title: item.name }
  if (item.folder)
    return { type: 'folder', id: item.folder.id, title: item.name }
  if (item.collection)
    return {
      type: 'collection',
      id: item.collection.id,
      title: item.collection.name,
    }
  return { type: 'generic', id: null, title: item.name }
}

/**
 * Picks the URLs for small, medium, and large thumbnails from a list of Thumbnail objects.
 *
 * @param {Thumbnail[]} thumbnails - An array of thumbnail objects, each potentially having a 'size' and 'url' property.
 * @returns An object containing the URLs for each thumbnail size, or null if not found.
 */
function pickThumbnailUrls(thumbnails: Thumbnail[]) {
  let out: {
    small: string | null
    medium: string | null
    large: string | null
  } = { small: null, medium: null, large: null }
  if (!Array.isArray(thumbnails)) return out
  for (const t of thumbnails) {
    if (!t || !t.size) continue
    if (t.size === 'small') {
      out.small = t.url || out.small
    }
    if (t.size === 'medium') out.medium = t.url || out.medium
    if (t.size === 'large') out.large = t.url || out.large
    if (out.small && out.medium && out.large) break
  }
  return out
}

function toAlgoliaObject(
  item: Prisma.ItemGetPayload<{
    include: {
      file: true
      folder: true
      image: true
      video: true
      audio: true
      collection: true
      thumbnails: true
      collectionItems: { include: { collection: true } }
      owner: { select: { id: true } }
      workspace: { select: { id: true; name: true } }
      drive: { select: { id: true; name: true } }
      locked: true
      favoritedBy: true
      trash: true
    }
  }>
) {
  /**
   * Primary media is determined by the following precedence:
   * 1. Image
   * 2. Photo
   * 3. Video
   * 4. Audio
   * 5. File
   * 6. Folder
   * 7. Collection
   * 8. Generic (no specific media)
   * This is used to help with sorting and filtering in Algolia.
   * E.g., an item with an image is more "media-rich" than one with just a file.
   */
  const primary = pickPrimaryMedia(item)
  /**
   * Thumbnails: We pick small, medium, and large URLs if available.
   * These can be used in search results to provide visual context.
   * If no thumbnails are available, the fields will be null.
   * The actual thumbnail generation and storage is handled elsewhere in the app.
   * We just pick the URLs here for indexing.
   * @see {@link pickThumbnailUrls} for details.
   */
  const thumbs = pickThumbnailUrls(item.thumbnails || [])
  /** Collection IDs: An item can belong to multiple collections.
   * We store an array of collection IDs for filtering purposes.
   * The main collectionId field is the primary collection, if any.
   * This allows users to filter items by collection in Algolia.
   * @see {@link item.collections} for details.
   */
  const collectionIds = (item.collectionItems || []).map(
    (ci) => ci.collectionId
  )
  /**
   * Boolean flags for media types: These help with filtering.
   * E.g., hasImage, hasVideo, hasAudio, hasFile, hasFolder, hasCollection.
   * This allows users to quickly filter for items that have specific media types.
   * E.g., show me all items that have images.
   */
  const hasImage = !!item.image
  /**
   * Has video, audio, file, folder, collection flags.
   * These are simple boolean flags to indicate the presence of these media types.
   * They can be used for filtering in search.
   * E.g., show me all items that have videos.
   */
  const hasVideo = !!item.video
  /**
   * Has audio flag indicates if the item has an associated audio record.
   * This is useful for filtering items that contain audio content.
   * E.g., show me all items that have audio files.
   */
  const hasAudio = !!item.audio
  /**
   * Has file flag indicates if the item has an associated file.
   * This is useful for filtering items that contain file content.
   * E.g., show me all items that have files.
   */
  const hasFile = !!item.file
  /**
   * Has folder flag indicates if the item is a folder.
   * This is useful for filtering items that are folders.
   * E.g., show me all items that are folders.
   */
  const hasFolder = !!item.folder
  /** Has collection flag indicates if the item is a collection.
   * This is useful for filtering items that are collections.
   * E.g., show me all items that are collections.
   */
  const hasCollection = !!item.collection
  /**
   * Item count is the number of child items if this item is a folder.
   * If not a folder, item count is 0.
   */
  const itemCount = item.folder ? item.folder.childCount : null
  /**
   * Popularity is a simple metric to help with ranking.
   * It is calculated as:
   * - 1 point for each child item (if folder)
   * - 1 point if it has a file, image, video, or audio associated
   */
  const popularity =
    (itemCount || 0) +
    (item.file || item.image || item.video || item.audio ? 1 : 0)

  return {
    objectID: `stashly:items:${item.id}`,
    id: item.id,
    name: item.name,
    path: item.path,
    type: item.type,
    category: item.category,
    status: item.status,
    size: item.size ? Number(item.size) : 0,
    size_human: formatBytes(item.size),
    primaryMediaType: primary.type,
    primaryMediaId: primary.id,
    primaryTitle: primary.title || null,
    thumbnail_small: thumbs.small,
    thumbnail_medium: thumbs.medium,
    thumbnail_large: thumbs.large,
    hasImage,
    hasVideo,
    hasAudio,
    hasFile,
    hasFolder,
    hasCollection,
    locked: !!item.locked,
    favorited: Array.isArray(item.favoritedBy) && item.favoritedBy.length > 0,
    trashed: !!item.trash,
    extension: item.file?.extension || null,
    mimeType: item.file?.mimeType || null,
    duration: item.audio?.duration || item.video?.duration || null,
    width: item.image?.width || item.video?.width || null,
    height: item.image?.height || item.video?.height || null,
    itemCount,
    collectionIds,
    collectionId: item.collection?.id || null,
    collectionName: item.collection?.name || null,
    ownerId: item.ownerId,
    workspaceId: item.workspaceId || null,
    driveId: item.driveId,
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
    popularity,
  }
}

async function saveObjectsToIndex(objects: any[]) {
  // algoliasearch client's saveObjects signature expects { indexName, objects }
  return client.saveObjects({ indexName: INDEX_NAME, objects })
}

async function pushBatch(records: any[]) {
  if (!records.length) return
  await saveObjectsToIndex(records)
  console.log(
    `Pushed ${records.length} objects (last objectID=${
      records[records.length - 1].objectID
    })`
  )
}

export async function run() {
  console.log('Applying settings to Algolia index:', INDEX_NAME)
  await client.setSettings({
    indexName: INDEX_NAME,
    indexSettings: settings as IndexSettings,
  })
  console.log('Settings applied successfully.')

  console.log('Starting push to Algolia index:', INDEX_NAME)
  let cursor = null
  let total = 0
  let objectShape: ReturnType<typeof toAlgoliaObject> | null = null

  while (true) {
    const items = await fetchItems(cursor)
    if (!items || items.length === 0) break
    const objects = items.map(toAlgoliaObject)
    await Promise.all([limit(() => pushBatch(objects))])
    total += objects.length
    cursor = items[items.length - 1].id
    if (items.length < BATCH_SIZE) {
      objectShape = objects[0] || null
      break
    }
  }
  console.log('Finished. Total objects pushed:', total)

  console.log(inspect(objectShape, { colors: true, depth: null }))

  console.log('Disconnecting from database.')
  await prisma.$disconnect()
}

// run when executed directly
if (process.argv[1].endsWith('push-to-algolia.ts')) {
  run().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
