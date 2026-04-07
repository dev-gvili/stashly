import { CollectionIcon } from '@/components/icons'
import { GenericEmptyState, type GenericEmptyStateProps } from './generic-empty-state'
import type React from 'react'
export const CollectionEmptyState = ({
  title = "This collection is empty",
  description = "Add items by right-clicking files or folders in your stash.",
  children
}: Partial<Omit<GenericEmptyStateProps, "icon">>) => {
  return (
    <GenericEmptyState
      description={description}
      title={title}
      icon={<CollectionIcon className="size-20" />}
      children={children}
    />
  )
}
