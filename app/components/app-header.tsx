import {
  AddFoldersIcon,
  ArrowLeftFillIcon,
  DropdownIcon,
  UploadFileFillIcon,
  UploadFillIcon,
  UploadFolderFillIcon,
  NotificationEmptyFillIcon,
  NotificationFullFillIcon,
} from '@/components/icons'
import { useUpload } from '@/hooks/useUpload'
import { cn } from '@/utils'
import { useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router'
import { ModeToggle } from '@/components/color-mode'
import { GalleryHeaderTools } from '@/components/gallery/gallery-view-controls'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { NotificationsPanel } from '@/components/core-components/notifications/notifications-panel'
import type { Notification } from '@/types/notification.types'
import { NewFolderDialog } from '@/components/core-components/new-folder-dialog'
import { HeaderFilters, HeaderSearch } from '@/components/filters/filters'
import {
  Grid,
  LayoutToggle,
  List,
  River,
  Waterfall,
} from '@/components/layout-toggle'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Button } from '@/ui/button'
import { SidebarTrigger } from '@/ui/sidebar'
import { ButtonGroup } from '@/ui/button-group'
import { Trigger } from '@/components/upload'

export function AppHeader() {
  const { folderId, fileId } = useParams()
  let navigate = useNavigate()
  const layoutData = useRouteLoaderData('layout') as
    | { notifications?: Notification[]; user?: { rootId?: string } }
    | undefined
  const isImagesPage = useLocation().pathname.endsWith('/images')
  const notifications = layoutData?.notifications ?? []
  // At the stash root there's no `:folderId` in the URL; fall back to the
  // user's root folder so New Folder (and uploads) have a real destination.
  const rootId = layoutData?.user?.rootId
  return (
    <header
      className={cn(
        // A size container on every page, so its controls fit the header's
        // own width (which the sidebar changes) and can never widen the page.
        'bg-background z-40 flex items-center h-14 justify-between pl-0 pr-2 py-2 sticky top-0 shrink-0 gap-2 @container/header'
      )}
    >
      {/* Below md the sidebar is a sheet, and its own trigger sits inside it;
          this is the only way to open navigation on a phone. */}
      <SidebarTrigger
        sidebarId="default"
        size="icon"
        className="md:hidden bg-card! border-input rounded-md! shrink-0"
      />
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'font-stashly bg-card! border-input rounded-md! shrink-0',
          !fileId && 'hidden'
        )}
        aria-label="Back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeftFillIcon className="size-5" />
      </Button>
      {/* On a file page both the upload group and the filters render nothing,
          so the breadcrumb trail takes that slot outright — sharing the row
          with an empty flex-1 sibling would halve the width it can truncate
          against. */}
      {fileId ? (
        <Breadcrumbs />
      ) : isImagesPage ? (
        // Images: the page's trail plus the app search — no upload menu, and
        // no filter/sort popover (the gallery has its own view controls).
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* The page name keeps its text and the search gives way first. On a
              phone-width header the name steps aside (the page title says
              it) and the search may shrink past its desktop minimum. */}
          <div className="shrink-0 @max-md/header:hidden">
            <Breadcrumbs />
          </div>
          <HeaderSearch className="w-full max-w-80 min-w-40 shrink @max-md/header:min-w-0" />
        </div>
      ) : (
        // The group gives way to the right-hand controls instead of drawing
        // over them: the search shrinks first, and anything still too wide is
        // clipped (x only, so focus rings above and below survive) until the
        // narrower layouts take over.
        <div className="flex min-w-0 flex-1 gap-2 items-center overflow-x-clip">
          <StashlyUpload folderId={folderId} rootId={rootId} />
          <HeaderFilters />
        </div>
      )}
      <div className="flex items-center space-x-2 shrink-0">
        {isImagesPage && <GalleryHeaderTools />}
        <LayoutToggle>
          <River />
          <Waterfall />
          <Grid />
          <List />
        </LayoutToggle>
        <NotificationsPanel notifications={notifications} />
        <ModeToggle />
      </div>
    </header>
  )
}

function StashlyUpload({
  folderId,
  rootId,
}: {
  folderId: string | undefined
  rootId: string | undefined
}) {
  let { toggleView } = useUpload()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  if (location.pathname.includes('files')) {
    return null
  }

  return (
    <ButtonGroup className="border-none ring-2 ring-accent rounded-md bg-card">
      <Button
        onClick={toggleView}
        variant="ghost"
        size="icon"
        aria-label="Uploads"
        // The upload panel starts hidden and this is its only opener, so E2E
        // needs a stable handle on it — the button is icon-only and otherwise
        // has no accessible name to target.
        data-testid="upload-toggle"
      >
        <UploadFillIcon className="size-5! text-muted-foreground" />
      </Button>
      <Popover modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger className="cursor-pointer" asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New and upload"
            className="hover:cursor-pointer hover:bg-muted rounded-md hover:rounded-md  items-center! flex aria-expanded:bg-accent/30 aria-expanded:text-accent-foreground  data-[state=open]:bg-accent/30 data-[state=open]:text-accent-foreground hover:last:rounded-r-md!"
          >
            <DropdownIcon className="size-5!" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex-col flex rounded-md shadow-xl overflow-hidden font-stashly border-none ring-2 ring-accent p-2 bg-card max-w-max"
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
        folderId={folderId ?? rootId}
      />
    </ButtonGroup>
  )
}
