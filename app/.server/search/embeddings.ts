// This updated file incorporates all the improvements: natural language construction for better semantic matching, robust batch/single vector handling, and a clear mapping layer between your Prisma database and the embedding logic.

import { getPipeline } from '../ai.utils'
import type { Prisma } from '@/prisma/browser'

/**
 * 1. VECTOR UTILITIES
 */

/**
 * Converts text into a numeric vector using the Xenova/all-mpnet-base-v2 model.
 * Handles both single strings and arrays of strings (batch processing).
 */
export async function toVector(
  text: string | string[]
): Promise<number[] | number[][]> {
  const extractor = await getPipeline(
    'feature-extraction',
    'Xenova/all-mpnet-base-v2',
    "q4",
    "webgpu"
  )

  // pooling: 'mean' and normalize: true are recommended for all-mpnet-base-v2
  const output = await extractor(text, { pooling: 'mean', normalize: true })

  // If input is a single string, output.data is a flat Float32Array (768)
  if (typeof text === 'string') {
    return Array.from(output.data as Float32Array)
  }

  // If input is an array, output.data is a flat Float32Array (batchSize * 768)
  // we must reshape it using the dimensions provided in output.dims
  const batchSize = output.dims[0]
  const vectorSize = output.dims[1]
  const result: number[][] = []
  const data = output.data as Float32Array

  for (let i = 0; i < batchSize; i++) {
    const start = i * vectorSize
    result.push(Array.from(data.subarray(start, start + vectorSize)))
  }

  return result
}

/**
 * 2. TYPES & INTERFACES
 */

export type ExtendedItem = Prisma.ItemGetPayload<{
  select: {
    tags: true
    name: true
    description: true
    status: true
    createdAt: true
    updatedAt: true
    category: true
    type: true
    favorites: {
      select: {
        favoritedBy: { select: { name: true } }
      }
    }
    owner: { select: { name: true } }
    file: {
      select: { extension: true; mimeType: true }
    }
    collection: {
      select: { name: true }
    }
    workspace: {
      select: { name: true; description: true }
    }
  }
}> & {
  extraText?: string | null
  caption?: string | null
  summary?: string | null
}

export interface ItemForSearchEmbedding {
  name?: string | null
  description?: string | null
  tags?: string[] | null
  status?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  category?: string | null
  type?: string | null
  extension?: string | null
  mimeType?: string | null
  ownerName?: string | null
  collectionName?: string | null
  extraText?: string | null
  caption?: string | null
  summary?: string | null
}

/**
 * 3. MAPPING & CLEANING
 */

/**
 * Maps a Prisma item payload to a flat object for embedding processing.
 */
export function mapItemToSearch(item: ExtendedItem): ItemForSearchEmbedding {
  return {
    name: item.name,
    description: item.description,
    tags: item.tags,
    category: item.category,
    type: item.type,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ownerName: item.owner?.name,
    collectionName: item.collection?.name,
    extension: item.file?.extension,
    mimeType: item.file?.mimeType,
    extraText: item.extraText,
    caption: item.caption,
    summary: item.summary,
  }
}

/**
 * Removes ASR artifacts and normalizes whitespace.
 */
export function cleanText(text: string): string {
  if (!text) return ''
  return text
    .replace(/Subtitle by [a-zA-Z0-9\s\.]+/gi, '')
    .replace(/Amara\.org/gi, '')
    .replace(/\[Music\]|\[Applause\]|\[Laughter\]/gi, '')
    .replace(/([A-Z][^.!?]*[.!?])\s*\1\s*\1+/g, '$1') // Collapse 3+ sentence repetitions
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 4. SEARCH TEXT CONSTRUCTION
 */

/**
 * Builds a natural language string from metadata.
 * Uses periods instead of pipes because MPNet is trained on sentences.
 */
export function buildSearchTextFromItem(
  item: ItemForSearchEmbedding,
  options: {
    maxLength?: number
    boostName?: number
    includeDates?: boolean
  } = {}
): string {
  const { maxLength = 4000, boostName = 2, includeDates = false } = options
  const parts: string[] = []

  // Boosted fields: Repeating the name gives it more weight in the vector space
  if (item.name) {
    const cleanName = item.name.trim()
    for (let i = 0; i < Math.max(1, boostName); i++) {
      parts.push(cleanName)
    }
  }

  if (item.category || item.type) {
    parts.push(`Category: ${item.category ?? ''} ${item.type ?? ''}`.trim())
  }

  if (item.description) parts.push(item.description)
  if (item.summary) parts.push(`Summary: ${item.summary}`)
  if (item.caption) parts.push(`Caption: ${item.caption}`)

  if (item.tags && item.tags.length) {
    parts.push(`Tags: ${item.tags.join(', ')}`)
  }

  const technical = [
    item.mimeType,
    item.extension?.replace(/^\./, ''),
    item.status,
    item.ownerName,
    item.collectionName,
  ].filter(Boolean)

  if (technical.length) parts.push(technical.join(' '))

  if (includeDates && item.createdAt) {
    parts.push(`Date: ${new Date(item.createdAt).toLocaleDateString()}`)
  }

  if (item.extraText) parts.push(cleanText(item.extraText))

  const content = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('. ')

  return content.length > maxLength ? content.slice(0, maxLength) : content
}

/**
 * 5. HIGH-LEVEL EMBEDDING FUNCTIONS
 */

/**
 * Produce numeric embedding vector for the given item metadata.
 */
export async function embedItemForSearch(
  item: ItemForSearchEmbedding,
  options?: { maxLength?: number; boostName?: number; includeDates?: boolean }
): Promise<number[]> {
  const text = buildSearchTextFromItem(item, options)

  if (!text.trim()) {
    // Return a zero-vector if there is absolutely no text to encode
    return new Array(768).fill(0)
  }

  const embedding = await toVector(text)

  // Ensure we return a single flat array of numbers
  if (Array.isArray(embedding[0])) {
    return (embedding[0] as number[]).map(Number)
  }
  return (embedding as number[]).map(Number)
}

/**
 * Produce an encoded JSON string for DB vector column insertion.
 */
export async function embedItemForSearchString(
  item: ItemForSearchEmbedding,
  options?: { maxLength?: number; boostName?: number; includeDates?: boolean }
): Promise<string> {
  const vector = await embedItemForSearch(item, options)
  return JSON.stringify(vector)
}
