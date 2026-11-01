import type { ReactNode } from 'react'
import { AddIcon, CollectionFillIcon } from '@/components/icons'
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
 * The index shows a fanned stack; the collection shows a dashed "add" tile.
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
    <Empty className="rounded-2xl border border-dashed border-input py-18">
      <EmptyHeader>
        <EmptyMedia>
          <div className="relative size-16">
            {variant === 'index' && (
              <>
                <span className="absolute inset-0 -translate-x-3 -rotate-10 rounded-xl border border-input bg-secondary" />
                <span className="absolute inset-0 translate-x-3 rotate-10 rounded-xl border border-input bg-secondary" />
              </>
            )}
            <span
              className={
                variant === 'index'
                  ? 'absolute inset-0 flex items-center justify-center rounded-xl border border-input bg-card shadow-stashly'
                  : 'absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-primary/40 bg-card'
              }
            >
              {variant === 'index' ? (
                <CollectionFillIcon className="size-7 text-primary" />
              ) : (
                <AddIcon className="size-7 text-primary" />
              )}
            </span>
          </div>
        </EmptyMedia>
        <EmptyTitle className="font-stashly">{title}</EmptyTitle>
        <EmptyDescription className="font-stashly">{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
