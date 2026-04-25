import { Grid, LayoutToggle, List, River, Waterfall } from './layout-toggle'
import { ModeToggle } from './color-mode'
import { ItemCategory, ItemStatus, ItemType } from '@/prisma/enums'
import { FilterList } from './filters/FilterList'
import { Filter } from './filters/Filter'
import {
  LockedIcon,
  FavoriteIcon,
  UploadIcon,
  FolderIcon,
  FileIcon,
  DropdownIcon,
} from '@/components/icons'
import { Trigger } from './upload'
import { SidebarTrigger } from './ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './ui/tooltip'
import { Select, SelectTrigger } from './ui/select'
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

export function AppHeader() {
  let { toggleView } = useUpload()
  const { folderId } = useParams()
  return (
    <header className="z-40 flex items-center h-14 justify-between bg-background pr-2 pl-1 py-2 sticky top-0 shrink-0">
      <SidebarTrigger className="hover:cursor-pointer rounded-md " />
      <div className="flex items-center space-x-2">
        <ButtonGroup>
          <Button
            onClick={toggleView}
            variant="outline"
            size="sm"
            className="rounded-md"
          >
            <UploadIcon className="" />
            Upload
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer" asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="hover:cursor-pointer hover:bg-muted rounded-md hover:rounded-md size-8 items-center! flex aria-expanded:bg-accent/30 aria-expanded:text-accent-foreground  data-[state=open]:bg-accent/30 data-[state=open]:text-accent-foreground hover:last:rounded-r-md!"
              >
                <DropdownIcon className="size-5!" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              forceMount
              align="start"
              alignOffset={-6}
              className="shadow-stashly border border-border rounded-md bg-sidebar"
            >
              <ButtonGroup></ButtonGroup>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="hover:cursor-pointer w-full"
                asChild
              >
                <Trigger
                  id="upload-files"
                  folderId={folderId}
                  className="border-none flex items-start justify-start w-full"
                >
                  <FileIcon className="size-5! [&>path]:fill-foreground" />
                  <span className="place-self-start">Files</span>
                </Trigger>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="hover:cursor-pointer w-full"
                asChild
              >
                <Trigger
                  id="upload-folder"
                  folderId={folderId}
                  webkitdirectory=""
                  className="border-none flex items-center justify-start w-full"
                >
                  <FolderIcon className="size-5! stroke-foreground! [&>path]:stroke-foreground" />
                  <span>Folder</span>
                </Trigger>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
        <FilterList
          data={ItemCategory}
          filterKey="category"
          label="Categories"
        />
        <FilterList data={ItemStatus} filterKey="status" label="Status" />
        <FilterList data={ItemType} filterKey="type" label="Type" />
        <Filter
          filterKey="locked"
          label="Filter locked files"
          icon={() => <LockedIcon className="size-5! text-foreground" />}
        />
        <Filter
          filterKey="favorited"
          label="Filter by favorite"
          icon={() => <FavoriteIcon className="size-5! text-foreground" />}
        />

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
