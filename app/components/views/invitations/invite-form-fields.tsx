import {
  AddIcon,
  CheckIcon,
  DropdownIcon,
  LinkIcon,
  LoaderIcon,
  RemoveIcon,
} from '@/components/icons'
import { useClipboard } from '@/hooks/useClipboard'
import type { InviteRow } from '@/types/stash.types'
import { Button } from '@/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { isInviteEmail } from '@/utils/invite-emails'
import { cn } from '@/utils/styles'
import {
  useId,
  useState,
  type ComponentProps,
  type ComponentType,
  type SVGProps,
} from 'react'

// ---------------------------------------------------------------------------
// Shared invite-form building blocks, used by NewInvitationDialog,
// AddRecipientsDialog and ShareDialog, so the whole invitations surface
// reads the same: a header with the shared thing's tile, one card per
// recipient, a dashed field that adds more, a message card, and a footer.
// ---------------------------------------------------------------------------

export const INVITE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'read', label: 'Can view' },
  { value: 'write', label: 'Can edit' },
]

/** One line under the invite dialogs' titles: how the recipients field works. */
export const INVITE_DESCRIPTION =
  'Paste emails separated by commas — roles can differ per person.'

/** Caption above a section of an invite dialog. */
export const INVITE_CAPTION =
  'font-stashly text-xs uppercase tracking-wide text-muted-foreground'

/** The card every row of an invite dialog sits on (recipient, person, link). */
export const INVITE_CARD =
  'group flex items-center gap-3 rounded-xl bg-muted py-2 pl-2.5 pr-1.5'

/** The square badge at the start of a row: a status, an avatar, an icon. */
export const INVITE_BADGE =
  'grid size-8 shrink-0 place-items-center rounded-md font-stashly text-xs'

/** A row's remove button: hidden until the row is hovered or it is focused. */
export const INVITE_ROW_REMOVE =
  'flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100'

// ---------------------------------------------------------------------------
// InviteDialogHeader — the shared thing's tile, title and description
// ---------------------------------------------------------------------------

/**
 * Header for the invite dialogs: a tile with the shared thing's icon, the
 * title with the close button on its line, and a description. Render it in a
 * `DialogContent` with `showCloseButton={false}`: the stock close button is
 * absolutely placed at the corner, off the title's line and inside the
 * dialog's padding, and a long title ran underneath it.
 *
 * @example
 * <InviteDialogHeader icon={FolderIcon} title="Invite to stashly-core" description={INVITE_DESCRIPTION} />
 */
export function InviteDialogHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: string
}) {
  return (
    // min-w-0: DialogContent is a grid, and a grid item won't shrink below
    // its content, so a long file name would widen the dialog, not truncate.
    <DialogHeader className="min-w-0 flex-row items-start gap-4 text-left">
      <div className="grid size-12 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-3">
          <DialogTitle className="min-w-0 flex-1 truncate font-stashly text-lg leading-8 tracking-wide">
            {title}
          </DialogTitle>
          <DialogClose asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Close"
              className="size-8 shrink-0 rounded-md border-input bg-card"
            >
              <RemoveIcon className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription>{description}</DialogDescription>
      </div>
    </DialogHeader>
  )
}

/**
 * `onOpenAutoFocus` for the invite dialogs: focus the "add an email" field.
 * Left alone, Radix focuses the dialog's first focusable element, which is
 * the header's close button.
 *
 * @example
 * <DialogContent showCloseButton={false} onOpenAutoFocus={focusAddEmails}>
 */
export function focusAddEmails(event: Event) {
  const field = (event.currentTarget as HTMLElement | null)?.querySelector<
    HTMLInputElement
  >('[data-slot="add-emails"]')
  if (!field) return
  event.preventDefault()
  field.focus()
}

// ---------------------------------------------------------------------------
// RoleTrigger / RoleSelect — compact inline role dropdown
// ---------------------------------------------------------------------------

/**
 * The button that opens a role menu: an uppercase, muted label, shown as a
 * pill when the role grants more than viewing, so elevated access stands out
 * in a long list. Use it as a `DropdownMenuTrigger asChild` child when the
 * menu needs richer items than `RoleSelect` renders.
 *
 * @example
 * <DropdownMenuTrigger asChild><RoleTrigger label="Can edit" elevated /></DropdownMenuTrigger>
 */
export function RoleTrigger({
  label,
  elevated,
  className,
  ...props
}: ComponentProps<typeof Button> & { label: string; elevated?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 shrink-0 gap-1 px-1.5 font-stashly text-xs uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          elevated && 'rounded-md bg-accent px-2 py-0.5 text-accent-foreground'
        )}
      >
        {label}
      </span>
      <DropdownIcon className="size-4 text-current" />
    </Button>
  )
}

/**
 * Inline role dropdown for a recipient or a person with access.
 *
 * @example
 * <RoleSelect value={row.role} onChange={(role) => patch(row.id, { role })} />
 */
export function RoleSelect({
  value,
  options = INVITE_ROLE_OPTIONS,
  onChange,
  placeholder,
}: {
  value: string
  options?: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RoleTrigger
          label={current?.label ?? placeholder ?? value}
          elevated={value !== 'read'}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-input bg-card shadow-stashly"
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
// RecipientRow — one recipient card: status, email, role, remove
// ---------------------------------------------------------------------------

/**
 * One recipient as a card: a check for a valid address, or a dashed cross
 * with the address struck through and "not a valid email" for one the server
 * would refuse. The email stays editable to fix a typo; it is judged once the
 * field loses focus, not on every keystroke.
 */
export function RecipientRow({
  row,
  onEmail,
  onRole,
  onRemove,
}: {
  row: InviteRow
  onEmail: (v: string) => void
  onRole: (v: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const invalid = !editing && !isInviteEmail(row.email)
  return (
    <div
      className={cn(
        INVITE_CARD,
        'transition-shadow focus-within:ring-1 focus-within:ring-ring'
      )}
    >
      <span
        aria-hidden
        className={cn(
          INVITE_BADGE,
          invalid
            ? 'border border-dashed border-input text-muted-foreground'
            : 'bg-accent text-accent-foreground'
        )}
      >
        {invalid ? (
          <RemoveIcon className="size-4" />
        ) : (
          <CheckIcon className="size-4" />
        )}
      </span>
      <input
        type="email"
        value={row.email}
        aria-label="Recipient email"
        aria-invalid={invalid}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onEmail(e.target.value)}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm outline-none',
          invalid && 'text-muted-foreground line-through'
        )}
      />
      {invalid && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          not a valid email
        </span>
      )}
      <RoleSelect value={row.role} onChange={onRole} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${row.email || 'recipient'}`}
        className={INVITE_ROW_REMOVE}
      >
        <RemoveIcon className="size-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddEmailsField — the dashed "add another email…" field
// ---------------------------------------------------------------------------

/**
 * The dashed field that adds recipients. Typing an address and pressing
 * Enter or a comma adds it; a pasted list ("a@x.com, b@y.com") becomes one
 * row per address; leaving the field adds whatever is in it, so an address
 * typed just before pressing Send is not lost.
 */
function AddEmailsField({
  first,
  onAddEmails,
}: {
  first: boolean
  onAddEmails: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const commit = (text: string) => {
    if (text.trim()) onAddEmails(text)
    setDraft('')
  }
  return (
    <label className="flex cursor-text items-center gap-3 rounded-xl border border-dashed border-input px-3.5 py-3 transition-colors focus-within:border-ring">
      <AddIcon className="size-5 shrink-0 text-muted-foreground" />
      <input
        type="text"
        inputMode="email"
        aria-label="Add recipient emails"
        data-slot="add-emails"
        value={draft}
        placeholder={first ? 'add an email…' : 'add another email…'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit(draft)
          }
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text')
          if (!/[\s,;]/.test(pasted.trim())) return
          e.preventDefault()
          commit(draft + pasted)
        }}
        onBlur={() => commit(draft)}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  )
}

// ---------------------------------------------------------------------------
// RecipientsField — the recipient cards + the field that adds more
// ---------------------------------------------------------------------------

/**
 * The recipients list: one `RecipientRow` per address, then the dashed
 * field that adds more. Pair it with `useRecipientRows`, and give the dialog
 * `onOpenAutoFocus={focusAddEmails}` to start typing in that field.
 *
 * @example
 * const { rows, addEmails, remove, patch } = useRecipientRows()
 * <RecipientsField rows={rows} onAddEmails={addEmails} onRemove={remove}
 *   onEmail={(id, email) => patch(id, { email })} onRole={(id, role) => patch(id, { role })} />
 */
export function RecipientsField({
  rows,
  onAddEmails,
  onRemove,
  onEmail,
  onRole,
}: {
  rows: InviteRow[]
  onAddEmails: (text: string) => void
  onRemove: (id: string) => void
  onEmail: (id: string, v: string) => void
  onRole: (id: string, v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <RecipientRow
          key={row.id}
          row={row}
          onEmail={(v) => onEmail(row.id, v)}
          onRole={(v) => onRole(row.id, v)}
          onRemove={() => onRemove(row.id)}
        />
      ))}
      <AddEmailsField first={rows.length === 0} onAddEmails={onAddEmails} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageField — optional personal note
// ---------------------------------------------------------------------------

/** The optional note sent with the invitation, as a captioned card. */
export function MessageField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted px-4 py-3 transition-shadow focus-within:ring-1 focus-within:ring-ring">
      <label htmlFor={id} className={INVITE_CAPTION}>
        Message · optional
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a note to your invitation…"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// InviteDialogFooter — copy link, cancel, send
// ---------------------------------------------------------------------------

/**
 * Footer for the invite dialogs, under a dashed rule: an optional "Copy
 * invite link instead" on the left, then Cancel and the tinted submit.
 *
 * @example
 * <InviteDialogFooter submitLabel={`Send ${valid.length} invites`} onSubmit={send}
 *   disabled={!valid.length} submitting={busy} onCancel={() => onOpenChange(false)} copyLinkUrl={url} />
 */
export function InviteDialogFooter({
  submitLabel,
  onSubmit,
  disabled,
  submitting,
  onCancel,
  copyLinkUrl,
}: {
  submitLabel: string
  onSubmit: () => void
  disabled?: boolean
  submitting?: boolean
  onCancel?: () => void
  /** When set, offers "Copy invite link instead" for this URL. */
  copyLinkUrl?: string
}) {
  const { copy, copied } = useClipboard()
  return (
    <div className="flex flex-col gap-4">
      <div className="border-t border-dashed border-input" />
      <div className="flex flex-wrap items-center gap-2">
        {copyLinkUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(copyLinkUrl)}
            className="gap-2 px-1.5 font-stashly text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            {copied ? 'Link copied' : 'Copy invite link instead'}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="font-stashly text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={disabled || submitting}
            className={INVITE_SUBMIT}
          >
            {submitting && <LoaderIcon className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The submit button's shape; its colours are the default `primary` variant. */
export const INVITE_SUBMIT =
  'rounded-md px-5 font-stashly text-xs uppercase tracking-wide'

/**
 * The submit label for `count` valid recipients: "Send invite", "Send 2 invites".
 *
 * @example
 * sendInvitesLabel(2) // → 'Send 2 invites'
 */
export function sendInvitesLabel(count: number): string {
  return count > 1 ? `Send ${count} invites` : 'Send invite'
}
