import type { ItemCategory } from '@/prisma/browser'
import type {
  FileKind,
  HomeCollection,
  HomeFile,
  NeedsYouEntry,
  SearchableQueueEntry,
} from '@/types/home.types'
import type { StashItem } from '@/types/stash.types'
import { href } from 'react-router'
import { toItemUrl } from '@/utils/converters'

const KIND_BY_CATEGORY: Partial<Record<ItemCategory, FileKind>> = {
  image: 'image',
  graphic: 'image',
  audio: 'audio',
  video: 'video',
  code: 'code',
  script: 'code',
}

/** The home feed's five kinds from the item categories; anything else reads as a document. */
export function toFileKind(category: ItemCategory): FileKind {
  return KIND_BY_CATEGORY[category] ?? 'document'
}

/** "PDF" from "Q3 deck.pdf"; undefined when the name has no extension. */
export function toExtension(name: string): string | undefined {
  const match = /\.([^.\s]{1,5})$/.exec(name)
  return match ? match[1].toUpperCase() : undefined
}

/** Seconds as "6:41" or "1:02:05". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/**
 * A loader file row as a home tile. A real thumbnail has a URL that does not
 * start with `#` (those are stage-0 colour placeholders).
 *
 * @example
 * toHomeFile(item, { me: 'usr_1', indexedIds: new Set(['f1']), pinnedIds: new Set() })
 */
export function toHomeFile(
  item: StashItem,
  ctx: { me: string; indexedIds: Set<string>; pinnedIds: Set<string> }
): HomeFile {
  const thumb = item.thumbnails.find((t) => t.url && !t.url.startsWith('#'))
  return {
    id: item.id,
    name: item.name,
    kind: toFileKind(item.category),
    extension: toExtension(item.name),
    size: Number(item.size),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date(0),
    href: toItemUrl({
      type: item.type,
      id: item.id,
      parentId: item.parentId ?? '',
      me: ctx.me,
    }),
    ownerId: item.ownerId,
    thumbnailUrl: thumb?.url ?? undefined,
    pinned: ctx.pinnedIds.has(item.id),
    searchable: ctx.indexedIds.has(item.id),
    item,
  }
}

/** A collection row with its mosaic tiles as a home tile. */
export function toHomeCollection(
  collection: { id: string; name: string; itemCount: number },
  tiles: { url: string | null; category: ItemCategory }[],
  me: string
): HomeCollection {
  return {
    id: collection.id,
    name: collection.name,
    itemCount: collection.itemCount,
    href: href('/:me/stash/collections/:collectionId', {
      me,
      collectionId: collection.id,
    }),
    tiles: tiles.map((t) => ({
      kind: toFileKind(t.category),
      thumbnailUrl: t.url ?? undefined,
    })),
  }
}

/** Audio / video files search can't see yet, as the Searchable queue rows. */
export function toQueueEntries(
  rows: { id: string; name: string; kind: 'audio' | 'video'; durationSec: number | null }[]
): SearchableQueueEntry[] {
  return rows.map((row) => {
    const label = row.kind === 'video' ? 'Video' : 'Audio'
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      meta: row.durationSec ? `${label} · ${formatDuration(row.durationSec)}` : label,
    }
  })
}

/** The parts of a received invitation the home page reads. */
export interface ReceivedInvitation {
  id: string
  createdAt: Date | string
  sender: { id: string; name: string }
  recipients: { id: string; email: string; status: string; role: string }[]
  item: { id: string; name: string } | null
  workspace: { id: string; name: string } | null
}

const ITEM_ROLE_VERB: Record<string, string> = {
  read: 'view',
  write: 'edit',
  owner: 'manage',
}

/**
 * Invitations still waiting on `email`, as Needs-you rows: newest first, at most
 * `limit`. An invitation counts while this user's own recipient row is pending.
 *
 * @example
 * toNeedsYouEntries(await listReceivedInvitations(email), email)
 * // → [{ kind: 'invite', actorName: 'Sam Ortiz', text: 'invited you to edit Episode 12', cta: 'Accept', … }]
 */
export function toNeedsYouEntries(
  invitations: ReceivedInvitation[],
  email: string,
  limit = 5
): NeedsYouEntry[] {
  const me = email.toLowerCase()
  return invitations
    .flatMap((inv): NeedsYouEntry[] => {
      const recipient = inv.recipients.find(
        (r) => r.email.toLowerCase() === me && r.status === 'pending'
      )
      const target = inv.item ?? inv.workspace
      if (!recipient || !target) return []
      const text = inv.item
        ? `invited you to ${ITEM_ROLE_VERB[recipient.role] ?? 'access'} ${target.name}`
        : `invited you to join ${target.name}`
      return [
        {
          id: inv.id,
          kind: 'invite',
          actorName: inv.sender.name,
          text,
          cta: 'Accept',
          at: inv.createdAt,
          recipientId: recipient.id,
        },
      ]
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
}

/**
 * A search query from a file name: the extension dropped, `_` and `-` read as
 * spaces. Returns `''` when nothing worth searching for is left.
 *
 * @example
 * toQueryFromName('Q3_board-deck.final.pdf') // → 'Q3 board deck.final'
 */
export function toQueryFromName(name: string): string {
  const query = name
    .replace(/\.[^.\s]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return query.length >= 3 ? query : ''
}

/**
 * Suggestion chips for the hero: queries from recent files that search has
 * indexed, in recency order, without repeats. A file search cannot see would
 * suggest a query that finds nothing, so those are skipped.
 */
export function toChipQueries(
  files: { id: string; name: string }[],
  indexedIds: Iterable<string>,
  limit = 3
): string[] {
  const indexed = new Set(indexedIds)
  const queries: string[] = []
  for (const file of files) {
    if (queries.length >= limit) break
    if (!indexed.has(file.id)) continue
    const query = toQueryFromName(file.name)
    if (query && !queries.includes(query)) queries.push(query)
  }
  return queries
}
