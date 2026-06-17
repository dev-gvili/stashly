import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useClipboard } from '@/hooks/useClipboard'
import { useFetcher } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Badge } from '@/ui/badge'
import { Switch } from '@/ui/switch'
import { Label } from '@/ui/label'
import { ScrollArea } from '@/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/ui/dropdown-menu'
import { cn } from '@/utils/styles'
import {
  ShareItemFillIcon,
  CopyFillIcon,
  LockFillIcon,
  ViewFillIcon,
  EditFillIcon,
  UploadFillIcon,
  CodeFillIcon,
  AnonymousFillIcon,
  WorkspaceMembersFillIcon,
  GroupFillIcon,
  RemoveIcon,
  DropdownIcon,
  DoubleCheckIcon,
  TrashFillIcon,
  AddIcon,
  SendInvitationIcon,
  ChevronRightIcon,
  DownloadFillIcon,
  RecentFillIcon,
  SettingsFillIcon,
  RefreshIcon,
  LinkIcon,
  SubmitIcon,
  LoaderIcon,
  UserIcon,
  LockedFillIcon,
  CalendarFillIcon,
} from '@/components/icons'
import type { ShareLinkType, ShareScope } from '@/prisma/client'
import type { StashInvitation } from '@/types/stash.types'
import type { PermissionRole } from '@/prisma/enums'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  InputGroupAddon,
  InputGroupButton,
  InputGroup,
  InputGroupInput,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui'
import { toUserInitial } from '@/utils'
import { Check } from 'lucide-react'

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

interface PermissionWithUsers {
  id: string
  roles: PermissionRole
  linkId: string | null
  recipientId: string | null
  users: {
    id: string
    name: string | null
    image: string | null
    email: string
  }[]
}

export interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemName: string
  itemType: 'file' | 'folder' | 'collection'
}

type InviteRow = { id: string; email: string; role: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_OPTIONS: {
  value: ShareScope
  label: string
  desc: string
  Icon: React.ElementType
}[] = [
  {
    value: 'anonymous',
    label: 'Anyone with the link',
    desc: 'No sign-in required',
    Icon: AnonymousFillIcon,
  },
  {
    value: 'organization',
    label: 'Workspace members',
    desc: 'Must be a workspace member',
    Icon: WorkspaceMembersFillIcon,
  },
  {
    value: 'users',
    label: 'Restricted',
    desc: 'Only people invited',
    Icon: GroupFillIcon,
  },
]

const GENERAL_ROLE_OPTIONS: {
  value: ShareLinkType
  label: string
  desc: string
  Icon: React.ElementType
}[] = [
  {
    value: 'view',
    label: 'Can view',
    desc: 'View but not edit',
    Icon: ViewFillIcon,
  },
  {
    value: 'edit',
    label: 'Can edit',
    desc: 'Edit and comment',
    Icon: EditFillIcon,
  },
  {
    value: 'upload',
    label: 'Can upload',
    desc: 'Add files to folder',
    Icon: UploadFillIcon,
  },
]

const MEMBER_ROLE_OPTIONS: {
  value: string
  label: string
  Icon: React.ElementType
}[] = [
  {
    value: 'read',
    label: 'Can view',
    Icon: ViewFillIcon,
  },
  {
    value: 'write',
    label: 'Can edit',
    Icon: EditFillIcon,
  },
]

const INVITE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'read', label: 'Can view' },
  { value: 'write', label: 'Can edit' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildShareUrl(link: ShareLinkWithPermissions) {
  if (link.url) return link.url
  if (typeof window !== 'undefined')
    return `${window.location.origin}/s/${link.id}`
  return `/s/${link.id}`
}

function formatRelativeDate(date: Date | string) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const AVATAR_PALETTES = [
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
]

function getInitials(name: string | null, fallback?: string) {
  if (!name) return (fallback ?? '?').charAt(0).toUpperCase()
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// RoleSelect — compact inline role dropdown
// ---------------------------------------------------------------------------

function RoleSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="font-stashly text-xs h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          {current?.label ?? placeholder ?? value}
          <DropdownIcon className="size-4 text-current opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-card shadow-stashly border-input"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            className={cn(
              'font-stashly text-xs',
              value === opt.value && 'bg-accent'
            )}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// InviteRecipientRow — email input + role selector for invite form
// ---------------------------------------------------------------------------

function InviteRecipientRow({
  row,
  showRemove,
  onEmail,
  onRole,
  onRemove,
}: {
  row: InviteRow
  showRemove: boolean
  onEmail: (v: string) => void
  onRole: (v: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 h-9 pl-3 pr-1 rounded-lg border border-input bg-card focus-within:ring-1 focus-within:ring-ring transition-shadow">
      <input
        type="email"
        placeholder="colleague@example.com"
        value={row.email}
        onChange={(e) => onEmail(e.target.value)}
        className="flex-1 min-w-0 bg-transparent outline-none text-xs font-stashly placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-0.5 border-l border-input pl-1">
        <RoleSelect
          value={row.role}
          options={INVITE_ROLE_OPTIONS}
          onChange={onRole}
        />
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RemoveIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PersonRow — existing user with permission
// ---------------------------------------------------------------------------

function PersonRow({
  user,
  role,
  idx,
  onRole,
  onRemove,
}: {
  user: { id: string; name: string | null; image: string | null; email: string }
  role: PermissionRole
  idx: number
  onRole: (role: string) => void
  onRemove: () => void
}) {
  const isOwner = role === 'owner'
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Avatar className="h-8 w-8 rounded-md shadow-stashly">
        <AvatarImage src={user.image || ''} alt={user.name!} />
        <AvatarFallback className="rounded-sm font-sans">
          {toUserInitial(user.name!)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium font-stashly truncate">
            {user.name ?? user.email}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-stashly truncate">
          {user.email}
        </p>
      </div>
      {isOwner ? (
        <span className="text-xs text-muted-foreground font-stashly pr-1.5">
          Owner
        </span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="font-stashly bg-card! border-input! text-xs h-8 gap-1 shrink-0"
            >
              {role === 'read' ? 'Can view' : 'Can edit'}
              <DropdownIcon className="size-4 text-current" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-card shadow-stashly border-input w-48"
          >
            {MEMBER_ROLE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => onRole(opt.value)}
                className={cn('font-stashly')}
              >
                <opt.Icon className="size-5 text-current" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{opt.label}</p>
                </div>
                {role === opt.value && (
                  <DoubleCheckIcon className="size-5 text-current" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={onRemove}
              className="font-stashly text-xs text-destructive focus:text-destructive"
            >
              <RemoveIcon className="size-5 text-destructive" />
              Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InviteStatusRow — sent invitation row
// ---------------------------------------------------------------------------

function InviteStatusRow({
  email,
  role,
  status,
  date,
  onCancel,
  image,
}: {
  email: string
  role: string
  status: string
  date: string
  image: string | null
  onCancel: () => void
}) {
  const statusVariant =
    status === 'accepted'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : status === 'canceled' || status === 'expired'
          ? 'bg-muted text-muted-foreground'
          : 'bg-amber-100 text-amber-800'

  const roleLabel = role === 'write' ? 'Can edit' : 'Can view'

  return (
    <div className="flex items-center gap-2.5 py-1">
      <Avatar className="h-8 w-8 rounded-md shadow-stashly">
        <AvatarImage src={image || ''} alt={email!} />
        <AvatarFallback className="rounded-sm font-sans">
          {toUserInitial(email!)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium font-stashly truncate">{email}</p>
        <p className="text-xs text-muted-foreground font-stashly">
          {roleLabel} · {date}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex items-center h-5 px-2 rounded-full text-xs font-stashly font-medium',
          statusVariant
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      <Button
        variant="destructive"
        size="icon-sm"
        onClick={onCancel}
        aria-label="Cancel invitation"
      >
        <RemoveIcon className="size-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LinkSettingsDropdown — icon gear button → settings panel
// ---------------------------------------------------------------------------

interface LinkSettings {
  download: boolean
  expiry: boolean
  expiresAt: string
  password: boolean
  passwordValue: string
}

function LinkSettingsDropdown({
  settings,
  onChange,
  onApply,
  downloadDisabled,
}: {
  settings: LinkSettings
  onChange: (patch: Partial<LinkSettings>) => void
  onApply: () => void
  downloadDisabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-9 border-input bg-card shrink-0"
          aria-label="Link settings"
        >
          <SettingsFillIcon className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="w-72 bg-card border-input shadow-stashly p-0 overflow-hidden"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="font-stashly text-xs uppercase text-muted-foreground px-3 py-2.5 ">
          Link settings
        </DropdownMenuLabel>

        {/* Allow download */}
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          <DownloadFillIcon className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium font-stashly">Allow download</p>
            <p className="text-xs text-muted-foreground font-stashly">
              {downloadDisabled
                ? 'Embed links cannot be downloaded'
                : 'Recipients can save a copy'}
            </p>
          </div>
          <Switch
            className="h-4"
            checked={downloadDisabled ? false : settings.download}
            disabled={downloadDisabled}
            onCheckedChange={(v) => onChange({ download: v })}
          />
        </div>


        {/* Set expiry date */}
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          <CalendarFillIcon className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium font-stashly">Set expiry date</p>
            <p className="text-xs text-muted-foreground font-stashly">
              Link expires after this date
            </p>
            <AnimatePresence>
              {settings.expiry && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <Input
                    type="datetime-local"
                    className="h-7 text-xs font-stashly mt-1.5"
                    value={settings.expiresAt}
                    onChange={(e) => onChange({ expiresAt: e.target.value })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Switch
            checked={settings.expiry}
            onCheckedChange={(v) => onChange({ expiry: v })}
            className="h-4"
          />
        </div>


        {/* Password protect */}
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          <LockedFillIcon className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium font-stashly">Password protect</p>
            <p className="text-xs text-muted-foreground font-stashly">
              Require a password to open
            </p>
            <AnimatePresence>
              {settings.password && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <Input
                    type="string"
                    placeholder="Set a password"
                    className="h-7 text-xs font-stashly mt-1.5"
                    value={settings.passwordValue}
                    onChange={(e) =>
                      onChange({ passwordValue: e.target.value })
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Switch
            checked={settings.password}
            onCheckedChange={(v) => onChange({ password: v })}
            className="h-4"
          />
        </div>

        {(settings.expiry || settings.password) && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="px-3 py-2">
              <Button
                size="sm"
                className="w-full font-stashly h-7 text-xs rounded-md"
                onClick={onApply}
              >
                Apply
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// CopyField — link URL with copy button
// ---------------------------------------------------------------------------

function CopyField({ url }: { url: string | null }) {
  const { copy, copied } = useClipboard()
  return (
    <InputGroup className="rounded-md border border-input bg-card shadow-stashly">
      <InputGroupAddon align="inline-start">
        <LinkIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="url"
        disabled
        defaultValue={url ?? undefined}
        placeholder="https://stashly.app/s/abc123"
        className="pl-8 text-sm"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton onClick={() => copy(url ?? '')} disabled={!url}>
          {copied ? <DoubleCheckIcon /> : <CopyFillIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
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
  // Data fetchers
  const sharesFetcher = useFetcher<{ links?: ShareLinkWithPermissions[] }>()
  const permsFetcher = useFetcher<{ permissions?: PermissionWithUsers[] }>()
  const invitesFetcher = useFetcher<{ invitations?: StashInvitation[] }>()
  const actionFetcher = useFetcher<{ success?: boolean; error?: string }>()
  const invitesFetcher2 = useFetcher<{ success?: boolean; error?: string }>()
  const permActionFetcher = useFetcher<{
    success?: boolean
    permission?: unknown
    error?: string
  }>()

  // Form state
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([
    { id: 'r1', email: '', role: 'read' },
  ])
  const [showInvites, setShowInvites] = useState(false)
  const [scope, setScope] = useState<ShareScope>('anonymous')
  const [generalRole, setGeneralRole] = useState<ShareLinkType>('view')
  const [linkSettings, setLinkSettings] = useState<LinkSettings>({
    download: true,
    expiry: false,
    expiresAt: '',
    password: false,
    passwordValue: '',
  })
  const rowIdRef = useRef(2)

  // Load data when dialog opens
  useEffect(() => {
    if (!open || !itemId) return
    sharesFetcher.load(`/api/shares?itemId=${itemId}`)
    permsFetcher.load(`/api/permissions?itemId=${itemId}`)
    invitesFetcher.load(`/api/invitations?itemId=${itemId}`)
  }, [open, itemId])

  // Sync scope/role from loaded share links
  const links = sharesFetcher.data?.links ?? []
  const generalLink = links.find(
    (l) => !l.expiresAt || new Date(l.expiresAt) > new Date()
  )

  useEffect(() => {
    if (generalLink) {
      setScope(generalLink.scope)
      setGeneralRole(generalLink.type)
      setLinkSettings((s) => ({
        ...s,
        download: generalLink.downloadable ?? true,
      }))
    }
  }, [generalLink?.id])

  // Reload data after mutations
  useEffect(() => {
    if (actionFetcher.state === 'idle' && actionFetcher.data?.success) {
      sharesFetcher.load(`/api/shares?itemId=${itemId}`)
    }
  }, [actionFetcher.state, actionFetcher.data])

  useEffect(() => {
    if (invitesFetcher2.state === 'idle' && invitesFetcher2.data?.success) {
      invitesFetcher.load(`/api/invitations?itemId=${itemId}`)
      setInviteRows([{ id: 'r1', email: '', role: 'read' }])
      rowIdRef.current = 2
    }
  }, [invitesFetcher2.state, invitesFetcher2.data])

  useEffect(() => {
    // grant_permission returns `{ permission }` (201) while revoke_permission
    // returns `{ success }` — reload on any non-error settled response.
    if (
      permActionFetcher.state === 'idle' &&
      permActionFetcher.data &&
      !permActionFetcher.data.error
    ) {
      permsFetcher.load(`/api/permissions?itemId=${itemId}`)
    }
  }, [permActionFetcher.state, permActionFetcher.data])

  // Derived data
  const rawPermissions = permsFetcher.data?.permissions ?? []
  const directPermissions = rawPermissions.filter(
    (p) => !p.linkId || (!p.recipientId && p.users.length > 0)
  )
  const invitations = invitesFetcher.data?.invitations ?? []
  const allRecipients = invitations.flatMap((inv) =>
    inv.recipients.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      role: r.role ?? 'read',
      date: formatRelativeDate(inv.createdAt),
      invitationId: inv.id,
      image: r?.image ?? null,
    }))
  )
  const pendingRecipients = allRecipients.filter((r) => r.status === 'pending')

  const shareUrl = generalLink ? buildShareUrl(generalLink) : null
  // Embed links are always anonymous and never downloadable (see docs Flow H).
  const isEmbed = generalRole === 'embed'
  const effectiveScope: ShareScope = isEmbed ? 'anonymous' : scope
  const scopeOpt =
    SCOPE_OPTIONS.find((s) => s.value === effectiveScope) ?? SCOPE_OPTIONS[0]
  const ScopeIcon = scopeOpt.Icon
  const isRestricted = effectiveScope === 'users'

  // Actions
  const addRow = () => {
    const id = `r${rowIdRef.current++}`
    setInviteRows((rows) => [...rows, { id, email: '', role: 'read' }])
  }

  const removeRow = (id: string) =>
    setInviteRows((rows) => rows.filter((r) => r.id !== id))

  const patchRow = (id: string, patch: Partial<InviteRow>) =>
    setInviteRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )

  const handleSendInvites = useCallback(() => {
    const valid = inviteRows.filter((r) => r.email.trim())
    if (!valid.length) return
    // parseFormData uses qs.parse for nested keys — expand the array manually
    const qsRecipients: Record<string, string> = {}
    valid.forEach((r, i) => {
      qsRecipients[`recipients[${i}][email]`] = r.email.trim()
      qsRecipients[`recipients[${i}][role]`] = r.role
    })
    invitesFetcher2.submit(
      { intent: 'send_item_invitation', itemId, ...qsRecipients },
      { method: 'post', action: '/api/invitations' }
    )
  }, [inviteRows, itemId, invitesFetcher2])

  const handleCancelInvitation = useCallback(
    (invitationId: string) => {
      invitesFetcher2.submit(
        { intent: 'cancel_invitation', invitationId },
        { method: 'post', action: '/api/invitations' }
      )
    },
    [invitesFetcher2]
  )

  const handleRemovePerm = useCallback(
    (userId: string) => {
      permActionFetcher.submit(
        { intent: 'revoke_permission', userId, itemId },
        { method: 'post', action: '/api/permissions' }
      )
    },
    [permActionFetcher, itemId]
  )

  const handleRoleChange = useCallback(
    (userId: string, role: string) => {
      permActionFetcher.submit(
        { intent: 'grant_permission', userId, itemId, role },
        { method: 'post', action: '/api/permissions' }
      )
    },
    [itemId]
  )

  const submitLinkMutation = useCallback(
    (intent: string, extra: Record<string, unknown> = {}) => {
      actionFetcher.submit(
        { intent, itemId, ...extra },
        { method: 'post', action: '/api/shares' }
      )
    },
    [itemId]
  )

  const handleScopeChange = useCallback(
    (newScope: ShareScope) => {
      if (isEmbed) return // embed is locked to anonymous
      setScope(newScope)
      if (generalLink) {
        submitLinkMutation('update_link_scope', {
          linkId: generalLink.id,
          scope: newScope,
        })
      } else {
        submitLinkMutation('create_view_link', { scope: newScope })
      }
    },
    [generalLink, submitLinkMutation, isEmbed]
  )

  const handleRoleChange2 = useCallback(
    (newRole: ShareLinkType) => {
      setGeneralRole(newRole)
      // Embed forces anonymous scope and no downloads (docs Flow H).
      if (newRole === 'embed') {
        setScope('anonymous')
        setLinkSettings((s) => ({ ...s, download: false }))
      }
      if (generalLink) {
        submitLinkMutation('update_link_type', {
          linkId: generalLink.id,
          type: newRole,
        })
      } else if (newRole === 'embed') {
        submitLinkMutation('create_embed_link', {})
      } else {
        submitLinkMutation(`create_${newRole}_link`, { scope })
      }
    },
    [generalLink, submitLinkMutation, scope]
  )

  const handleApplyLinkSettings = useCallback(() => {
    if (!generalLink) return
    if (linkSettings.expiry && linkSettings.expiresAt) {
      submitLinkMutation('expire_link', {
        linkId: generalLink.id,
        expiresAt: new Date(linkSettings.expiresAt).toISOString(),
      })
      return
    }

    if (linkSettings.password) {
      console.log('Setting password', linkSettings)
      submitLinkMutation('update_link_password', {
        linkId: generalLink.id,
        password: linkSettings.passwordValue,
      })
      return
    }

    // Embed links can never be downloadable (docs Flow H).
    if (!isEmbed) {
      submitLinkMutation('update_link_downloadable', {
        linkId: generalLink.id,
        downloadable: String(linkSettings.download),
      })
    }
  }, [generalLink, linkSettings, submitLinkMutation, isEmbed])

  const isLoading =
    sharesFetcher.state === 'loading' || permsFetcher.state === 'loading'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="font-stashly bg-card border-input shadow-stashly"
        onPointerDownOutside={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenChange(false)
        }}
        onInteractOutside={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenChange(false)
        }}
      >
        {/* Header */}
        <DialogHeader className="mb-4 w-full">
          <DialogTitle>Share</DialogTitle>
          <DialogDescription className="font-stashly max-w-sm truncate">
            {itemName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(calc(100svh-10rem),32rem)]">
          <div className="flex flex-col gap-5">
            {/* ── Invite people ──────────────────────────────────── */}
            <section className="flex flex-col gap-2.5">
              <h3 className="text-xs font-bold text-muted-foreground capitalize tracking-wide font-stashly">
                Invite people
              </h3>
              <div className="flex flex-col gap-2">
                {inviteRows.map((row) => (
                  <InviteRecipientRow
                    key={row.id}
                    row={row}
                    showRemove={inviteRows.length > 1}
                    onEmail={(v) => patchRow(row.id, { email: v })}
                    onRole={(v) => patchRow(row.id, { role: v })}
                    onRemove={() => removeRow(row.id)}
                  />
                ))}
              </div>
              {invitesFetcher2.state === 'idle' &&
                invitesFetcher2.data?.error && (
                  <p className="text-xs text-destructive font-stashly">
                    {invitesFetcher2.data.error}
                  </p>
                )}
              <div className="flex items-center justify-between">
                <Button
                  onClick={addRow}
                  variant="link"
                  size="sm"
                  className="text-xs font-stashly hover:no-underline gap-1.5"
                >
                  <AddIcon className="size-5" />
                  Add another
                </Button>
                <Button
                  size="sm"
                  className="font-stashly rounded-md"
                  onClick={handleSendInvites}
                  disabled={
                    invitesFetcher2.state !== 'idle' ||
                    !inviteRows.some((r) => r.email.trim())
                  }
                >
                  Send
                </Button>
              </div>
            </section>

            {/* ── People with access ─────────────────────────────── */}
            {(directPermissions.length > 0 ||
              permsFetcher.state === 'loading') && (
              <section className="flex flex-col gap-1">
                <h3 className="text-xs font-bold text-muted-foreground capitalize tracking-wide font-stashly">
                  People with access
                </h3>
                {permsFetcher.state === 'loading' ? (
                  <div className="h-9 flex items-center">
                    <LoaderIcon className="size-5 text-muted-foreground animate-spin" />
                  </div>
                ) : (
                  directPermissions.flatMap((perm, pi) =>
                    perm.users.map((user, ui) => (
                      <PersonRow
                        key={`${perm.id}-${user.id}`}
                        user={user}
                        role={perm.roles}
                        idx={pi + ui}
                        onRole={(role) => handleRoleChange(user.id, role)}
                        onRemove={() => handleRemovePerm(user.id)}
                      />
                    ))
                  )
                )}
              </section>
            )}

            {/* ── Sent invitations (disclosure) ──────────────────── */}
            {pendingRecipients.length > 0 && (
              <section className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowInvites((v) => !v)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-stashly flex-1">
                    Sent invitations
                  </p>
                  <Badge
                    variant="secondary"
                    className="rounded-sm font-stashly text-xs h-5 px-1.5"
                  >
                    {pendingRecipients.length}
                  </Badge>
                  <ChevronRightIcon
                    className={cn(
                      'size-4 text-muted-foreground transition-transform',
                      showInvites && 'rotate-90'
                    )}
                  />
                </button>
                <AnimatePresence>
                  {showInvites && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-0.5 pt-1">
                        {pendingRecipients.map((r) => (
                          <InviteStatusRow
                            key={r.id}
                            email={r.email}
                            role={r.role}
                            status={r.status}
                            date={r.date}
                            image={r.image}
                            onCancel={() =>
                              handleCancelInvitation(r.invitationId)
                            }
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* Divider
            <div className="h-px bg-input" /> */}

            {/* ── General access ─────────────────────────────────── */}
            <section className="flex flex-col gap-2">
              <DialogTitle className="text-xs font-bold text-muted-foreground capitalize tracking-wide font-stashly">
                General access
              </DialogTitle>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isEmbed}>
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={isEmbed}
                      className="gap-1 text-xs font-stashly bg-card border-input"
                    >
                      <ScopeIcon className="size-5" />
                      <span className="flex flex-col items-start">
                        {scopeOpt.label}
                        <p className="text-xs text-muted-foreground font-stashly">
                          {isEmbed
                            ? 'Embed links are always public'
                            : scopeOpt.desc}
                        </p>
                      </span>
                      <DropdownIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 bg-sidebar shadow-md border-input"
                  >
                    {SCOPE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onSelect={() => handleScopeChange(opt.value)}
                        className={cn(
                          'font-stashly',
                          effectiveScope === opt.value && 'bg-accent'
                        )}
                      >
                        <opt.Icon className="size-5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {opt.desc}
                          </p>
                        </div>
                        {effectiveScope === opt.value && (
                          <DoubleCheckIcon className="size-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {!isRestricted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="default"
                        className="font-stashly bg-card! border-input! text-xs h-8 gap-1 shrink-0"
                      >
                        {GENERAL_ROLE_OPTIONS.find(
                          (r) => r.value === generalRole
                        )?.label ?? 'Can view'}
                        <DropdownIcon className="size-4 text-current" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-card shadow-stashly border-input"
                    >
                      {GENERAL_ROLE_OPTIONS.filter(
                        (r) => r.value !== 'upload' || itemType === 'folder'
                      ).map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onSelect={() => handleRoleChange2(opt.value)}
                          className={cn(
                            'font-stashly',
                            generalRole === opt.value &&
                              'text-accent-foreground!'
                          )}
                        >
                          <opt.Icon className="size-5 text-current" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{opt.label}</p>
                            <p className="text-xs">{opt.desc}</p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>

        {/* Footer — copy link + link settings */}
        <div className="flex items-center gap-2">
          {shareUrl ? (
            <CopyField url={shareUrl} />
          ) : (
            <Button
              variant="outline"
              className="flex-1 font-stashly border-input bg-card"
              onClick={() => submitLinkMutation('create_view_link', { scope })}
              disabled={actionFetcher.state !== 'idle'}
            >
              <LinkIcon className="size-5" />
              Create link
            </Button>
          )}
          <LinkSettingsDropdown
            settings={linkSettings}
            onChange={(patch) => setLinkSettings((s) => ({ ...s, ...patch }))}
            onApply={handleApplyLinkSettings}
            downloadDisabled={isEmbed}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ShareTrigger — convenience wrapper
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
