import {
  AddFoldersIcon,
  ArrowLeftFillIcon,
  UploadFileFillIcon,
  UploadFillIcon,
  UploadFolderFillIcon,
  NotificationEmptyFillIcon,
  NotificationFullFillIcon,
} from '@/components/icons'
import { useUploadCounts, useUploadFileIds } from '@/hooks/useUpload'
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
import { SearchRefine } from '@/components/core-components/search-refine'
import { hasHeaderFilters, HeaderSearch } from '@/components/filters/filters'
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
import { DropArea, FileList, Trigger } from '@/components/upload'
import { INVITE_CAPTION } from '@/components/views/invitations/invite-form-fields'
import { segmentedControlItemVariants } from '@/ui/segmented-control'

export function AppHeader() {
  const { folderId, fileId } = useParams()
  let navigate = useNavigate()
  const layoutData = useRouteLoaderData('layout') as
    | { notifications?: Notification[]; user?: { rootId?: string } }
    | undefined
  const { pathname } = useLocation()
  const isImagesPage = pathname.endsWith('/images')
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
          {/* Search, filter and sort in one field (⌘K opens it too). It
              replaced the classic search / Filter / Sort controls as the only
              option (owner's call, 13 Nov). */}
          {hasHeaderFilters(pathname) && <SearchRefine />}
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

/**
 * The New panel's one-line upload status from the real per-status counts:
 * `3 of 8 uploaded · 2 uploading · 3 left · 1 failed`. Cancelled files count
 * toward neither side; empty parts are left out.
 */
function uploadSummary(c: ReturnType<typeof useUploadCounts>): string {
  const total = c.total - c.aborted
  const uploaded = c.itemCreated
  const failed = c.failed + c.itemFailed
  // Waiting their turn (queued, validating, paused, saving): the four parts add up to the total.
  const left = total - uploaded - failed - c.uploading
  // While anything is unfinished every part stays, zeros included: parts
  // that came and went on each tick made the line jump (owner, 14 Nov).
  const active = uploaded + failed < total
  return [
    `${uploaded} of ${total} uploaded`,
    active && `${c.uploading} uploading`,
    active && `${left} left`,
    failed > 0 && `${failed} failed`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A New panel action, drawn as a color-mode switch tile. */
const NEW_TILE = cn(
  segmentedControlItemVariants({ size: 'tile' }),
  // border-0: the upload Trigger brings its own border, which the switch has not.
  'w-full border-0 text-foreground hover:bg-card'
)

function StashlyUpload({
  folderId,
  rootId,
}: {
  folderId: string | undefined
  rootId: string | undefined
}) {
  const hasUploads = useUploadFileIds().length > 0
  const counts = useUploadCounts()
  const { uploading } = counts
  const summary = uploadSummary(counts)
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  if (location.pathname.includes('files')) {
    return null
  }

  return (
    <ButtonGroup className="border-none ring-2 ring-accent rounded-md bg-card">
      <Popover modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger className="cursor-pointer" asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New and upload"
            className="relative hover:cursor-pointer hover:bg-muted rounded-md hover:rounded-md  items-center! flex aria-expanded:bg-accent/30 aria-expanded:text-accent-foreground  data-[state=open]:bg-accent/30 data-[state=open]:text-accent-foreground hover:last:rounded-r-md!"
          >
            <UploadFillIcon className="size-5! text-muted-foreground" />
            {/* Uploads running. Square-ish, not a dot: no round shapes. */}
            {uploading > 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 size-1.5 rounded-[2px] bg-primary"
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          // As in the color-mode switch: focusing the first tile on open drew
          // the white keyboard ring. Tab still reaches the tiles.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-90 max-w-[calc(100vw-2rem)] rounded-3xl border-input bg-card p-2 font-stashly shadow-stashly"
        >
          {/* The drop target the floating upload panel used to be: files and
              folders (several at once) dropped anywhere on this panel upload
              into the current folder. Nowhere else changes. */}
          <DropArea
            folderId={folderId}
            data-testid="upload-drop-area"
            className="flex aspect-auto flex-col place-items-stretch gap-4 rounded-2xl border-0 p-2"
          >
          {/* The color-mode switch's track and tiles, as the owner asked. These
              are actions, not a choice, so they stay buttons (and labels for
              the file pickers) that only look like the switch. */}
          <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border/60 bg-muted p-0.75">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setNewFolderOpen(true)
              }}
              className={NEW_TILE}
            >
              <AddFoldersIcon aria-hidden />
              New folder
            </button>
            <Trigger id="upload-files" folderId={folderId} className={NEW_TILE}>
              <UploadFileFillIcon aria-hidden />
              Upload files
            </Trigger>
            <Trigger
              id="upload-folder"
              folderId={folderId}
              webkitdirectory=""
              className={NEW_TILE}
            >
              <UploadFolderFillIcon aria-hidden />
              Upload folder
            </Trigger>
          </div>
          {/* Hidden while the session has no uploads. */}
          {hasUploads && (
            <section className="flex flex-col gap-2.5">
              {/* Left-aligned beside the caption, so a changing count only
                  moves the end of the line, never its start. */}
              <div className="flex min-w-0 items-baseline gap-3">
                <h3 className={cn(INVITE_CAPTION, 'shrink-0')}>Uploads</h3>
                <p className="min-w-0 truncate font-stashly text-xs text-muted-foreground tabular-nums">
                  {summary}
                </p>
              </div>
              {/* The upload list's own rows: each keeps its status, error
                  tooltip, progress ring and hover controls. */}
              <FileList className="h-full" />
            </section>
          )}
          </DropArea>
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
