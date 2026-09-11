import { describe, it, expect } from 'vitest'
import { itemUrlFor } from '../useItemUrl'

// `useItemUrl` itself is `useParams()` plus a call to `itemUrlFor`, and the test
// environment is node with no DOM, so the pure resolver carries the coverage.

const VIEWER = 'usr_viewer'
const UPLOADER = 'usr_uploader'

const file = {
  type: 'file' as const,
  id: 'itm_1',
  parentId: 'fld_1',
  ownerId: UPLOADER,
}

const folder = {
  type: 'folder' as const,
  id: 'fld_1',
  parentId: '',
  ownerId: UPLOADER,
}

describe('itemUrlFor', () => {
  it('routes through the personal stash when there is no workspaceId', () => {
    expect(itemUrlFor({ me: VIEWER }, folder)).toBe(
      '/usr_viewer/stash/folders/fld_1'
    )
  })

  it('routes through the workspace when workspaceId is present', () => {
    expect(itemUrlFor({ me: VIEWER, workspaceId: 'wsp_team' }, folder)).toBe(
      '/usr_viewer/workspaces/wsp_team/folders/fld_1'
    )
  })

  it('uses the viewer for :me, not the item owner', () => {
    // The bug this locks down: item cards used to pass the owner's id as the
    // `:me` segment. Identical to the viewer in a personal stash, wrong in a
    // workspace where a teammate uploaded the item.
    const url = itemUrlFor({ me: VIEWER, workspaceId: 'wsp_team' }, file)
    expect(url).toBe('/usr_viewer/workspaces/wsp_team/folders/fld_1/files/itm_1')
    expect(url).not.toContain(UPLOADER)
  })

  it('falls back to the owner id when the route has no :me param', () => {
    // Every authenticated route sits under /:me, so this is the safety net for
    // a component rendered outside that tree — it must still yield a usable URL.
    expect(itemUrlFor({}, folder)).toBe('/usr_uploader/stash/folders/fld_1')
  })

  it('keeps the workspace prefix when falling back to the owner id', () => {
    expect(itemUrlFor({ workspaceId: 'wsp_team' }, folder)).toBe(
      '/usr_uploader/workspaces/wsp_team/folders/fld_1'
    )
  })

  it('nests a file under its parent folder in both trees', () => {
    expect(itemUrlFor({ me: VIEWER }, file)).toBe(
      '/usr_viewer/stash/folders/fld_1/files/itm_1'
    )
    expect(itemUrlFor({ me: VIEWER, workspaceId: 'wsp_team' }, file)).toBe(
      '/usr_viewer/workspaces/wsp_team/folders/fld_1/files/itm_1'
    )
  })
})
