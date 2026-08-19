import { DropdownIcon, RemoveIcon } from '@/components/icons'
import type { InviteRow } from '@/types/stash.types'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'
import { cn } from '@/utils/styles'

// ---------------------------------------------------------------------------
// Shared invite-form building blocks, used by NewInvitationDialog and
// AddRecipientsDialog. Mirrors the recipient row + role picker from
// share-dialog.tsx so the whole invitations surface reads consistently.
// ---------------------------------------------------------------------------

export const INVITE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'read', label: 'Can view' },
  { value: 'write', label: 'Can edit' },
]

// ---------------------------------------------------------------------------
// RoleSelect — compact inline role dropdown (matches share-dialog)
// ---------------------------------------------------------------------------

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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 font-stashly text-xs text-muted-foreground hover:text-foreground"
        >
          {current?.label ?? placeholder ?? value}
          <DropdownIcon className="size-4 text-current opacity-60" />
        </Button>
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
// RecipientRow — email input + role selector (+ remove)
// ---------------------------------------------------------------------------

export function RecipientRow({
  row,
  showRemove,
  autoFocus,
  onEmail,
  onRole,
  onRemove,
}: {
  row: InviteRow
  showRemove: boolean
  autoFocus?: boolean
  onEmail: (v: string) => void
  onRole: (v: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-lg border border-input bg-card pl-3 pr-1 transition-shadow focus-within:ring-1 focus-within:ring-ring">
      <input
        type="email"
        placeholder="colleague@example.com"
        value={row.email}
        autoFocus={autoFocus}
        onChange={(e) => onEmail(e.target.value)}
        className="min-w-0 flex-1 bg-transparent font-stashly text-xs outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-0.5 border-l border-input pl-1">
        <RoleSelect value={row.role} onChange={onRole} />
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove recipient"
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <RemoveIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecipientsField — labelled list of RecipientRows + "Add another"
// ---------------------------------------------------------------------------

export function RecipientsField({
  rows,
  onAdd,
  onRemove,
  onEmail,
  onRole,
}: {
  rows: InviteRow[]
  onAdd: () => void
  onRemove: (id: string) => void
  onEmail: (id: string, v: string) => void
  onRole: (id: string, v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Recipients</Label>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <RecipientRow
            key={row.id}
            row={row}
            autoFocus={i === 0}
            showRemove={rows.length > 1}
            onEmail={(v) => onEmail(row.id, v)}
            onRole={(v) => onRole(row.id, v)}
            onRemove={() => onRemove(row.id)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="self-start text-primary"
      >
        + Add another
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageField — optional personal note
// ---------------------------------------------------------------------------

export function MessageField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">
        Message{' '}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a note to your invitation…"
        className="resize-none text-sm"
      />
    </div>
  )
}
