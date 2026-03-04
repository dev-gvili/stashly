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
