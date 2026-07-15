import { Grid, LayoutToggle, List, River, Waterfall } from './layout-toggle'
import { ModeToggle } from './color-mode'
import { HeaderFilters } from './filters/filters'
import {
  DropdownIcon,
  UploadFillIcon,
  FolderFillIcon,
  AddFoldersIcon,
  UploadFileFillIcon,
  UploadFolderFillIcon,
  ArrowLeftFillIcon,
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
import {
  href,
  useFetcher,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router'
import { Popover, PopoverContent, PopoverTrigger, Separator } from './ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useEffect, useState } from 'react'
import type { Route } from '../routes/+types/layout'
import { useLocation } from 'react-router'
import { useBreadcrumbs } from '@/hooks'
import { Breadcrumbs } from './core-components/breadcrumb-navigation'
import { cn } from '@/utils'

export function AppHeader() {
  let { toggleView } = useUpload()
  const { folderId, fileId } = useParams()
  let navigate = useNavigate()
  return (
    <header className="bg-background z-40 flex items-center h-14 justify-between pl-0 pr-2 py-2 sticky top-0 shrink-0 gap-2">
      {/* <SidebarTrigger
        variant="outline"
        size="icon"
        className="font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground  rounded-md!"
      /> */}
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
  const location = useLocation()
  if (location.pathname.includes('files')) {
    return null
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)

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

function NewFolderDialog({
  open,
  onOpenChange,
  folderId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string | undefined
}) {
  const user =
    useRouteLoaderData<Route.ComponentProps['loaderData']>('layout')!.user
  const fetcher = useFetcher<{ success: boolean; error?: string }>()
  const [name, setName] = useState('')
  const isSubmitting = fetcher.state !== 'idle'

  useEffect(() => {
    if (!open) {
      setName('')
      return
    }
  }, [open])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onOpenChange(false)
    }
  }, [fetcher.state, fetcher.data, onOpenChange])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !user.driveId) return
    const parentId = folderId ?? user.rootId
    if (!parentId) return
    onOpenChange(false)
    fetcher.submit(
      {
        intent: 'create_folder',
        name: trimmed,
        parentId,
        driveId: user.driveId,
      },
      { method: 'post', action: href('/api/items') }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a new folder in the current location.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="new-folder-name">Name</Label>
            <Input
              id="new-folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled folder"
              disabled={isSubmitting}
            />
            {fetcher.data?.success === false && fetcher.data.error ? (
              <p className="text-sm text-destructive">{fetcher.data.error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
