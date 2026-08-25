import type { InviteRow } from '@/types/stash.types'
import { useCallback, useState } from 'react'

/**
 * A client-only id for a recipient row, used as its React key and as the handle
 * for `remove`/`patch`. Falls back to a random base-36 string where
 * `crypto.randomUUID` is unavailable — these ids never reach the server, so
 * uniqueness within the form is all that matters.
 *
 * @example
 * // Give a fresh row a stable identity
 * const row = { id: makeId(), email: '', role: 'read' }
 *
 * @example
 * // Two calls never collide
 * makeId() !== makeId() // → true
 */
function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/**
 * A blank recipient row with a fresh id and the default `read` role — the
 * least-privilege default for someone who hasn't been assigned one yet.
 *
 * @example
 * // Seed the form with a single empty row
 * const [rows, setRows] = useState<InviteRow[]>([newRow()])
 *
 * @example
 * // Append another row when the user clicks "Add recipient"
 * setRows((r) => [...r, newRow()])
 */
function newRow(): InviteRow {
  return { id: makeId(), email: '', role: 'read' }
}

/**
 * Recipient row state for the invite forms — row list plus add / remove /
 * patch / reset, the subset with a non-empty email, and a serializer for the
 * invitations API payload.
 *
 * Shared by `NewInvitationDialog` and `AddRecipientsDialog` so both dialogs
 * agree on row identity and payload shape. Always keeps at least one row —
 * `remove` refuses to empty the form.
 *
 * @example
 * // Render the editable rows
 * const { rows, add, remove, patch } = useRecipientRows()
 * {rows.map((row) => (
 *   <RecipientRow key={row.id} row={row}
 *     onChange={(v) => patch(row.id, v)} onRemove={() => remove(row.id)} />
 * ))}
 * <Button onClick={add}>Add recipient</Button>
 *
 * @example
 * // Submit, then clear the form
 * const { valid, toPayload, reset } = useRecipientRows()
 * fetcher.submit({ intent: 'invite', itemId, ...toPayload() }, { method: 'POST', action: '/api/invitations' })
 * reset()
 *
 * @example
 * // Gate the submit button on at least one filled-in email
 * const { valid } = useRecipientRows()
 * <Button disabled={valid.length === 0}>Send</Button>
 */
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
