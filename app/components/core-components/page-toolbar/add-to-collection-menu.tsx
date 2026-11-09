import { useEffect, useState } from 'react'
import { href, useFetcher, useParams } from 'react-router'
import { CollectionFillIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { Tooltip } from '@/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

export type CollectionRef = { id: string; name: string }

/**
 * The selection toolbar's "Add to collection": a rail button that opens a list
 * of the user's collections. The list is the collections page's own loader
 * data, fetched when the menu first opens, so no new route exists for it.
 *
 * @example
 * <AddToCollectionMenu onSelect={(col) => addItems(col, selectedIds)} />
 */
export function AddToCollectionMenu({
  onSelect,
}: {
  onSelect: (collection: CollectionRef) => void
}) {
  const { me } = useParams()
  const fetcher = useFetcher<{ collections: CollectionRef[] }>()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && me && fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(href('/:me/stash/collections', { me }))
    }
  }, [open, me, fetcher])

  const collections = fetcher.data?.collections ?? []
  const loading = !fetcher.data

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <Tooltip content="Add to collection" asChild>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Add to collection">
            <CollectionFillIcon className="size-5" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="font-stashly max-h-80 w-56 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Add to collection
        </DropdownMenuLabel>
        {loading ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : collections.length === 0 ? (
          <DropdownMenuItem disabled>No collections yet</DropdownMenuItem>
        ) : (
          collections.map((col) => (
            <DropdownMenuItem
              key={col.id}
              onSelect={() => onSelect({ id: col.id, name: col.name })}
            >
              <CollectionFillIcon className="size-4" />
              <span className="truncate">{col.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
