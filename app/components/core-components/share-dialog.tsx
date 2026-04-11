import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Badge } from '@/ui/badge'
import { Switch } from '@/ui/switch'
import { Label } from '@/ui/label'
import { Separator } from '@/ui/separator'
import { ScrollArea } from '@/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { cn } from '@/utils/styles'
import { ShareItemIcon, CopyIcon, LockIcon, ShareIcon } from '@/components/icons'
import { CheckIcon } from 'lucide-react'
import { Globe, Users, Building2, Link2, Pencil, Eye, Upload, Code2, ChevronDown, Trash2, Clock } from 'lucide-react'
import type { ShareLinkType, ShareScope } from '@/prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareLinkWithPermissions {
  id: string
  type: ShareLinkType
  scope: ShareScope
  url: string | null
  downloadable: boolean | null
  password: string | null
  expiresAt: Date | string | null
  createdAt: Date | string
  permission: {
    id: string
    roles: string
    users: { id: string; name: string | null; image: string | null }[]
  }[]
}

export interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemName: string
  itemType: 'file' | 'folder' | 'collection'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_OPTIONS: { value: ShareScope; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'anonymous', label: 'Anyone with the link', icon: Globe, description: 'No sign-in required' },
  { value: 'organization', label: 'Workspace members', icon: Building2, description: 'Must be a workspace member' },
  { value: 'users', label: 'Specific people', icon: Users, description: 'Only invited users' },
]

const TYPE_OPTIONS: { value: ShareLinkType; label: string; icon: React.ElementType; description: string; folderOnly?: boolean }[] = [
  { value: 'view', label: 'View only', icon: Eye, description: 'Can view but not edit' },
  { value: 'edit', label: 'Can edit', icon: Pencil, description: 'Can modify content' },
  { value: 'embed', label: 'Embed', icon: Code2, description: 'Public embed (anonymous only)' },
  { value: 'upload', label: 'Upload', icon: Upload, description: 'Can add files (folder only)', folderOnly: true },
]

function typeIcon(type: ShareLinkType) {
  switch (type) {
    case 'view': return Eye
    case 'edit': return Pencil
    case 'embed': return Code2
    case 'upload': return Upload
  }
}

function scopeIcon(scope: ShareScope) {
  switch (scope) {
    case 'anonymous': return Globe
    case 'organization': return Building2
    case 'users': return Users
  }
}

function scopeLabel(scope: ShareScope) {
  return SCOPE_OPTIONS.find(o => o.value === scope)?.label ?? scope
}

function typeLabel(type: ShareLinkType) {
  return TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

function formatExpiry(expiresAt: Date | string | null) {
  if (!expiresAt) return null
  const d = new Date(expiresAt)
  if (d < new Date()) return 'Expired'
  return `Expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function buildShareUrl(link: ShareLinkWithPermissions) {
  if (link.url) return link.url
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/s/${link.id}`
  }
  return `/s/${link.id}`
}

// ---------------------------------------------------------------------------
// CopyButton — inline clipboard copy with checkmark feedback
// ---------------------------------------------------------------------------

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [value])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      className={cn('shrink-0 gap-1.5', className)}
      aria-label="Copy link"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <CheckIcon className="size-3.5 text-green-500" />
            <span className="text-xs">Copied</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <CopyIcon className="size-3.5" />
            <span className="text-xs">Copy</span>
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

// ---------------------------------------------------------------------------
// ShareLinkRow — renders one existing share link
// ---------------------------------------------------------------------------

function ShareLinkRow({
  link,
  onRevoke,
  onUpdateScope,
  onUpdateType,
  onUpdateDownloadable,
  onUpdateExpiry,
  onRemoveExpiry,
}: {
  link: ShareLinkWithPermissions
  onRevoke: (linkId: string) => void
  onUpdateScope: (linkId: string, scope: ShareScope) => void
  onUpdateType: (linkId: string, type: ShareLinkType) => void
  onUpdateDownloadable: (linkId: string, downloadable: boolean) => void
  onUpdateExpiry: (linkId: string, expiresAt: Date) => void
  onRemoveExpiry: (linkId: string) => void
}) {
  const shareUrl = buildShareUrl(link)
  const TypeIcon = typeIcon(link.type)
  const ScopeIcon = scopeIcon(link.scope)
  const expiry = formatExpiry(link.expiresAt)
  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date()
  const [showExpiry, setShowExpiry] = useState(false)
  const expiryRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header row: type + scope badges + revoke */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs font-stashly">
                <TypeIcon className="size-3.5" />
                {typeLabel(link.type)}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {TYPE_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => onUpdateType(link.id, opt.value)}
                  className={cn(link.type === opt.value && 'bg-accent')}
                >
                  <opt.icon className="size-3.5 mr-2" />
                  <div>
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Scope selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs font-stashly" disabled={link.type === 'embed'}>
                <ScopeIcon className="size-3.5" />
                {scopeLabel(link.scope)}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {SCOPE_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => onUpdateScope(link.id, opt.value)}
                  className={cn(link.scope === opt.value && 'bg-accent')}
                >
                  <opt.icon className="size-3.5 mr-2" />
                  <div>
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Expiry badge */}
          {expiry && (
            <Badge
              variant={isExpired ? 'destructive' : 'secondary'}
              className="h-7 gap-1 text-xs font-stashly cursor-pointer"
              onClick={() => setShowExpiry(v => !v)}
            >
              <Clock className="size-3" />
              {expiry}
            </Badge>
          )}
        </div>

        {/* Revoke */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onRevoke(link.id)}
          aria-label="Revoke link"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* URL row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono truncate select-all">
          {shareUrl}
        </div>
        <CopyButton value={shareUrl} />
      </div>

      {/* Downloadable toggle (view/embed only) */}
      {(link.type === 'view' || link.type === 'embed') && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground font-stashly cursor-pointer" htmlFor={`dl-${link.id}`}>
            Allow download
          </Label>
          <Switch
            id={`dl-${link.id}`}
            checked={link.downloadable ?? false}
            onCheckedChange={(v) => onUpdateDownloadable(link.id, v)}
            className="scale-75"
          />
        </div>
      )}

      {/* Expiry picker */}
      <AnimatePresence>
        {showExpiry && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-1">
              <Input
                ref={expiryRef}
                type="datetime-local"
                className="h-7 text-xs font-stashly"
                defaultValue={link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : ''}
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const val = expiryRef.current?.value
                  if (val) {
                    onUpdateExpiry(link.id, new Date(val))
                    setShowExpiry(false)
                  }
                }}
              >
                Set
              </Button>
              {link.expiresAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    onRemoveExpiry(link.id)
                    setShowExpiry(false)
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users with access (scope=users) */}
      {link.permission.length > 0 && link.permission[0].users.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-1.5 font-stashly">People with access</p>
          <div className="flex flex-wrap gap-1.5">
            {link.permission[0].users.map(u => (
              <div key={u.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                {u.image ? (
                  <img src={u.image} alt={u.name ?? ''} className="size-4 rounded-full object-cover" />
                ) : (
                  <div className="size-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-medium">
                    {u.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <span className="text-xs font-stashly truncate max-w-[120px]">{u.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CreateLinkForm — form for creating a new share link
// ---------------------------------------------------------------------------

function CreateLinkForm({
  itemId,
  itemType,
  onCreate,
}: {
  itemId: string
  itemType: 'file' | 'folder' | 'collection'
  onCreate: (intent: string, extra?: Record<string, unknown>) => void
}) {
  const [type, setType] = useState<ShareLinkType>('view')
  const [scope, setScope] = useState<ShareScope>('anonymous')
  const [downloadable, setDownloadable] = useState(false)
  const [withExpiry, setWithExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [withPassword, setWithPassword] = useState(false)
  const [password, setPassword] = useState('')

  const availableTypes = TYPE_OPTIONS.filter(
    t => !t.folderOnly || itemType === 'folder'
  )

  const handleCreate = () => {
    const intentMap: Record<ShareLinkType, string> = {
      view: 'create_view_link',
      edit: 'create_edit_link',
      embed: 'create_embed_link',
      upload: 'create_upload_link',
    }
    const intent = intentMap[type]
    const extra: Record<string, unknown> = {}
    if (type !== 'embed') extra.scope = scope
    if (type === 'view') extra.downloadable = downloadable
    if (withPassword && password) extra.password = password
    if (withExpiry && expiresAt) extra.expiresAt = expiresAt
    onCreate(intent, extra)
  }

  // Embed is always anonymous
  useEffect(() => {
    if (type === 'embed') setScope('anonymous')
  }, [type])

  return (
    <div className="space-y-4">
      {/* Link type */}
      <div>
        <Label className="text-xs text-muted-foreground font-stashly mb-2 block">Link type</Label>
        <div className="grid grid-cols-2 gap-2">
          {availableTypes.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                type === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <opt.icon className="size-4 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium font-stashly">{opt.label}</div>
                <div className="text-[10px] text-muted-foreground">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scope */}
      {type !== 'embed' && (
        <div>
          <Label className="text-xs text-muted-foreground font-stashly mb-2 block">Who can access</Label>
          <div className="space-y-1.5">
            {SCOPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScope(opt.value)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                  scope === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <opt.icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium font-stashly">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                </div>
                {scope === opt.value && <CheckIcon className="size-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      <div className="space-y-2.5">
        {type === 'view' && (
          <div className="flex items-center justify-between">
            <Label className="text-xs font-stashly cursor-pointer" htmlFor="create-downloadable">
              Allow download
            </Label>
            <Switch
              id="create-downloadable"
              checked={downloadable}
              onCheckedChange={setDownloadable}
              className="scale-75"
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-stashly cursor-pointer" htmlFor="create-expiry">
            Set expiry date
          </Label>
          <Switch
            id="create-expiry"
            checked={withExpiry}
            onCheckedChange={setWithExpiry}
            className="scale-75"
          />
        </div>
        <AnimatePresence>
          {withExpiry && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <Input
                type="datetime-local"
                className="h-8 text-xs font-stashly"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-stashly cursor-pointer" htmlFor="create-password">
            Password protect
          </Label>
          <Switch
            id="create-password"
            checked={withPassword}
            onCheckedChange={setWithPassword}
            className="scale-75"
          />
        </div>
        <AnimatePresence>
          {withPassword && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <Input
                type="password"
                placeholder="Set a password"
                className="h-8 text-xs font-stashly"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button onClick={handleCreate} className="w-full font-stashly rounded-full">
        <Link2 className="size-4 mr-2" />
        Create link
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ShareDialog — main component
// ---------------------------------------------------------------------------

export function ShareDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
}: ShareDialogProps) {
  const fetcher = useFetcher<{ links?: ShareLinkWithPermissions[]; success?: boolean; link?: ShareLinkWithPermissions }>()
  const loaderFetcher = useFetcher<{ links?: ShareLinkWithPermissions[] }>()
  const [links, setLinks] = useState<ShareLinkWithPermissions[]>([])

  // Load links when dialog opens
  useEffect(() => {
    if (open) {
      loaderFetcher.load(`/api/shares?itemId=${itemId}`)
    }
  }, [open, itemId])

  // Sync loader data into state
  useEffect(() => {
    if (loaderFetcher.data?.links) {
      setLinks(loaderFetcher.data.links)
    }
  }, [loaderFetcher.data])

  // After a mutation, reload the links
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      loaderFetcher.load(`/api/shares?itemId=${itemId}`)
    }
  }, [fetcher.state, fetcher.data])

  const submit = useCallback(
    (intent: string, extra: Record<string, unknown> = {}) => {
      fetcher.submit(
        { intent, itemId, ...extra },
        { method: 'POST', action: '/api/shares' }
      )
    },
    [fetcher, itemId]
  )

  const handleRevoke = useCallback((linkId: string) => {
    fetcher.submit(
      { intent: 'revoke_link', linkId },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleUpdateScope = useCallback((linkId: string, scope: ShareScope) => {
    fetcher.submit(
      { intent: 'update_link_scope', linkId, scope },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleUpdateType = useCallback((linkId: string, type: ShareLinkType) => {
    fetcher.submit(
      { intent: 'update_link_type', linkId, type },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleUpdateDownloadable = useCallback((linkId: string, downloadable: boolean) => {
    fetcher.submit(
      { intent: 'update_link_downloadable', linkId, downloadable: String(downloadable) },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleUpdateExpiry = useCallback((linkId: string, expiresAt: Date) => {
    fetcher.submit(
      { intent: 'expire_link', linkId, expiresAt: expiresAt.toISOString() },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleRemoveExpiry = useCallback((linkId: string) => {
    fetcher.submit(
      { intent: 'remove_link_expiry', linkId },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher])

  const handleRevokeAll = useCallback(() => {
    fetcher.submit(
      { intent: 'revoke_all_links', itemId },
      { method: 'POST', action: '/api/shares' }
    )
  }, [fetcher, itemId])

  const isLoading = loaderFetcher.state === 'loading'
  const isMutating = fetcher.state !== 'idle'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full font-stashly">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShareItemIcon className="size-5" />
            Share "{itemName}"
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="links" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="links" className="text-xs font-stashly">
              Share links
              {links.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {links.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="create" className="text-xs font-stashly">
              Create link
            </TabsTrigger>
          </TabsList>

          {/* Existing links tab */}
          <TabsContent value="links" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <div className="animate-spin size-5 rounded-full border-2 border-current border-t-transparent mr-3" />
                <span className="text-sm font-stashly">Loading links…</span>
              </div>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <ShareIcon className="size-10 opacity-30" />
                <p className="text-sm font-stashly">No share links yet</p>
                <p className="text-xs text-center max-w-xs">
                  Create a link to share this {itemType} with others.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[360px] pr-1">
                <div className="space-y-3">
                  {links.map(link => (
                    <ShareLinkRow
                      key={link.id}
                      link={link}
                      onRevoke={handleRevoke}
                      onUpdateScope={handleUpdateScope}
                      onUpdateType={handleUpdateType}
                      onUpdateDownloadable={handleUpdateDownloadable}
                      onUpdateExpiry={handleUpdateExpiry}
                      onRemoveExpiry={handleRemoveExpiry}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {links.length > 0 && (
              <>
                <Separator className="my-3" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-destructive hover:text-destructive font-stashly"
                  onClick={handleRevokeAll}
                  disabled={isMutating}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Revoke all links
                </Button>
              </>
            )}
          </TabsContent>

          {/* Create link tab */}
          <TabsContent value="create" className="mt-4">
            <CreateLinkForm
              itemId={itemId}
              itemType={itemType}
              onCreate={(intent, extra) => {
                submit(intent, extra)
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ShareTrigger — convenience wrapper that manages open state
// ---------------------------------------------------------------------------

export function ShareTrigger({
  children,
  itemId,
  itemName,
  itemType,
}: {
  children: React.ReactNode
  itemId: string
  itemName: string
  itemType: 'file' | 'folder' | 'collection'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        itemId={itemId}
        itemName={itemName}
        itemType={itemType}
      />
    </>
  )
}
