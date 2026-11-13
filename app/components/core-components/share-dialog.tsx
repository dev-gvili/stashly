import {
  AnonymousFillIcon,
  CalendarFillIcon,
  ChevronRightIcon,
  CopyFillIcon,
  DoubleCheckIcon,
  DownloadFillIcon,
  DropdownIcon,
  EditFillIcon,
  GroupFillIcon,
  LinkIcon,
  LoaderIcon,
  LockedFillIcon,
  RemoveIcon,
  SettingsFillIcon,
  UploadFillIcon,
  ViewFillIcon,
  WorkspaceMembersFillIcon
} from '@/components/icons'
import { useClipboard } from '@/hooks/useClipboard'
import { useRecipientRows } from '@/hooks/useRecipientRows'
import type { ShareLinkType, ShareScope } from '@/prisma/client'
import type { PermissionRole } from '@/prisma/enums'
import type {
  ShareLinkWithPermissions,
  StashInvitation,
} from '@/types/stash.types'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Dialog, DialogContent } from '@/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Input } from '@/ui/input'
import { ScrollArea } from '@/ui/scroll-area'
import { Switch } from '@/ui/switch'
import { toUserInitial } from '@/utils'
import { getContextIcon } from '@/utils/invitations'
import { cn } from '@/utils/styles'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useCallback, useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  INVITE_BADGE,
  INVITE_CAPTION,
  INVITE_CARD,
  INVITE_DESCRIPTION,
  INVITE_ROW_REMOVE,
  INVITE_SUBMIT,
  InviteDialogHeader,
  MessageField,
  focusAddEmails,
  RecipientsField,
  RoleSelect,
  RoleTrigger,
  sendInvitesLabel,
} from '@/components/views/invitations/invite-form-fields'
import { Avatar, AvatarFallback, AvatarImage } from '../ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PersonRow — existing user with permission
// ---------------------------------------------------------------------------

function PersonRow({
  user,
  role,
  onRole,
  onRemove,
}: {
  user: { id: string; name: string | null; image: string | null; email: string }
  role: PermissionRole
  onRole: (role: string) => void
  onRemove: () => void
}) {
  const isOwner = role === 'owner'
  return (
    <div className={INVITE_CARD}>
      <Avatar className="size-8 rounded-md">
        <AvatarImage src={user.image || ''} alt={user.name ?? user.email} />
        <AvatarFallback
          className={cn(INVITE_BADGE, 'bg-accent text-accent-foreground')}
        >
          {toUserInitial(user.name ?? user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{user.name ?? user.email}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      {isOwner ? (
        <span className={cn(INVITE_CAPTION, 'px-2')}>Owner</span>
      ) : (
        <>
          <RoleSelect
            value={role}
            options={MEMBER_ROLE_OPTIONS}
            onChange={onRole}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove access for ${user.name ?? user.email}`}
            className={INVITE_ROW_REMOVE}
          >
            <RemoveIcon className="size-4" />
          </button>
        </>
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
}: {
  email: string
  role: string
  status: string
  date: string
  onCancel: () => void
}) {
  const roleLabel = role === 'write' ? 'Can edit' : 'Can view'
  return (
    <div className={INVITE_CARD}>
      <span
        aria-hidden
        className={cn(
          INVITE_BADGE,
          'border border-dashed border-input text-muted-foreground'
        )}
      >
        {toUserInitial(email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{email}</p>
        <p className="truncate text-xs text-muted-foreground">
          {roleLabel} · {date}
        </p>
      </div>
      <span className={cn(INVITE_CAPTION, 'px-2')}>{status}</span>
      <button
        type="button"
        onClick={onCancel}
        aria-label={`Cancel the invitation to ${email}`}
        className={INVITE_ROW_REMOVE}
      >
        <RemoveIcon className="size-4" />
      </button>
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
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-md bg-muted hover:bg-accent"
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

function CopyField({ url }: { url: string }) {
  const { copy, copied } = useClipboard()
  return (
    <div className={cn(INVITE_CARD, 'min-w-0 flex-1 pl-3.5')}>
      <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {url}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => copy(url)}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        className="shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {copied ? <DoubleCheckIcon /> : <CopyFillIcon />}
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
  const invite = useRecipientRows()
  const [message, setMessage] = useState('')
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
      invite.reset()
      setMessage('')
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
      // image: r?.image ?? null,
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
  const handleSendInvites = () => {
    if (!invite.valid.length) return
    invitesFetcher2.submit(
      { intent: 'send_item_invitation', itemId, message, ...invite.toPayload() },
      { method: 'post', action: '/api/invitations' }
    )
  }

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
        showCloseButton={false}
        onOpenAutoFocus={focusAddEmails}
        className="gap-6 rounded-3xl font-stashly bg-card border-input p-6 shadow-stashly sm:max-w-xl sm:p-8"
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
        <InviteDialogHeader
          icon={getContextIcon(itemType === 'file' ? 'file' : itemType)}
          title={`Share ${itemName}`}
          description={INVITE_DESCRIPTION}
        />

        <ScrollArea
          type="hidden"
          className="-mx-1 max-h-[min(calc(100svh-10rem),32rem)]"
        >
          <div className="flex flex-col gap-5 p-1">
            {/* ── Invite people ──────────────────────────────────── */}
            <section className="flex flex-col gap-2.5">
              <h3 className={INVITE_CAPTION}>Invite people</h3>
              <RecipientsField
                rows={invite.rows}
                onAddEmails={invite.addEmails}
                onRemove={invite.remove}
                onEmail={(id, v) => invite.patch(id, { email: v })}
                onRole={(id, v) => invite.patch(id, { role: v })}
              />
              {invite.rows.length > 0 && (
                <MessageField value={message} onChange={setMessage} />
              )}
              {invitesFetcher2.state === 'idle' &&
                invitesFetcher2.data?.error && (
                  <p className="text-xs text-destructive font-stashly">
                    {invitesFetcher2.data.error}
                  </p>
                )}
              {invite.rows.length > 0 && (
                <Button
                  type="button"
                  onClick={handleSendInvites}
                  disabled={
                    invitesFetcher2.state !== 'idle' || !invite.valid.length
                  }
                  className={cn(INVITE_SUBMIT, 'self-end')}
                >
                  {invitesFetcher2.state !== 'idle' && (
                    <LoaderIcon className="size-4 animate-spin" />
                  )}
                  {sendInvitesLabel(invite.valid.length)}
                </Button>
              )}
            </section>

            {/* ── People with access ─────────────────────────────── */}
            {(directPermissions.length > 0 ||
              permsFetcher.state === 'loading') && (
              <section className="flex flex-col gap-2.5">
                <h3 className={INVITE_CAPTION}>People with access</h3>
                {permsFetcher.state === 'loading' ? (
                  <div className="h-9 flex items-center">
                    <LoaderIcon className="size-5 text-muted-foreground animate-spin" />
                  </div>
                ) : (
                  directPermissions.flatMap((perm) =>
                    perm.users.map((user) => (
                      <PersonRow
                        key={`${perm.id}-${user.id}`}
                        user={user}
                        role={perm.roles}
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
              <section className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInvites((v) => !v)}
                  aria-expanded={showInvites}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className={cn(INVITE_CAPTION, 'flex-1')}>
                    Sent invitations
                  </span>
                  <Badge>
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
                      <div className="flex flex-col gap-2.5">
                        {pendingRecipients.map((r) => (
                          <InviteStatusRow
                            key={r.id}
                            email={r.email}
                            role={r.role}
                            status={r.status}
                            date={r.date}
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

            {/* ── General access ─────────────────────────────────── */}
            <section className="flex flex-col gap-2.5">
              <h3 className={INVITE_CAPTION}>General access</h3>
              <div className={INVITE_CARD}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isEmbed}>
                    <button
                      type="button"
                      disabled={isEmbed}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          INVITE_BADGE,
                          'bg-accent text-accent-foreground'
                        )}
                      >
                        <ScopeIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {scopeOpt.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {isEmbed
                            ? 'Embed links are always public'
                            : scopeOpt.desc}
                        </span>
                      </span>
                      {!isEmbed && (
                        <DropdownIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 border-input bg-card shadow-stashly"
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
                      <RoleTrigger
                        label={
                          GENERAL_ROLE_OPTIONS.find(
                            (r) => r.value === generalRole
                          )?.label ?? (isEmbed ? 'Embed' : 'Can view')
                        }
                        elevated={generalRole !== 'view'}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-input bg-card shadow-stashly"
                    >
                      {GENERAL_ROLE_OPTIONS.filter(
                        (r) => r.value !== 'upload' || itemType === 'folder'
                      ).map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onSelect={() => handleRoleChange2(opt.value)}
                          className={cn(
                            'font-stashly',
                            generalRole === opt.value && 'bg-accent'
                          )}
                        >
                          <opt.Icon className="size-5 text-current" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {opt.desc}
                            </p>
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
        <div className="border-t border-dashed border-input" />
        <div className="flex items-center gap-2">
          {shareUrl ? (
            <CopyField url={shareUrl} />
          ) : (
            <Button
              variant="ghost"
              className="h-11 flex-1 gap-2 rounded-md bg-muted font-stashly text-xs uppercase tracking-wide hover:bg-accent"
              onClick={() => submitLinkMutation('create_view_link', { scope })}
              disabled={actionFetcher.state !== 'idle'}
            >
              <LinkIcon className="size-4" />
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
