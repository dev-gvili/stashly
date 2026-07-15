import { DropdownIcon, RemoveIcon } from '@/components/icons'
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
import { useCallback, useState } from 'react'

// ---------------------------------------------------------------------------
// Shared invite-form building blocks, used by NewInvitationDialog and
// AddRecipientsDialog. Mirrors the recipient row + role picker from
// share-dialog.tsx so the whole invitations surface reads consistently.
// ---------------------------------------------------------------------------

export type InviteRow = { id: string; email: string; role: string }

export const INVITE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'read', label: 'Can view' },
  { value: 'write', label: 'Can edit' },
]

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function newRow(): InviteRow {
  return { id: makeId(), email: '', role: 'read' }
}

// ---------------------------------------------------------------------------
// useRecipientRows — row state + add/remove/patch + payload serialization
// ---------------------------------------------------------------------------

export function useRecipientRows() {
  const [rows, setRows] = useState<InviteRow[]>([newRow()])

  const add = useCallback(() => setRows((r) => [...r, newRow()]), [])
  const remove = useCallback(
    (id: string) =>
      setRows((r) => (r.length > 1 ? r.filter((row) => row.id !== id) : r)),
    []
  )
  const patch = useCallback(
    (id: string, patchValue: Partial<InviteRow>) =>
      setRows((r) =>
        r.map((row) => (row.id === id ? { ...row, ...patchValue } : row))
      ),
    []
  )
  const reset = useCallback(() => setRows([newRow()]), [])

  const valid = rows.filter((r) => r.email.trim())

  /**
   * Serializes valid rows into the bracket-notation keys the invitations API
   * expects (parseFormData → qs.parse). Spread into a fetcher.submit payload:
   *   fetcher.submit({ intent, itemId, ...toPayload() }, { method, action })
   */
  const toPayload = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {}
    rows
      .filter((r) => r.email.trim())
      .forEach((r, i) => {
        out[`recipients[${i}][email]`] = r.email.trim()
        out[`recipients[${i}][role]`] = r.role
      })
    return out
  }, [rows])

  return { rows, add, remove, patch, reset, valid, toPayload }
}

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
