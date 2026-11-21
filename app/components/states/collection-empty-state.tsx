import type { ReactNode } from 'react'
import {
  EmptyCollectionVector,
  NoCollectionsVector,
} from '@/components/states/vectors/empty-vectors'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/ui/empty'

interface CollectionEmptyStateProps {
  /** `index`: no collections yet. `collection`: this collection has no files. */
  variant?: 'index' | 'collection'
  title?: string
  description?: string
  /** The primary call to action. */
  children?: ReactNode
}

const COPY = {
  index: {
    title: 'No collections yet',
    description:
      'Group files without moving them. A file stays in its folder and can sit in several collections at once.',
  },
  collection: {
    title: 'This collection is empty',
    description:
      'Add files from your stash. They stay where they are — the collection only lists them.',
  },
} as const

/**
 * Empty state for the collections index and for a single empty collection.
 * The index shows the no-collections drawing; a collection shows the empty tray.
 *
 * @example
 * <CollectionEmptyState variant="index"><Button>New collection</Button></CollectionEmptyState>
 */
export function CollectionEmptyState({
  variant = 'collection',
  title = COPY[variant].title,
  description = COPY[variant].description,
  children,
}: CollectionEmptyStateProps) {
  return (
    <Empty className="rounded-2xl border border-dashed border-border py-18">
      <EmptyHeader>
        <EmptyMedia>
          {variant === 'index' ? (
            <NoCollectionsVector />
          ) : (
            <EmptyCollectionVector />
          )}
        </EmptyMedia>
        <EmptyTitle className="font-stashly">{title}</EmptyTitle>
        <EmptyDescription className="font-stashly">{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
