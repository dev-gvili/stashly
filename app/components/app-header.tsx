import {
  AddFoldersIcon,
  ArrowLeftFillIcon,
  DropdownIcon,
  UploadFileFillIcon,
  UploadFillIcon,
  UploadFolderFillIcon,
} from '@/components/icons'
import { useUpload } from '@/hooks/useUpload'
import { cn } from '@/utils'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ModeToggle } from '@/components/color-mode'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { NewFolderDialog } from '@/components/core-components/new-folder-dialog'
import { HeaderFilters } from '@/components/filters/filters'
import {
  Grid,
  LayoutToggle,
  List,
  River,
  Waterfall,
} from '@/components/layout-toggle'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Button } from '@/ui/button'
import { ButtonGroup } from '@/ui/button-group'
import { Trigger } from '@/components/upload'

export function AppHeader() {
  const { folderId, fileId } = useParams()
  let navigate = useNavigate()
  return (
    <header className="bg-background z-40 flex items-center h-14 justify-between pl-0 pr-2 py-2 sticky top-0 shrink-0 gap-2">
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'font-stashly bg-card! border-input rounded-md!',
          !fileId && 'hidden'
        )}
        onClick={() => navigate(-1)}
      >
        <ArrowLeftFillIcon className="size-5" />
      </Button>
      <Breadcrumbs />
      <div className="flex flex-1 gap-2 items-center">
        <StashlyUpload folderId={folderId} />
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

function StashlyUpload({ folderId }: { folderId: string | undefined }) {
  let { toggleView } = useUpload()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  if (location.pathname.includes('files')) {
    return null
  }

  return (
    <ButtonGroup className="border border-sidebar-border rounded-md bg-card">
      <Button onClick={toggleView} variant="ghost" size="icon">
        <UploadFillIcon className="size-5! text-muted-foreground" />
      </Button>
      <Popover modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger className="cursor-pointer" asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hover:cursor-pointer hover:bg-muted rounded-md hover:rounded-md  items-center! flex aria-expanded:bg-accent/30 aria-expanded:text-accent-foreground  data-[state=open]:bg-accent/30 data-[state=open]:text-accent-foreground hover:last:rounded-r-md!"
          >
            <DropdownIcon className="size-5!" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex-col flex rounded-md shadow-xl overflow-hidden font-stashly border border-sidebar-border p-2 bg-card max-w-max"
        >
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false)
              setNewFolderOpen(true)
            }}
            className="hover:cursor-pointer w-full hover:bg-transparent text-foreground border-none flex items-end justify-start"
          >
            <AddFoldersIcon className="size-6! text-current" />
            New
          </Button>
          <Button
            variant="ghost"
            onSelect={(e) => e.preventDefault()}
            className="hover:cursor-pointer w-full text-foreground hover:bg-transparent"
            asChild
          >
            <Trigger
              id="upload-files"
              folderId={folderId}
              className="border-none flex items-end justify-start w-full"
            >
              <UploadFileFillIcon className="size-6! text-current" />
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
              className="border-none flex items-end justify-start w-full"
            >
              <UploadFolderFillIcon className="size-6! text-current" />
              <span className="place-self-start">Folders</span>
            </Trigger>
          </Button>
        </PopoverContent>
      </Popover>
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        folderId={folderId}
      />
    </ButtonGroup>
  )
}
