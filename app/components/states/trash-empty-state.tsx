import { TrashFillIcon } from '@/components/icons'
import { GenericEmptyState } from './generic-empty-state'
/**
 * Empty Trash, or an empty folder opened inside Trash (`inFolder`), which is
 * not the same thing: the Trash itself may hold plenty.
 */
export const TrashEmptyState = ({ inFolder = false }: { inFolder?: boolean }) => {
  return (
    <GenericEmptyState
      description={
        inFolder
          ? 'This trashed folder has nothing in it.'
          : 'Items moved to trash will appear here. Deleted items are permanently removed after 30 days.'
      }
      title={inFolder ? 'This folder is empty' : 'Trash is empty'}
      icon={<TrashFillIcon className="size-20" />}
    />
  )
}
