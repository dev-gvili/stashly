import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireMembership = vi.fn()
const hasAtLeastRole = vi.fn()

// The scope rule is the thing under test; membership and role lookups are DB
// calls whose own behaviour is not in question here.
vi.mock('@/services/workspace-actions', () => ({
  requireMembership: (...args: unknown[]) => requireMembership(...args),
  hasAtLeastRole: (...args: unknown[]) => hasAtLeastRole(...args),
}))

const { activityScopeFor } = await import('@/services/activity-actions')

const USER = 'usr_1'
const WORKSPACE = 'wsp_1'

beforeEach(() => {
  requireMembership.mockReset().mockResolvedValue(undefined)
  hasAtLeastRole.mockReset().mockResolvedValue(false)
})

describe('activity visibility — personal context', () => {
  it('is limited to items the user owns', async () => {
    const scope = await activityScopeFor(USER)
    expect(scope).toMatchObject({ ownerId: USER })
  })

  it('excludes workspace items from the personal feed', async () => {
    // Without `workspaceId: null` a workspace item the user happens to own
    // would surface in their personal overview, carrying workspace context
    // into a personal view.
    const scope = await activityScopeFor(USER)
    expect(scope).toEqual({ ownerId: USER, workspaceId: null })
  })

  it('does not consult workspace membership', async () => {
    await activityScopeFor(USER)
    expect(requireMembership).not.toHaveBeenCalled()
    expect(hasAtLeastRole).not.toHaveBeenCalled()
  })
})

describe('activity visibility — workspace context', () => {
  it('requires membership before returning any scope', async () => {
    requireMembership.mockRejectedValueOnce(new Error('not a member'))
    await expect(activityScopeFor(USER, WORKSPACE)).rejects.toThrow(
      'not a member'
    )
  })

  it('gives an admin the whole workspace', async () => {
    hasAtLeastRole.mockResolvedValue(true)
    const scope = await activityScopeFor(USER, WORKSPACE)
    expect(scope).toEqual({ workspaceId: WORKSPACE })
  })

  it('limits a plain member to items they own', async () => {
    hasAtLeastRole.mockResolvedValue(false)
    const scope = await activityScopeFor(USER, WORKSPACE)
    expect(scope).toEqual({ workspaceId: WORKSPACE, ownerId: USER })
  })

  it('tests for admin, which the role order also grants to owners', async () => {
    await activityScopeFor(USER, WORKSPACE)
    expect(hasAtLeastRole).toHaveBeenCalledWith(USER, WORKSPACE, 'admin')
  })
})

describe('activity visibility — shared items', () => {
  it('never admits a user an item was merely shared with', async () => {
    // Sharing grants access to the file, not to the audit trail of who did
    // what to it. No branch of the rule matches on permissions.
    hasAtLeastRole.mockResolvedValue(false)
    const personal = await activityScopeFor(USER)
    const workspace = await activityScopeFor(USER, WORKSPACE)

    for (const scope of [personal, workspace]) {
      expect(JSON.stringify(scope)).not.toContain('permissions')
      expect(scope).toMatchObject({ ownerId: USER })
    }
  })
})
