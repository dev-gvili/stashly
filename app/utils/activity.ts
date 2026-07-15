import type { Prisma } from '@/prisma/client'

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    time: true
    item: true
    action: {
      include: {
        create: true
        rename: true
        move: true
        delete: true
        restore: true
        copy: true
        share: true
        version: true
        comment: true
        permission: true
        upload: true
        pin: true
        edit: true
        collection: true
        favorite: true
        bucket: true
      }
    }
    access: true
  }
}>

export type { ActivityWithRelations }

export function formatActivity(activity: ActivityWithRelations): string {
  const a = activity.action
  if (!a) return 'Activity recorded'
  if (a.create) return 'You created this item'
  if (a.rename) return `You renamed from ${a.rename.oldName} to ${a.rename.newName}`
  if (a.move) return `You moved this item from ${a.move.fromParentName} to ${a.move.toParentName}`
  if (a.delete) return `You deleted ${a.delete.name}`
  if (a.restore) return 'You restored this item'
  if (a.upload) return `You uploaded this item`
  if (a.copy) return `You copied this item to ${a.copy.toParentName}`
  if (a.share) {
    const r = a.share.recipients
    if (r.length === 0) return 'You shared this item'
    if (r.length === 1) return `You shared with ${r[0]}`
    return `You shared with ${r[0]} and ${r.length - 1} more`
  }
  if (a.version) return `You uploaded version ${a.version.newVersion}`
  if (a.comment) return a.comment.isReply ? 'You replied to a comment' : 'You commented on this item'
  if (a.permission) {
    if (a.permission.type === 'grant') return `You granted ${a.permission.role} access to this item`
    if (a.permission.type === 'revoke') return 'You revoked access'
    return `You updated access to ${a.permission.role}`
  }
  if (a.pin) {
    if (a.pin.kind === 'pinned') return 'You pinned this item'
    if (a.pin.kind === 'unpinned') return 'You unpinned this item'
    if (a.pin.kind === 'reordered') return 'You reordered pinned items'
  }
  if (a.favorite) {
    return a.favorite.kind === 'favorited'
      ? 'You favorited this item'
      : 'You unfavorited this item'
  }
  if (a.collection) {
    const n = a.collection.count ?? 1
    if (a.collection.kind === 'item_added') {
      return n === 1
        ? 'You added an item to this collection'
        : `You added ${n} items to this collection`
    }
    if (a.collection.kind === 'item_removed') {
      return n === 1
        ? 'You removed an item from this collection'
        : `You removed ${n} items from this collection`
    }
    if (a.collection.kind === 'emptied') return 'You emptied this collection'
  }
  if (a.bucket) return 'You emptied your stash'
  if (a.edit) return 'You edited this item'
  if (activity.access) return 'You viewed this item'
  return 'Activity recorded'
}

export function formatActivityTimestamp(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
