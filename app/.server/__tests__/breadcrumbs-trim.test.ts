import { describe, it, expect } from 'vitest'
import { trimBreadcrumbs } from '../breadcrumbs'

const OWNER = 'usr_owner'
const RECIPIENT = 'usr_recipient'

/** Root -> Photos -> Summer 2024, all owned by OWNER. */
const chain = [
  {
    id: 'root',
    name: 'Home',
    parentId: null,
    type: 'folder' as const,
    ownerId: OWNER,
  },
  {
    id: 'fld_photos',
    name: 'Photos',
    parentId: 'root',
    type: 'folder' as const,
    ownerId: OWNER,
  },
  {
    id: 'fld_summer',
    name: 'Summer 2024',
    parentId: 'fld_photos',
    type: 'folder' as const,
    ownerId: OWNER,
  },
]

describe('trimBreadcrumbs', () => {
  it('gives the owner the full chain', () => {
    const out = trimBreadcrumbs(chain, OWNER)
    expect(out.map((c) => c.name)).toEqual(['Home', 'Photos', 'Summer 2024'])
  })

  it('gives a non-owner only the target crumb', () => {
    // Folder names leak information: a recipient of "Summer 2024" should not
    // learn that it sits under "Photos" under this user's "Home".
    const out = trimBreadcrumbs(chain, RECIPIENT)
    expect(out.map((c) => c.name)).toEqual(['Summer 2024'])
  })

  it('decides on the target item, not the root', () => {
    // A folder shared into someone else's tree: the ancestors belong to the
    // owner, the target belongs to the viewer. The viewer owns what they were
    // asked about, so they get the chain.
    const mixed = [
      { ...chain[0], ownerId: OWNER },
      { ...chain[1], ownerId: OWNER },
      { ...chain[2], ownerId: RECIPIENT },
    ]
    expect(trimBreadcrumbs(mixed, RECIPIENT)).toHaveLength(3)
  })

  it('strips ownerId so it never reaches a loader payload', () => {
    const out = trimBreadcrumbs(chain, OWNER)
    for (const crumb of out) {
      expect(crumb).not.toHaveProperty('ownerId')
    }
  })

  it('returns an empty array for an empty chain', () => {
    // A deleted or unreachable item yields no rows; must not throw.
    expect(trimBreadcrumbs([], OWNER)).toEqual([])
  })
})
