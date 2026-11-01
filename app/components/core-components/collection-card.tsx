import { Link, href, useParams } from 'react-router'
import { CollectionActionsMenu } from '@/components/core-components/collection-actions-menu'
import { CollectionCover } from '@/components/core-components/collection-cover'
import { CollectionFillIcon } from '@/components/icons'
import type { StashCollection } from '@/types/stash.types'
import { Card } from '@/ui/card'
import { formatSize } from '@/utils/formaters'

export type CollectionCardItem = StashCollection

/** Collection page URL, keeping the grid layout and page size the page expects. */
function collectionHref(me: string, collectionId: string) {
  return `${href('/:me/stash/collections/:collectionId', { me, collectionId })}?layout=grid&take=50`
}

function metaOf(collection: CollectionCardItem) {
  if (collection.itemCount === 0) return 'Empty'
  const files = `${collection.itemCount} ${collection.itemCount === 1 ? 'file' : 'files'}`
  return `${files} · ${formatSize('byte', 'unit', Number(collection.size))}`
}

/**
 * A collection on the index: a cover over a name + meta footer. `grid` is the
 * card; `list` is a table-like row. Files and size are real; "updated" and the
 * shared-with avatars wait on data the loader doesn't carry yet.
 *
 * @example
 * <CollectionCard collection={col} view="grid" />
 */
export function CollectionCard({
  collection,
  view = 'grid',
}: {
  collection: CollectionCardItem
  view?: 'grid' | 'list'
}) {
  const { me } = useParams()
  const to = collectionHref(me!, collection.id)
  const menu = (
    <CollectionActionsMenu
      collection={collection}
      openHref={to}
      addHref={`${to}&add=1`}
    />
  )

  if (view === 'list') {
    const first = collection.covers[0]
    return (
      <div className="font-stashly group flex h-15 items-center gap-3 rounded-lg px-2 hover:bg-secondary">
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-13 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {first ? (
              <img
                src={first}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              <CollectionFillIcon className="size-5 text-muted-foreground" />
            )}
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            {collection.name}
          </span>
        </Link>
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {collection.itemCount}
        </span>
        <span className="w-24 shrink-0 text-xs text-muted-foreground">
          {formatSize('byte', 'unit', Number(collection.size))}
        </span>
        {menu}
      </div>
    )
  }

  return (
    <Card className="relative flex flex-col gap-0 rounded-2xl border border-border/50 bg-card p-0 transition-[border-color,box-shadow] hover:border-border hover:shadow-stashly">
      <Link
        to={to}
        aria-label={`Open ${collection.name}`}
        className="relative m-1.75 mb-0 block aspect-16/10 overflow-hidden rounded-xl bg-muted"
      >
        <CollectionCover variant="stack" covers={collection.covers} />
      </Link>
      <div className="flex items-center gap-2.5 py-3 pr-2 pl-3.5">
        <div className="min-w-0 flex-1">
          <Link
            to={to}
            className="font-stashly block truncate text-sm font-semibold tracking-tight"
          >
            {collection.name}
          </Link>
          <p className="font-stashly truncate text-xs text-muted-foreground">
            {metaOf(collection)}
          </p>
        </div>
        {menu}
      </div>
    </Card>
  )
}

/** Column labels for the list view; widths mirror the rows in `CollectionCard`. */
export function CollectionListHeader() {
  return (
    <div className="font-stashly flex items-center gap-3 border-b border-input px-2 pb-2 text-xs tracking-widest text-muted-foreground uppercase">
      <span className="flex-1">Name</span>
      <span className="w-20 shrink-0">Files</span>
      <span className="w-24 shrink-0">Size</span>
      <span className="size-8 shrink-0" />
    </div>
  )
}
