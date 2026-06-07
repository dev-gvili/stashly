import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher, href } from 'react-router'
import { cn } from '@/utils/styles'
import { Dialog, DialogContent } from '@/ui/dialog'
import { AddFoldersIcon, MoveToFolder } from '@/components/icons'
import type { JSX } from 'react'

// ── inline SVGs (match the design; not in icons.tsx) ──────────────────────────

function FolderFillIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        fill="currentColor"
        opacity="0.5"
        d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.119.28.255.554.529L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c2.632 0 3.949 0 4.804.77q.119.105.224.224c.77.855.77 2.172.77 4.804V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14z"
      />
      <path
        fill="currentColor"
        d="M20 6.238c-.001-.298-.005-.475-.026-.63a3 3 0 0 0-2.582-2.582C17.197 3 16.965 3 16.5 3H9.988c.116.104.247.234.462.45L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c1.78 0 2.957 0 3.798.238"
      />
    </svg>
  )
}

function ChevronIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9 6 6 6-6 6"
      />
    </svg>
  )
}

function CheckIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7 12.9 3.143 3.6L18 7.5"
      />
    </svg>
  )
}

function SearchIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle
        cx="11"
        cy="11"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.6"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M17 17l3.5 3.5"
      />
    </svg>
  )
}

function XMarkIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="m7.5 7.5 9 9"
        opacity="0.5"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="m7.5 16.5 9-9"
      />
    </svg>
  )
}

function ImageGlyph(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m4 17 4.5-4 3.5 3 3-2.5L21 17" />
    </svg>
  )
}

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
  const [childrenMap, setChildrenMap] = useState<Record<string, FolderNode[]>>({})
  const [query, setQuery] = useState('')
  const [editingNewFolder, setEditingNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('Untitled folder')

  const loadFetcher = useFetcher<FolderLoaderData>()
  const searchFetcher = useFetcher<FolderLoaderData>()
  const moveFetcher = useFetcher()
  const createFetcher = useFetcher<CreateFolderData>()

  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pendingLoadRef = useRef<string | null>(null)

  const current = path[path.length - 1] ?? null
  const isSource = current?.id === sourceParentId
  const isLoading = loadFetcher.state !== 'idle'

  // ── reset + initial load on open ──
  useEffect(() => {
    if (!open) return
    setPath([])
    setChildrenMap({})
    setQuery('')
    setEditingNewFolder(false)
    setNewFolderName('Untitled folder')
    pendingLoadRef.current = 'root'
    loadFetcher.load('/api/items?intent=list_folders&parentId=root')
  }, [open])

  // ── handle load responses ──
  useEffect(() => {
    if (!loadFetcher.data || !pendingLoadRef.current) return
    const key = pendingLoadRef.current
    pendingLoadRef.current = null
    const { rootId, folders } = loadFetcher.data
    if (key === 'root') {
      setPath([{ id: rootId, name: 'All files' }])
      setChildrenMap({ [rootId]: folders })
    } else {
      setChildrenMap((m) => ({ ...m, [key]: folders }))
    }
  }, [loadFetcher.data])

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
      searchFetcher.load(
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
    loadFetcher.load(`/api/items?intent=list_folders&parentId=${nodeId}`)
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
      loadFetcher.load(`/api/items?intent=list_folders&parentId=${target.id}`)
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

  function commitNewFolder(name: string) {
    if (!name.trim() || !current) {
      setEditingNewFolder(false)
      setNewFolderName('Untitled folder')
      return
    }
    createFetcher.submit(
      {
        intent: 'create_folder_inline',
        name: name.trim(),
        parentId: current.id,
        driveId,
      },
      { method: 'post', action: '/api/items' }
    )
  }

  function handleMove() {
    if (!current) return
    moveFetcher.submit(
      {
        intent: 'move_item',
        selectedItem: itemId,
        targetFolderId: current.id,
      },
      { method: 'post', action: href('/api/items') }
    )
    onOpenChange(false)
  }

  const currentFolders = current ? (childrenMap[current.id] ?? null) : null
  const searchResults = query.trim()
    ? (searchFetcher.data?.folders ?? (searchFetcher.state !== 'idle' ? null : undefined))
    : undefined

  const isRoot = current?.id === path[0]?.id
  const destLabel =
    isRoot ? 'All files' : (current?.name ?? '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 w-[440px] max-w-[440px] overflow-hidden flex flex-col border-input">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-5 pt-[18px] pb-[14px]">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Move to folder
            </div>
            <div className="flex items-center gap-[10px] mt-[9px]">
              {/* thumb stack */}
              <div className="relative w-[38px] h-[30px] flex-shrink-0">
                <div className="absolute w-[26px] h-[26px] rounded-[6px] border-[1.5px] border-background bg-muted grid place-items-center text-muted-foreground/60 overflow-hidden shadow-sm" style={{ left: 0, top: 0, zIndex: 3 }}>
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} className="w-full h-full object-cover" alt="" />
                  ) : itemType === 'folder' ? (
                    <FolderFillIcon className="w-[14px] h-[14px]" />
                  ) : (
                    <ImageGlyph className="w-[14px] h-[14px]" />
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
          <button
            className="flex-shrink-0 w-8 h-8 rounded-[8px] border border-input bg-card grid place-items-center cursor-pointer text-foreground shadow-sm hover:bg-accent transition-colors"
            onClick={() => onOpenChange(false)}
            title="Close"
          >
            <XMarkIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-4 pb-3">
          <div
            className={cn(
              'flex items-center gap-2 h-[38px] px-3 border border-input rounded-[8px] bg-card transition-[border-color,box-shadow]',
              'focus-within:border-ring focus-within:shadow-[0_0_0_3px_oklch(0.708_0_0_/_0.16)]'
            )}
          >
            <SearchIcon className="w-[17px] h-[17px] text-muted-foreground flex-shrink-0" />
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
                <XMarkIcon className="w-[15px] h-[15px]" />
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
                    <ChevronIcon className="w-[13px] h-[13px]" />
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
              searchFetcher.state !== 'idle' ? (
                <EmptyState label="Searching…" />
              ) : searchResults && searchResults.length === 0 ? (
                <EmptyState label={`No folders match "${query}"`} />
              ) : searchResults ? (
                searchResults.map((folder) => {
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
                            <ChevronIcon className="w-[16px] h-[16px]" />
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
                    label="This folder is empty"
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
                        <FolderFillIcon className="w-[26px] h-[26px]" />
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
                            <ChevronIcon className="w-[16px] h-[16px]" />
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
                      <FolderFillIcon className="w-[26px] h-[26px]" />
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
                  <button
                    className="flex items-center gap-[11px] w-full text-left px-[10px] py-[9px] rounded-[8px] border-0 bg-transparent cursor-pointer font-sans text-muted-foreground transition-[background,color] hover:bg-muted hover:text-foreground"
                    onClick={() => setEditingNewFolder(true)}
                  >
                    <div className="flex-shrink-0 w-[30px] h-[30px] grid place-items-center">
                      <AddFoldersIcon className="w-[26px] h-[26px]" />
                    </div>
                    <span className="text-[14px] font-medium">New folder</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-input bg-sidebar">
          {/* Destination indicator */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-shrink-0 text-muted-foreground grid place-items-center">
              <MoveToFolder className="w-[18px] h-[18px]" />
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
              <MoveToFolder className="w-[17px] h-[17px]" />
              {isSource ? 'Already here' : isRoot ? 'Move to top level' : 'Move here'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, sub }: { label: string; sub?: string }): JSX.Element {
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
