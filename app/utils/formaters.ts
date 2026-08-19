import type { ZodFormattedError } from 'zod'
import type { InvitationStatus } from '@/prisma/enums'
import type { LinkState, SharedLink, StashItem } from '@/types/stash.types'

type DateStyle = Intl.DateTimeFormatOptions['dateStyle']

/**
 * format datetime using Intl
 */
export function datetime(
  locale = 'he-IL',
  style: DateStyle = 'short', 
  date: Date
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
  }).format(date)
}

/**
 * format currency using Intl
 */
export function currency(locale = 'he-IL', currency = 'ILS', amount: number) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

type UnitType =
  | 'bit'
  | 'byte'
  | 'celsius'
  | 'centimeter'
  | 'day'
  | 'degree'
  | 'fahrenheit'
  | 'fluid-ounce'
  | 'foot'
  | 'gallon'
  | 'gigabit'
  | 'gigabyte'
  | 'gram'
  | 'hectare'
  | 'hour'
  | 'inch'
  | 'kilobit'
  | 'kilobyte'
  | 'kilogram'
  | 'kilometer'
  | 'liter'
  | 'megabit'
  | 'megabyte'
  | 'meter'
  | 'mile'
  | 'mile-scandinavian'
  | 'milliliter'
  | 'millimeter'
  | 'millisecond'
  | 'minute'
  | 'month'
  | 'ounce'
  | 'percent'
  | 'petabyte'
  | 'pound'
  | 'second'
  | 'stone'
  | 'terabit'
  | 'terabyte'
  | 'week'
  | 'yard'
  | 'year'

type StyleTypes = Intl.NumberFormatOptions['style']

/**
 * format file size with a fix to display the correct letters when the file size is in GigaBytes and adding a space between the numbers and the letters
 */
export function formatSize(
  unit: UnitType = 'byte',
  style: StyleTypes = 'unit',
  amount: number | bigint = 0
) {
  let formated = new Intl.NumberFormat('en', {
    notation: 'compact',
    style,
    unit,
    unitDisplay: 'narrow',
  }).format(amount)
  if (formated.endsWith('BB')) {
    formated = formated.replace('BB', 'GB')
  }
  let regex = new RegExp(/([A-Z]{0,2}$)/)
  formated = formated.replace(regex, ' $1')
  return formated
}

/**
 * format currency specific to Israel currency put the sign before the amount.
 */
export function currencyIL(amount: number) {
  const heb = new Intl.Locale('he')
  const parts = new Intl.NumberFormat(heb.baseName, {
    style: 'currency',
    currency: 'ILS',
  }).formatToParts(amount)
  const sign = parts.find((part) => part.type === 'currency')
  parts.pop()
  parts.unshift(sign!)
  return parts.map(({ value }) => value).reduce((prev, curr) => prev + curr)
}

/**
 * @description convert the first latter to an uppercase.
 * @example
 * ```tsx
 * capitalize(database) // output Database
 * ```
 */
export function capitalize(text: undefined | string) {
  if (typeof text !== 'string') return ''
  if (text === undefined) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * format zod errors
 */
export const formatErrors = (
  errors: ZodFormattedError<Map<string, string>, string>
) =>
  Object.entries(errors)
    .map(([name, value]) => {
      if (value && '_errors' in value)
        return `${name}: ${value._errors.join(', ')}\n`
    })
    .filter(Boolean)

/**
 * Format a number of seconds as a media clock: `m:ss`, or `h:mm:ss` once the
 * value reaches an hour. Used by the audio/video stage transports.
 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Format a duration in seconds as `m:ss`, falling back to an em dash when the
 * value is missing. Used by the item panel detail rows.
 */
export function formatDuration(sec: number | null | undefined): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format a date as a short relative string (`just now`, `5m ago`, `3h ago`,
 * `2d ago`), falling back to an em dash when the value is missing.
 */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * Format a date for the item panel as `Jan 1, 2026` (en-US, short month),
 * falling back to an em dash when the value is missing.
 */
export function formatMediaDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Named paper sizes in PDF points (1pt = 1/72in), portrait orientation.
const PAPER_SIZES: Array<{
  name: string
  w: number
  h: number
  metric: boolean
}> = [
  { name: 'Letter', w: 612, h: 792, metric: false },
  { name: 'Legal', w: 612, h: 1008, metric: false },
  { name: 'Tabloid', w: 792, h: 1224, metric: false },
  { name: 'A3', w: 842, h: 1191, metric: true },
  { name: 'A4', w: 595, h: 842, metric: true },
  { name: 'A5', w: 420, h: 595, metric: true },
]

/**
 * Format a PDF page size (in points) as a named paper size plus dimensions,
 * e.g. `A4 · 210 × 297 mm` or `8.5 × 11 in`. Returns null when dimensions are
 * missing.
 */
export function formatPageSize(
  widthPt: number | null | undefined,
  heightPt: number | null | undefined
): string | null {
  if (!widthPt || !heightPt) return null
  const short = Math.min(widthPt, heightPt)
  const long = Math.max(widthPt, heightPt)
  const match = PAPER_SIZES.find(
    (p) => Math.abs(p.w - short) <= 3 && Math.abs(p.h - long) <= 3
  )
  const dims = match?.metric
    ? `${Math.round((widthPt / 72) * 25.4)} × ${Math.round((heightPt / 72) * 25.4)} mm`
    : `${Math.round((widthPt / 72) * 10) / 10} × ${Math.round((heightPt / 72) * 10) / 10} in`
  return match ? `${match.name} · ${dims}` : dims
}

// add format time function that take ms and return seconds in a format of 00:00:00
/**
 * format time from milliseconds to hh:mm:ss
 */
export function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const paddedHours = String(hours).padStart(2, '0')
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

/**
 * Short relative age used across the overview: `2m ago`, `3h ago`, `Yesterday`.
 *
 * Deliberately *not* merged with `timeAgo` above — that one returns `—` for a
 * null input and `Nd ago` forever, while this one says `Just now` and falls
 * back to a month/day date past a week. Two call sites, two contracts.
 */
export function toRelativeTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

const GREETINGS: Record<DayPart, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
}

export function toGreeting(date = new Date()) {
  const hour = date.getHours()
  const part: DayPart =
    hour < 12
      ? 'morning'
      : hour < 18
        ? 'afternoon'
        : hour < 21
          ? 'evening'
          : 'night'
  return GREETINGS[part]
}

// ---------------------------------------------------------------------------
// Item / storage display
// ---------------------------------------------------------------------------

/** Folders read as a child count, files as their own size. */
export function itemMeta(item: Pick<StashItem, 'type' | 'size' | 'folder'>) {
  return item.type === 'folder'
    ? `${item.folder?.inclusiveChildCount ?? item.folder?.childCount ?? 0} items`
    : formatSize('byte', 'unit', item.size)
}

/**
 * Splits a formatted byte count into its numeric part and its unit, so a card
 * can set them at different type sizes.
 *
 * @param size Raw byte count — `StashItem.size` is a `bigint`.
 * @returns `[value, unit]`, e.g. `['4.2', 'MB']`. The unit is `''` when
 *   `formatSize` returns no suffix.
 *
 * @example
 * const [value, unit] = splitSize(item.size)
 * <p>{value}<span className="text-xs">{unit}</span></p>
 */
export function splitSize(size: bigint | number): [string, string] {
  const [value, ...unitParts] = formatSize('byte', 'unit', size).split(' ')
  return [value, unitParts.join(' ')]
}

/**
 * Coarse `bigint` byte count → `18.4 MB`, for the workspace storage tiles.
 *
 * Kept separate from `formatSize`: this one is hand-rolled and rounds KB to a
 * whole number, so collapsing the two would visibly change what those tiles
 * render.
 */
export function formatStorageBytes(bytes: bigint): string {
  const n = Number(bytes)
  if (n === 0) return '0 B'
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** Used/total as a 0–100 percentage, in integer arithmetic to stay bigint-safe. */
export function storagePct(used: bigint, total: bigint): number {
  if (total === 0n) return 0
  return Math.min(100, Number((used * 100n) / total))
}

// ---------------------------------------------------------------------------
// Invitations / share links
// ---------------------------------------------------------------------------

export function invitationStatusLabel(status: InvitationStatus) {
  return status === 'rejected' ? 'declined' : status
}

/** Relative "expires in" string, or null when there is no future expiry. */
export function formatExpiry(
  expiresAt: string | number | Date | null | undefined
): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'Expired'
  const days = Math.ceil(ms / 86_400_000)
  if (days <= 1) return 'in 1 day'
  if (days < 30) return `in ${days} days`
  const months = Math.round(days / 30)
  return `in ${months} month${months === 1 ? '' : 's'}`
}

/** Trailing line under a share link: `no expiry`, `expired`, `expires in 3 days`. */
export function expiryLabel(link: SharedLink, state: LinkState) {
  if (state === 'expired') return 'expired'
  if (!link.expiresAt) return 'no expiry'
  return `expires ${toRelativeTime(link.expiresAt) ?? ''}`.trim()
}
