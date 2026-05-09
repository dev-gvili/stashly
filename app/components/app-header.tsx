import { Grid, LayoutToggle, List, River, Waterfall } from './layout-toggle'
import { ModeToggle } from './color-mode'
import { HeaderFilters } from './filters/filters'
import {
  UploadIcon,
  FolderIcon,
  FileIcon,
  DropdownIcon,
} from '@/components/icons'
import { Trigger } from './upload'
import { SidebarTrigger } from './ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { ButtonGroup } from './ui/button-group'
import { useUpload } from '@/hooks/useUpload'
import { useParams } from 'react-router'
import { Popover, PopoverContent, PopoverTrigger } from './ui'

export function AppHeader() {
  let { toggleView } = useUpload()
  const { folderId } = useParams()
  return (
    <header className="z-40 flex items-center h-14 justify-between bg-background pr-2 pl-1 py-2 sticky top-0 shrink-0 gap-2">
      <SidebarTrigger
        variant="outline"
        size="icon"
        className="font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground  rounded-md!"
      />
      <div className="flex flex-1 gap-2 items-center">
        <StashlyUpload folderId={folderId} toggleView={toggleView} />
        <HeaderFilters />
      </div>
      <div className="flex items-center space-x-2">
        <LayoutToggle>
          <River />
          <Waterfall />
          <Grid />
          <List />
        </LayoutToggle>
        <ModeToggle />
      </div>
    </header>
  )
}

function StashlyUpload({
  folderId,
  toggleView,
}: {
  toggleView: () => void
  folderId: string | undefined
}) {
  return (
    <ButtonGroup>
      <Button
        onClick={toggleView}
        variant="outline"
        size="default"
        className="rounded-md"
      >
        <UploadIcon className="" />
        Upload
      </Button>
      <Popover modal={false}>
        <PopoverTrigger className="cursor-pointer" asChild>
          <Button
            variant="outline"
            size="icon"
            className="hover:cursor-pointer hover:bg-muted rounded-md hover:rounded-md  items-center! flex aria-expanded:bg-accent/30 aria-expanded:text-accent-foreground  data-[state=open]:bg-accent/30 data-[state=open]:text-accent-foreground hover:last:rounded-r-md!"
          >
            <DropdownIcon className="size-5!" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          forceMount
          align="start"
          alignOffset={-6}
          className="flex-col flex rounded-md shadow-xl overflow-hidden font-stashly border border-sidebar-border p-2 bg-sidebar max-w-max"
        >
          <Button
            variant="ghost"
            onSelect={(e) => e.preventDefault()}
            className="hover:cursor-pointer w-full text-foreground hover:bg-transparent"
            asChild
          >
            <Trigger
              id="upload-files"
              folderId={folderId}
              className="border-none flex items-start justify-start w-full"
            >
              <FileIcon className="size-5! text-current" />
              <span className="place-self-start">Files</span>
            </Trigger>
          </Button>
          <Button
            variant="ghost"
            onSelect={(e) => e.preventDefault()}
            className="hover:cursor-pointer w-full hover:bg-transparent text-foreground"
            asChild
          >
            <Trigger
              id="upload-folder"
              folderId={folderId}
              webkitdirectory=""
              className="border-none flex items-center justify-start w-full"
            >
              <FolderIcon className="size-5! text-current" />
              <span>Folder</span>
            </Trigger>
          </Button>
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  )
}
