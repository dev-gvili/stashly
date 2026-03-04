import { TrashIcon } from '@/components/icons'
import { GenericEmptyState } from './generic-empty-state'
export const TrashEmptyState = () => {
  return (
    <GenericEmptyState
      description="Items moved to trash will appear here. Deleted items are permanently
            removed after 30 days."
      title="Trash is empty"
      icon={<TrashIcon className="size-20" />}
    />
  )
}
