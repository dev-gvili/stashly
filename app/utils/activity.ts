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
        access: true
        edit: true
      }
    }
    access: true
  }
}>

export type { ActivityWithRelations }

export function formatActivity(activity: ActivityWithRelations): string {
  const a = activity.action
  if (!a) return 'Activity recorded'
  if (a.create) return 'You created an item'
  if (a.rename) return `You renamed ${a.rename.oldName} → ${a.rename.newName}`
  if (a.move) return `You moved this item to ${a.move.to}`
  if (a.delete) return `You deleted ${a.delete.name}`
  if (a.restore) return 'You restored this item'
  if (a.copy) return `You copied this item to ${a.copy.to}`
  if (a.share) return `You shared this item with ${a.share.recipients.join(', ')}`
  if (a.version) return `You uploaded version ${a.version.newVersion}`
  if (a.comment) return a.comment.isReply ? 'You replied to a comment' : 'You commented on this item'
  if (a.permission) {
    if (a.permission.type === 'grant') return `You granted ${a.permission.role} access`
    if (a.permission.type === 'revoke') return 'You revoked access'
    return `You updated access to ${a.permission.role}`
  }
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
