import type { InviteRow } from '@/types/stash.types'
import { isInviteEmail, splitInviteEmails } from '@/utils/invite-emails'
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
 * A recipient row for `email` with a fresh id and the default `read` role —
 * the least-privilege default for someone who hasn't been assigned one yet.
 *
 * @example
 * // One row per address pasted into the "add another email" field
 * setRows((r) => [...r, ...emails.map(newRow)])
 */
function newRow(email: string): InviteRow {
  return { id: makeId(), email, role: 'read' }
}

/**
 * Recipient row state for the invite forms — row list plus addEmails /
 * remove / patch / reset, the rows with a valid email, and a serializer for
 * the invitations API payload.
 *
 * Shared by `NewInvitationDialog`, `AddRecipientsDialog` and `ShareDialog` so
 * they agree on row identity, validity and payload shape. The form starts
 * empty: addresses arrive through the "add another email" field, which may
 * hold a comma-separated list.
 *
 * @example
 * // Render the editable rows and the field that adds more
 * const { rows, addEmails, remove, patch } = useRecipientRows()
 * <RecipientsField rows={rows} onAddEmails={addEmails} onRemove={remove}
 *   onEmail={(id, email) => patch(id, { email })} onRole={(id, role) => patch(id, { role })} />
 *
 * @example
 * // Submit, then clear the form
 * const { valid, toPayload, reset } = useRecipientRows()
 * fetcher.submit({ intent: 'invite', itemId, ...toPayload() }, { method: 'POST', action: '/api/invitations' })
 * reset()
 *
 * @example
 * // Count only addresses the server will accept on the send button
 * const { valid } = useRecipientRows()
 * <Button disabled={valid.length === 0}>Send {valid.length} invites</Button>
 */
export function useRecipientRows() {
  const [rows, setRows] = useState<InviteRow[]>([])

  /** Adds a row per address in `text` (see `splitInviteEmails`). */
  const addEmails = useCallback(
    (text: string) =>
      setRows((r) => {
        const emails = splitInviteEmails(text, r.map((row) => row.email))
        return emails.length ? [...r, ...emails.map(newRow)] : r
      }),
    []
  )
  const remove = useCallback(
    (id: string) => setRows((r) => r.filter((row) => row.id !== id)),
    []
  )
  const patch = useCallback(
    (id: string, patchValue: Partial<InviteRow>) =>
      setRows((r) =>
        r.map((row) => (row.id === id ? { ...row, ...patchValue } : row))
      ),
    []
  )
  const reset = useCallback(() => setRows([]), [])

  const valid = rows.filter((r) => isInviteEmail(r.email))

  /**
   * Serializes valid rows into the bracket-notation keys the invitations API
   * expects (parseFormData → qs.parse). Spread into a fetcher.submit payload:
   *   fetcher.submit({ intent, itemId, ...toPayload() }, { method, action })
   */
  const toPayload = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {}
    rows
      .filter((r) => isInviteEmail(r.email))
      .forEach((r, i) => {
        out[`recipients[${i}][email]`] = r.email.trim()
        out[`recipients[${i}][role]`] = r.role
      })
    return out
  }, [rows])

  return { rows, addEmails, remove, patch, reset, valid, toPayload }
}
