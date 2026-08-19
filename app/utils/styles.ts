import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * merge tailwindcss classes
 * @param inputs array of tailwindcss classes
 * @returns string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Percentage → literal Tailwind class
//
// Meters need data-driven widths, and this design system forbids inline
// styles. Tailwind only compiles class names it can see in source, so the
// candidates are spelled out here and picked by index — never interpolated.
// ---------------------------------------------------------------------------

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

/**
 * Shared by the storage strip and the search score meter — both had a
 * byte-identical private copy before this moved here.
 */
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
