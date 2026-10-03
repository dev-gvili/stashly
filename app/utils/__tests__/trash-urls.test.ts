import { describe, expect, it } from 'vitest'
import { afterRestoreUrl } from '@/utils/trash-urls'

/**
 * A restore made inside a trashed folder takes the folder out of Trash too,
 * so reloading that view 404'd ("Folder not found in Trash"). The restore
 * action redirects with this instead.
 */
const at = (path: string) => new URL(`http://localhost${path}`)

describe('afterRestoreUrl', () => {
  it('leaves a trashed-folder view for the Trash entries, keeping the query', () => {
    expect(afterRestoreUrl(at('/usr_1/stash/trash/folders/item_f?layout=river'))).toBe(
      '/usr_1/stash/trash?layout=river'
    )
  })

  it('works without a query, and with a trailing slash', () => {
    expect(afterRestoreUrl(at('/usr_1/stash/trash/folders/item_f/'))).toBe('/usr_1/stash/trash')
  })

  it('stays on the Trash entries', () => {
    expect(afterRestoreUrl(at('/usr_1/stash/trash?layout=grid&take=50'))).toBe(
      '/usr_1/stash/trash?layout=grid&take=50'
    )
  })

  it('stays anywhere else, as before', () => {
    expect(afterRestoreUrl(at('/usr_1/stash/folders/item_f?layout=grid'))).toBe(
      '/usr_1/stash/folders/item_f?layout=grid'
    )
  })
})
