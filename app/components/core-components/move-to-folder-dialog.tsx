import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher, href } from 'react-router'
import { useMoveToFolder } from '@/hooks/useMoveToFolder'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import { cn } from '@/utils/styles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import {
  AddFoldersIcon,
  DropdownIcon,
  FolderFillIcon,
  FolderIcon,
  ImageFillIcon,
  MoveFillIcon,
  RemoveIcon,
  SearchFillIcon,
} from '@/components/icons'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/ui/command'
import { Input } from '@/ui/input'
import { ScrollArea } from '@/ui/scroll-area'
import type { JSX } from 'react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../ui'
import { toUserInitial } from '@/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FolderNode {
  id: string
  name: string
  parentId: string | null
  childFolderCount: number
  _new?: boolean
}

interface PathNode {
  id: string
  name: string
}

type FolderLoaderData = {
  rootId: string
  folders: FolderNode[]
}

type CreateFolderData = {
  folder?: FolderNode
  error?: string
}

export interface MoveToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID of the item(s) being moved */
  itemId: string
  /** Display name shown in the header */
  itemName: string
  /** file | folder */
  itemType: 'file' | 'folder'
  /** Current parent folder ID — disabled in the picker */
  sourceParentId: string | null
  /** Optional display name of the source parent, shown in the header for context */
  sourceParentName?: string | null
  /** Drive ID for creating new folders */
  driveId: string
  /** Optional thumbnail URL for the header */
  thumbnailUrl?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MoveToFolderDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  sourceParentId,
  driveId,
  thumbnailUrl,
  sourceParentName,
}: MoveToFolderDialogProps) {
  const [path, setPath] = useState<PathNode[]>([])
  const [childrenMap, setChildrenMap] = useState<Record<string, FolderNode[]>>(
    {}
  )
  const [query, setQuery] = useState('')
  const [editingNewFolder, setEditingNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const folderFetcher = useFetcher<FolderLoaderData>()
  const createFetcher = useFetcher<CreateFolderData>()
  const { move, isPending: isMovePending } = useMoveToFolder(
    sourceParentId ?? ''
  )

  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pendingLoadRef = useRef<string | null>(null)
  const fetcherModeRef = useRef<'browse' | 'search'>('browse')

  const current = path[path.length - 1] ?? null
  const isSource = current?.id === sourceParentId
  const isLoading = folderFetcher.state !== 'idle'

  // ── reset + initial load on open ──
  useEffect(() => {
    if (!open) return
    setPath([])
    setChildrenMap({})
    setQuery('')
    setEditingNewFolder(false)
    setNewFolderName('')
    fetcherModeRef.current = 'browse'
    pendingLoadRef.current = 'root'
    if (!folderFetcher.data && folderFetcher.state === 'idle') {
      folderFetcher.load('/api/items?intent=list_folders&parentId=root')
    }
  }, [open])

  // ── handle browse responses — update children cache ──
  useEffect(() => {
    if (
      !folderFetcher.data ||
      fetcherModeRef.current !== 'browse' ||
      !pendingLoadRef.current
    )
      return
    const key = pendingLoadRef.current
    pendingLoadRef.current = null
    const { rootId, folders } = folderFetcher.data
    if (key === 'root') {
      setPath([{ id: rootId, name: 'All files' }])
      setChildrenMap({ [rootId]: folders })
    } else {
      setChildrenMap((m) => ({ ...m, [key]: folders }))
    }
  }, [folderFetcher.data])

  // ── handle new folder creation response ──
  useEffect(() => {
    if (!createFetcher.data?.folder) return
    const newFolder = createFetcher.data.folder
    const parentId = newFolder.parentId ?? current?.id
    if (!parentId) return
    const newNode: FolderNode = { ...newFolder, _new: true }
    setChildrenMap((m) => ({
      ...m,
      [parentId]: [...(m[parentId] ?? []), newNode].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }))
    setEditingNewFolder(false)
    setNewFolderName('Untitled folder')
    drillInto(newNode)
  }, [createFetcher.data])

  // ── debounced search ──
  // The trimmed query is what gets committed, so leading or trailing
  // whitespace does not count as a change and re-run the search.
  useDebouncedCommit(query.trim(), (q) => {
    if (!q) return
    fetcherModeRef.current = 'search'
    folderFetcher.load(
      `/api/items?intent=search_folders&q=${encodeURIComponent(q)}`
    )
  })

  // ── focus new folder input ──
  useEffect(() => {
    if (editingNewFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
      newFolderInputRef.current.select()
    }
  }, [editingNewFolder])

  // ── keyboard shortcut: ⌘F focuses search ──
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function loadChildren(nodeId: string) {
    if (childrenMap[nodeId] !== undefined) return
    pendingLoadRef.current = nodeId
    folderFetcher.load(`/api/items?intent=list_folders&parentId=${nodeId}`)
  }

  const drillInto = useCallback(
    (node: FolderNode | PathNode) => {
      setQuery('')
      setEditingNewFolder(false)
      setPath((p) => [...p, { id: node.id, name: node.name }])
      loadChildren(node.id)
    },
    [childrenMap]
  )

  function jumpTo(index: number) {
    const target = path[index]
    setPath((p) => p.slice(0, index + 1))
    setQuery('')
    setEditingNewFolder(false)
    if (!childrenMap[target.id]) {
      pendingLoadRef.current = target.id
      fetcherModeRef.current = 'browse'
      folderFetcher.load(`/api/items?intent=list_folders&parentId=${target.id}`)
    }
  }

  function openSearchResult(folder: FolderNode) {
    setQuery('')
    setPath((prev) => {
      const root = prev[0]
      if (!root) return prev
      return [root, { id: folder.id, name: folder.name }]
    })
    loadChildren(folder.id)
  }

  const commitNewFolder = useCallback(
    (name: string) => {
      if (!name.trim()) {
        setEditingNewFolder(false)
        return
      }
      createFetcher.submit(
        {
          intent: 'create_folder_inline',
          name: name.trim(),
          parentId: current.id,
          driveId,
        },
        { method: 'POST', action: href('/api/items') }
      )
    },
    [current]
  )

  function handleMove() {
    if (!current) return
    // `itemId` is documented as "the item(s) being moved" — split so a bulk
    // selection reaches `useMoveToFolder` as N ids and picks the `move_items`
    // intent. A single id still yields a 1-element array, i.e. `move_item`.
    move(current.id, itemId.split(',').filter(Boolean))
    onOpenChange(false)
  }

  const currentFolders = current ? (childrenMap[current.id] ?? null) : null
  const currentParentName =
    currentFolders?.find((f) => f.id === sourceParentId)?.name ??
    sourceParentName
  const searchResults = query.trim()
    ? fetcherModeRef.current === 'search'
      ? (folderFetcher.data?.folders ??
        (folderFetcher.state !== 'idle' ? null : undefined))
      : null
    : undefined

  const isRoot = current?.id === path[0]?.id
  const destLabel = isRoot ? 'All' : (current?.name ?? '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-md overflow-hidden flex flex-col border-input bg-sidebar! focus:border-none p-4"
        forceMount
      >
        {/* ── Header ── */}
        <DialogHeader className="flex flex-row items-start h-full">
          {thumbnailUrl ? (
            <Avatar className="h-10 w-10 rounded-md border-input border">
              <AvatarImage
                src={thumbnailUrl}
                alt={itemName}
                className="object-cover scale-125 "
              />
              <AvatarFallback className="rounded-sm font-stashly">
                {toUserInitial(itemName)}
              </AvatarFallback>
            </Avatar>
          ) : itemType === 'folder' ? (
            <FolderFillIcon className="size-5" />
          ) : (
            <ImageFillIcon className="size-5" />
          )}
          <div className=" flex flex-col items-start gap-1">
            <DialogTitle className="truncate max-w-4/5">
              {itemName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              in {currentParentName}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* ── Search ── */}
        <div className="pb-2">
          <InputGroup className="bg-card! h-10">
            <InputGroupAddon align="inline-start">
              <SearchFillIcon className="size-5 text-muted-foreground shrink-0" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              ref={searchInputRef}
              placeholder="Search folders"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton asChild className="size-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuery('')}
                  >
                    <RemoveIcon className="size-5" />
                  </Button>
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* ── Breadcrumb (hidden during search) ── */}
        {!query && path.length > 0 && (
          <div className="flex items-center gap-px pb-3 flex-nowrap overflow-hidden">
            {path.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && (
                  <span className="text-muted-foreground/60 grid place-items-center shrink-0">
                    <DropdownIcon className="size-5 -rotate-90" />
                  </span>
                )}
                <button
                  className={cn(
                    'text-xs text-muted-foreground bg-transparent border-0 cursor-pointer px-2 py-1 rounded-md font-stashly whitespace-nowrap max-w-32 overflow-hidden text-ellipsis transition-[background,color]',
                    i === path.length - 1
                      ? 'text-foreground font-semibold hover:bg-transparent cursor-default'
                      : 'hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => i < path.length - 1 && jumpTo(i)}
                >
                  {n.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Body / Folder List ── */}
        <Command
          shouldFilter={false}
          className="flex-1 min-h-12 flex flex-col bg-transparent"
        >
          <ScrollArea className="h-full">
            <CommandList className="max-h-75 flex-1">
              {query ? (
                /* Search results */
                folderFetcher.state !== 'idle' ? (
                  <CommandEmpty>
                    <EmptyState label="Searching…" />
                  </CommandEmpty>
                ) : searchResults && searchResults.length === 0 ? (
                  <CommandEmpty>
                    <EmptyState label={`No folders match "${query}"`} />
                  </CommandEmpty>
                ) : searchResults ? (
                  <CommandGroup className="p-0">
                    {searchResults.map((folder: FolderNode) => {
                      const disabled = folder.id === sourceParentId
                      return (
                        <CommandItem
                          key={folder.id}
                          disabled={disabled}
                          onSelect={() => !disabled && openSearchResult(folder)}
                          className={cn(
                            'flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer',
                            disabled && 'cursor-not-allowed opacity-55'
                          )}
                        >
                          <div className="shrink-0 size-8 grid place-items-center">
                            <FolderFillIcon className="size-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium tracking-tight truncate">
                              {folder.name}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1 text-muted-foreground/60">
                            {disabled ? (
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                                Current
                              </span>
                            ) : (
                              <span className="size-5 grid place-items-center">
                                <DropdownIcon className="size-5 -rotate-90" />
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                ) : null
              ) : isLoading && !currentFolders ? (
                /* Loading state */
                <CommandEmpty>
                  <EmptyState label="Loading…" />
                </CommandEmpty>
              ) : (
                /* Drill-down list */
                <CommandGroup className="p-0">
                  {currentFolders?.length === 0 && !editingNewFolder && (
                    <EmptyState
                      label="No sub folders"
                      sub="Move here, or create a subfolder below."
                    />
                  )}

                  {currentFolders?.map((node) => {
                    const disabled =
                      node.id === sourceParentId && node.childFolderCount === 0
                    return (
                      <CommandItem
                        key={node.id}
                        disabled={disabled}
                        onSelect={() => !disabled && drillInto(node)}
                        className={cn(
                          'flex items-center gap-2 rounded-md cursor-pointer hover:bg-transparent! bg-transparent! ',
                          disabled && 'cursor-not-allowed opacity-55'
                        )}
                        value={node.id}
                      >
                        <div className="shrink-0 size-8 grid place-items-center">
                          <FolderIcon className="size-6 fill-current!" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium tracking-tight truncate">
                            {node.name}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 text-muted-foreground/60">
                          {disabled ? (
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                              Current
                            </span>
                          ) : node._new ? (
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                              New
                            </span>
                          ) : null}
                          {!disabled && (
                            <span className="size-5 grid place-items-center">
                              <DropdownIcon className="size-5 -rotate-90" />
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}

                  {/* New folder row */}
                  {editingNewFolder ? (
                    <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-card border border-ring shadow-[0_0_0_3px_oklch(0.708_0_0_/_0.16)]">
                      <div className="shrink-0 size-8 grid place-items-center text-foreground">
                        <FolderIcon className="size-6 fill-current" />
                      </div>
                      <Input
                        ref={newFolderInputRef}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitNewFolder(newFolderName)
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditingNewFolder(false)
                            setNewFolderName('')
                          }
                        }}
                        onBlur={() => commitNewFolder(newFolderName)}
                        className="flex-1 min-w-0 border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm font-medium h-auto py-0 px-0"
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 shrink-0">
                        New
                      </span>
                    </div>
                  ) : (
                    <CommandItem
                      onSelect={() => setEditingNewFolder(true)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-muted-foreground mt-1 border border-dashed border-input hover:text-foreground"
                    >
                      <AddFoldersIcon className="size-5" />
                      <span className="text-sm font-medium">New folder</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </ScrollArea>
        </Command>

        {/* ── Footer ── */}
        <DialogFooter className="mt-4">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="shrink-0 text-muted-foreground grid place-items-center">
              <MoveFillIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground/60">
                Destination
              </div>
              <div
                className={cn(
                  'text-xs font-semibold tracking-tight truncate',
                  !current && 'text-muted-foreground font-medium'
                )}
              >
                {current ? destLabel : 'Choose a folder…'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!current || isSource || isMovePending}
              title={isSource ? 'Items are already here' : undefined}
              onClick={handleMove}
              variant="default"
            >
              {isSource
                ? 'Already here'
                : isRoot
                  ? 'Move to top level'
                  : 'Move'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  label,
  sub,
}: {
  label: string
  sub?: string
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center px-8">
      <FolderFillIcon className="size-10 opacity-40 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-xs mt-1 text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  )
}
