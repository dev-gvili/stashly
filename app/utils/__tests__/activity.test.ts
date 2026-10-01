import { describe, it, expect } from 'vitest'
import { formatActivity } from '../activity'
import type { ActivityWithRelations } from '../activity'

function act(action: Record<string, unknown> | null): ActivityWithRelations {
  return { id: 'act_1', item: null, time: null, access: null, action } as unknown as ActivityWithRelations
}

function withAction(type: string, payload: Record<string, unknown>) {
  const nullActions = { create: null, rename: null, move: null, delete: null, restore: null, copy: null, share: null, version: null, comment: null, permission: null, access: null, edit: null, activity: null, id: 'ia1', commentActionId: null, createActionId: null, deleteActionId: null, editActionId: null, moveActionId: null, renameActionId: null, restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: null }
  return act({ ...nullActions, [type]: { id: `${type}_1`, ...payload } })
}

describe('formatActivity', () => {
  it('returns fallback for null action', () => {
    expect(formatActivity(act(null))).toBe('Activity recorded')
  })
  it('formats create', () => {
    expect(formatActivity(withAction('create', {}))).toBe('You created this item')
  })
  it('formats rename', () => {
    expect(formatActivity(withAction('rename', { oldName: 'a.jpg', newName: 'b.jpg' }))).toBe('You renamed a.jpg → b.jpg')
  })
  it('formats move', () => {
    // MoveAction's columns are fromParentName/toParentName (29af2d8); the old
    // `from`/`to` fixture rendered "from undefined to undefined".
    expect(
      formatActivity(
        withAction('move', { fromParentId: 'fld_src', fromParentName: 'src', toParentId: 'fld_dst', toParentName: 'dst' })
      )
    ).toBe('You moved this item from src to dst')
  })
  it('formats delete', () => {
    expect(formatActivity(withAction('delete', { name: 'x.pdf', itemType: 'file' }))).toBe('You deleted x.pdf')
  })
  it('formats permission grant', () => {
    expect(formatActivity(withAction('permission', { type: 'grant', userId: 'u1', role: 'editor' }))).toBe('You shared this item with editor access')
  })
  it('formats permission revoke', () => {
    expect(formatActivity(withAction('permission', { type: 'revoke', userId: 'u1', role: 'viewer' }))).toBe('You revoked access')
  })
})
