import type { InviteRow } from '@/types/stash.types'
import { useCallback, useState } from 'react'

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function newRow(): InviteRow {
  return { id: makeId(), email: '', role: 'read' }
}

/**
 * Recipient row state for the invite forms — row list plus add / remove /
 * patch / reset, the subset with a non-empty email, and a serializer for the
 * invitations API payload.
 *
 * Shared by `NewInvitationDialog` and `AddRecipientsDialog` so both dialogs
 * agree on row identity and payload shape.
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
