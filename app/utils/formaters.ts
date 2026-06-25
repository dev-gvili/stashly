import type { ZodFormattedError } from 'zod'

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
