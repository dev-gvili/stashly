import { z } from 'zod'

/** The same check the invitations API runs on each recipient (`z.email()`). */
const emailSchema = z.email()

/** What a pasted or typed list of addresses is split on. */
const SEPARATORS = /[\s,;]+/

/**
 * Whether `value` is an address the invitations API will accept. Uses the
 * server's own `z.email()` schema, so the dialog never counts an address the
 * server would refuse, or refuses one it would take.
 *
 * @param value - A recipient email as typed, surrounding spaces allowed.
 * @returns `true` when the trimmed value is a valid email.
 *
 * @example
 * isInviteEmail(' dana@stashly.dev ') // → true
 * isInviteEmail('not-an-email')       // → false
 */
export function isInviteEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success
}

/**
 * Splits pasted or typed text into the addresses to add as new recipient
 * rows: separated by commas, semicolons or whitespace, without blanks, and
 * without any address already in the form or repeated in the text (compared
 * case-insensitively). Invalid entries are kept, so the row can show what was
 * wrong rather than the text silently vanishing.
 *
 * @param text - What was pasted or typed into the "add another email" field.
 * @param existing - The emails already in the form.
 * @returns The new entries, in the order they appeared.
 *
 * @example
 * splitInviteEmails('rachel@acme.com, dana@stashly.dev', [])
 * // → ['rachel@acme.com', 'dana@stashly.dev']
 * splitInviteEmails('Dana@stashly.dev; not-an-email', ['dana@stashly.dev'])
 * // → ['not-an-email']
 */
export function splitInviteEmails(text: string, existing: string[]): string[] {
  const seen = new Set(existing.map((e) => e.trim().toLowerCase()))
  const out: string[] = []
  for (const part of text.split(SEPARATORS)) {
    const email = part.trim()
    const key = email.toLowerCase()
    if (!email || seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}
