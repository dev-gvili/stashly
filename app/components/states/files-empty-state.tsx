import { FileFillIcon, FolderIcon } from '@/components/icons'
import { GenericEmptyState } from './generic-empty-state'
import { Logo } from '../logo'
import { Button } from '../ui/button'
import { Trigger } from '../upload'
export const FilesEmptyState = () => {
  return (
    <GenericEmptyState
      description="Upload files to your stash to access them here."
      title="No files found"
      icon={<Logo className="size-20" />}
    >
      <Button variant="outline" asChild>
        <Trigger className="font-stashly capitalize items-start">
          <FileFillIcon className="size-5" />
          Files
        </Trigger>
      </Button>
      <Button variant="outline" asChild>
        <Trigger
          className="font-stashly items-start"
          webkitdirectory="true"
        >
          <FolderIcon className="size-5" />
          Folders
        </Trigger>
      </Button>
    </GenericEmptyState>
  )
}
