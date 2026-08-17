import type { StashItem } from '@/types/stash.types'
import { formatSize } from '@/utils/formaters'

/** Short relative age used across the overview: `2m ago`, `3h ago`, `Yesterday`. */
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

/**
 * Percentage → a *literal* Tailwind basis class, in 5% steps.
 *
 * Meters need data-driven widths, and this design system forbids inline
 * styles. Tailwind only compiles class names it can see in source, so the
 * candidates are spelled out here and picked by index — never interpolated.
 */
const BASIS_STEPS = [
  'basis-[0%]',
  'basis-[5%]',
  'basis-[10%]',
  'basis-[15%]',
  'basis-[20%]',
  'basis-[25%]',
  'basis-[30%]',
  'basis-[35%]',
  'basis-[40%]',
  'basis-[45%]',
  'basis-[50%]',
  'basis-[55%]',
  'basis-[60%]',
  'basis-[65%]',
  'basis-[70%]',
  'basis-[75%]',
  'basis-[80%]',
  'basis-[85%]',
  'basis-[90%]',
  'basis-[95%]',
  'basis-[100%]',
] as const

export function basisForPercent(percent: number) {
  const clamped = Math.min(100, Math.max(0, percent))
  return BASIS_STEPS[Math.round(clamped / 5)]
}

const WIDTH_STEPS = [
  'w-[0%]',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-[100%]',
] as const

export function widthForPercent(percent: number) {
  const clamped = Math.min(100, Math.max(0, percent))
  return WIDTH_STEPS[Math.round(clamped / 5)]
}

/** Deterministic avatar tint — literal classes for the same reason as above. */
const AVATAR_TINTS = [
  'bg-emerald-600',
  'bg-orange-600',
  'bg-violet-600',
  'bg-sky-600',
  'bg-rose-600',
  'bg-teal-600',
] as const

export function avatarTint(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length]
}

/** Folders read as a child count, files as their own size. */
export function itemMeta(item: Pick<StashItem, 'type' | 'size' | 'folder'>) {
  return item.type === 'folder'
    ? `${item.folder?.inclusiveChildCount ?? item.folder?.childCount ?? 0} items`
    : formatSize('byte', 'unit', item.size)
}
