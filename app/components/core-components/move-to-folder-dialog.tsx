import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher, href } from 'react-router'
import { cn } from '@/utils/styles'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/ui/dialog'
import {
  AddFoldersIcon,
  DropdownIcon,
  FolderFillIcon,
  FolderIcon,
  ImageFillIcon,
  MoveFillIcon,
  MoveToFolder,
  RemoveIcon,
  SearchFillIcon,
} from '@/components/icons'
import type { JSX } from 'react'
import { Button } from '../ui'


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
}: MoveToFolderDialogProps) {
  const [path, setPath] = useState<PathNode[]>([])
  const [childrenMap, setChildrenMap] = useState<Record<string, FolderNode[]>>(
    {}
  )
  const [query, setQuery] = useState('')
  const [editingNewFolder, setEditingNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const folderFetcher = useFetcher<FolderLoaderData>()
  const moveFetcher = useFetcher()
  const createFetcher = useFetcher<CreateFolderData>()

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
    folderFetcher.load('/api/items?intent=list_folders&parentId=root')
  }, [open])

  // ── handle browse responses — update children cache ──
  useEffect(() => {
    if (!folderFetcher.data || fetcherModeRef.current !== 'browse' || !pendingLoadRef.current) return
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
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const timer = setTimeout(() => {
      fetcherModeRef.current = 'search'
      folderFetcher.load(
        `/api/items?intent=search_folders&q=${encodeURIComponent(q)}`
      )
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

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

  const commitNewFolder = useCallback((name: string) => {
    if (!name.trim() || !current) {
      setEditingNewFolder(false)
      setNewFolderName('')
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
  },[current])

  function handleMove() {
    if (!current) return
    moveFetcher.submit(
      {
        intent: 'move_item',
        selectedItem: itemId,
        targetFolderId: current.id,
      },
      { method: 'POST', action: href('/api/items') }
    )
    onOpenChange(false)
  }

  const currentFolders = current ? (childrenMap[current.id] ?? null) : null
  const searchResults = query.trim()
    ? (fetcherModeRef.current === 'search'
        ? (folderFetcher.data?.folders ?? (folderFetcher.state !== 'idle' ? null : undefined))
        : null)
    : undefined

  const isRoot = current?.id === path[0]?.id
  const destLabel = isRoot ? 'All files' : (current?.name ?? '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" w-md overflow-hidden flex flex-col border-input bg-sidebar!">
        {/* ── Header ── */}
        <DialogHeader>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Move to folder
            </div>
            <div className="flex items-center gap-[10px] mt-[9px]">
              {/* thumb stack */}
              <div className="relative w-[38px] h-[30px] flex-shrink-0">
                <div
                  className="absolute w-[26px] h-[26px] rounded-[6px] border-[1.5px] border-background bg-muted grid place-items-center text-muted-foreground/60 overflow-hidden shadow-sm"
                  style={{ left: 0, top: 0, zIndex: 3 }}
                >
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : itemType === 'folder' ? (
                    <FolderFillIcon className="w-[14px] h-[14px]" />
                  ) : (
                    <ImageFillIcon className="size-5" />
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.01em] truncate leading-tight">
                  {itemName}
                </div>
              </div>
            </div>
          </div>

        </DialogHeader>

        {/* ── Search ── */}
        <div className="px-4 pb-3">
          <div
            className={cn(
              'flex items-center gap-2 h-[38px] px-3 border border-input rounded-[8px] bg-card transition-[border-color,box-shadow]',
              'focus-within:border-ring focus-within:shadow-[0_0_0_3px_oklch(0.708_0_0_/_0.16)]'
            )}
          >
            <SearchFillIcon className="w-[17px] h-[17px] text-muted-foreground flex-shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              placeholder="Search folders"
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 outline-none bg-transparent text-[14px] w-full text-foreground placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                className="w-[22px] h-[22px] grid place-items-center"
                onClick={() => setQuery('')}
              >
                <RemoveIcon className="size-5" />
              </button>
            ) : (
              <kbd className="font-mono text-[10px] text-muted-foreground bg-muted border border-border rounded px-[5px] py-[1px] leading-[1.4]">
                ⌘F
              </kbd>
            )}
          </div>
        </div>

        {/* ── Breadcrumb (hidden during search) ── */}
        {!query && path.length > 0 && (
          <div className="flex items-center gap-[1px] px-4 pb-3 flex-nowrap overflow-hidden">
            {path.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && (
                  <span className="text-muted-foreground/60 grid place-items-center flex-shrink-0">
                    <DropdownIcon className="size-5 rotate-45" />
                  </span>
                )}
                <button
                  className={cn(
                    'text-[12.5px] text-muted-foreground bg-transparent border-0 cursor-pointer px-[7px] py-[3px] rounded-[6px] font-sans whitespace-nowrap max-w-[130px] overflow-hidden text-ellipsis transition-[background,color]',
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

        {/* ── Body / List ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
            {query ? (
              /* Search results */
              folderFetcher.state !== 'idle' ? (
                <EmptyState label="Searching…" />
              ) : searchResults && searchResults.length === 0 ? (
                <EmptyState label={`No folders match "${query}"`} />
              ) : searchResults ? (
                searchResults.map((folder: FolderNode) => {
                  const disabled = folder.id === sourceParentId
                  return (
                    <button
                      key={folder.id}
                      disabled={disabled}
                      className={cn(
                        'flex items-center gap-[11px] w-full text-left px-[10px] py-[9px] rounded-[8px] border-0 bg-transparent cursor-pointer font-sans text-foreground transition-[background]',
                        disabled
                          ? 'cursor-not-allowed opacity-55 hover:bg-transparent'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => !disabled && openSearchResult(folder)}
                    >
                      <div className="flex-shrink-0 w-[30px] h-[30px] grid place-items-center text-foreground">
                        <FolderFillIcon className="w-[26px] h-[26px]" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="text-[14px] font-medium tracking-[-0.01em] truncate">
                          {folder.name}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-muted-foreground/60">
                        {disabled ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted border border-border rounded-[5px] px-[6px] py-[2px]">
                            Current
                          </span>
                        ) : (
                          <span className="w-[22px] h-[22px] grid place-items-center">
                            <DropdownIcon className="size-5 rotate-45" />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              ) : null
            ) : isLoading && !currentFolders ? (
              /* Loading skeleton */
              <EmptyState label="Loading…" />
            ) : (
              /* Drill-down list */
              <>
                {currentFolders?.length === 0 && !editingNewFolder && (
                  <EmptyState
                    label="No sub folders"
                    sub="Move here, or create a subfolder below."
                  />
                )}
                {currentFolders?.map((node) => {
                  const disabled = node.id === sourceParentId
                  return (
                    <button
                      key={node.id}
                      disabled={disabled}
                      className={cn(
                        'flex items-center gap-[11px] w-full text-left px-[10px] py-[9px] rounded-[8px] border-0 bg-transparent cursor-pointer font-sans text-foreground transition-[background]',
                        disabled
                          ? 'cursor-not-allowed opacity-55 hover:bg-transparent'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => !disabled && drillInto(node)}
                    >
                      <div className="flex-shrink-0 w-[30px] h-[30px] grid place-items-center text-foreground">
                        <FolderIcon className="size-6 fill-current!" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium tracking-[-0.01em] truncate">
                          {node.name}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-muted-foreground/60">
                        {disabled ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted border border-border rounded-[5px] px-[6px] py-[2px]">
                            Current
                          </span>
                        ) : node._new ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted border border-border rounded-[5px] px-[6px] py-[2px]">
                            New
                          </span>
                        ) : null}
                        {!disabled && (
                          <span className="w-[22px] h-[22px] grid place-items-center">
                            <DropdownIcon className="size-5 -rotate-90" />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* New folder row */}
                {editingNewFolder ? (
                  <div className="flex items-center gap-[11px] px-[10px] py-[7px] rounded-[8px] bg-card border border-ring shadow-[0_0_0_3px_oklch(0.708_0_0_/_0.16)]">
                    <div className="flex-shrink-0 w-[30px] h-[30px] grid place-items-center text-foreground">
                      <FolderIcon className="size-6 fill-current" />
                    </div>
                    <input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitNewFolder(newFolderName)
                        if (e.key === 'Escape') {
                          setEditingNewFolder(false)
                          setNewFolderName('Untitled folder')
                        }
                      }}
                      onBlur={() => commitNewFolder(newFolderName)}
                      className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[14px] font-medium text-foreground"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted border border-border rounded-[5px] px-[6px] py-[2px]">
                      New
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-md bg-card border border-input"
                    onClick={() => setEditingNewFolder(true)}
                  >
                    <AddFoldersIcon className="size-6" />
                    <span className="text-sm font-medium">New folder</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-shrink-0 text-muted-foreground grid place-items-center">
              <MoveFillIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/60">
                Destination
              </div>
              <div
                className={cn(
                  'text-[13px] font-semibold tracking-[-0.01em] truncate',
                  !current && 'text-muted-foreground font-medium'
                )}
              >
                {current ? destLabel : 'Choose a folder…'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="h-9 px-4 rounded-[8px] text-[13.5px] font-medium cursor-pointer bg-transparent border-0 text-foreground hover:bg-muted transition-colors"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              disabled={!current || isSource}
              title={isSource ? 'Items are already here' : undefined}
              className={cn(
                'h-9 px-4 rounded-[8px] text-[13.5px] font-medium cursor-pointer flex items-center gap-[7px] whitespace-nowrap border-0 transition-[background,opacity]',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary'
              )}
              onClick={handleMove}
            >
              <MoveFillIcon className="w-[17px] h-[17px]" />
              {isSource
                ? 'Already here'
                : isRoot
                  ? 'Move to top level'
                  : 'Move here'}
            </button>
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
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground/40 text-center px-8">
      <FolderFillIcon className="w-10 h-10 opacity-40" />
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[13px] mt-1">{sub}</p>}
      </div>
    </div>
  )
}
