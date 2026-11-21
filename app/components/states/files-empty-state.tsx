import { FileFillIcon, FolderIcon } from '@/components/icons'
import { GenericEmptyState } from './generic-empty-state'
import { EmptyFolderVector } from '@/components/states/vectors/empty-vectors'
import { Button } from '../ui/button'
import { Trigger } from '../upload'

const COPY = {
  stash: {
    title: 'No files found',
    description: 'Upload files to your stash to access them here.',
  },
  folder: {
    title: 'This folder is empty',
    description: 'Upload files or a folder here, or move items in from elsewhere.',
  },
} as const

interface FilesEmptyStateProps {
  /** `stash`: the whole stash is empty. `folder`: one folder is. */
  variant?: keyof typeof COPY
  /** Where the upload buttons put files; the current folder for `folder`. */
  folderId?: string
  className?: string
}

/**
 * Empty state for a file listing, with Files / Folders upload buttons.
 *
 * @example
 * <FilesEmptyState variant="folder" folderId={params.folderId} />
 */
export const FilesEmptyState = ({
  variant = 'stash',
  folderId,
  className,
}: FilesEmptyStateProps) => {
  return (
    <GenericEmptyState
      description={COPY[variant].description}
      title={COPY[variant].title}
      icon={<EmptyFolderVector />}
      className={className}
    >
      <Button variant="outline" asChild>
        <Trigger
          className="font-stashly capitalize items-start"
          folderId={folderId}
        >
          <FileFillIcon className="size-5" />
          Files
        </Trigger>
      </Button>
      <Button variant="outline" asChild>
        <Trigger
          className="font-stashly items-start"
          webkitdirectory="true"
          folderId={folderId}
        >
          <FolderIcon className="size-5" />
          Folders
        </Trigger>
      </Button>
    </GenericEmptyState>
  )
}
