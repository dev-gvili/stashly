/**
 * Pure text-shaping utilities for building searchable content from items.
 *
 * Browser-safe (no Prisma types, no server-only imports). The companion
 * server-only adapter `mapItemToSearch` lives in `app/.server/search-actions.ts`
 * because it depends on `Prisma.ItemGetPayload`.
 */

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
 * Drop NUL characters, which a Postgres `text` column refuses
 * (`invalid byte sequence for encoding "UTF8": 0x00`): one in a file's
 * extracted text failed the whole `Search` write, so the item was never
 * indexed (seen in CI's e2e Postgres log, 12 Nov). Apply it before chunking,
 * so chunk offsets index the same string that is stored.
 */
export function stripNulChars(text: string): string {
  return text.includes('\0') ? text.replaceAll('\0', '') : text
}

/**
 * Strip common ASR / subtitle artifacts and normalize whitespace.
 * Use on transcript text and other raw extracted content before embedding.
 */
export function cleanText(text: string): string {
  if (!text) return ''
  return text
    .replace(/Subtitle by [a-zA-Z0-9\s.]+/gi, '')
    .replace(/Amara\.org/gi, '')
    .replace(/\[Music\]|\[Applause\]|\[Laughter\]/gi, '')
    .replace(/([A-Z][^.!?]*[.!?])\s*\1\s*\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a natural-language string from item metadata for embedding.
 *
 * The output uses sentence-style joining (periods, not pipes) because
 * sentence-trained embedding models (MPNet, MiniLM) handle prose better
 * than delimited fields. The item name is repeated `boostName` times to
 * weight it more strongly in the vector space.
 *
 * @example
 * buildSearchTextFromItem({ name: 'Q3 report', tags: ['finance'] })
 * // → "Q3 report. Q3 report. Tags: finance"
 */
export function buildSearchTextFromItem(
  item: ItemForSearchEmbedding,
  options: {
    maxLength?: number
    boostName?: number
    includeDates?: boolean
  } = {},
): string {
  const { maxLength = 4000, boostName = 2, includeDates = false } = options
  const parts: string[] = []

  if (item.name) {
    const cleanName = item.name.trim()
    for (let i = 0; i < Math.max(1, boostName); i++) parts.push(cleanName)
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
