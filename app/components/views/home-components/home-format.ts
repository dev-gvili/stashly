import {
  AudioFillIcon,
  CodeFillIcon,
  DocumentFillIcon,
  ImageFillIcon,
  VideoFillIcon,
} from '@/components/icons'
import type { FileKind } from '@/types/home.types'

export const KIND_ICON: Record<FileKind, typeof DocumentFillIcon> = {
  document: DocumentFillIcon,
  image: ImageFillIcon,
  audio: AudioFillIcon,
  video: VideoFillIcon,
  code: CodeFillIcon,
}

export function greetingFor(d: Date) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** "12m ago", "2h ago", "Yesterday", "Mon", "Oct 18". */
export function relativeTime(at: Date | string, now = new Date()) {
  const d = typeof at === 'string' ? new Date(at) : at
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000))
  if (mins < 60) return mins + 'm ago'
  if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago'
  if (mins < 60 * 48) return 'Yesterday'
  if (mins < 60 * 24 * 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
