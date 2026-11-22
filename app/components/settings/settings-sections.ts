import {
  AIFillIcon,
  ColorModeFillIcon,
  LinkIcon,
  NotificationFullFillIcon,
  StorageFillIcon,
  UserFillIcon,
} from '@/components/icons'
import type { ComponentType, SVGProps } from 'react'

export type SettingsSectionId =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'ai'
  | 'billing'
  | 'accounts'

export interface SettingsSection {
  id: SettingsSectionId
  /** Relative to `/:me/settings`. */
  path: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: string
}

/**
 * The one list of settings sections, in nav order. The nav, the section
 * heading, the breadcrumb and each route's `meta` all read it, so a label or
 * description changes here and nowhere else.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'profile',
    path: 'profile',
    label: 'Profile',
    icon: UserFillIcon,
    title: 'Profile',
    description: 'Your name and photo, visible to people you share with.',
  },
  {
    id: 'appearance',
    path: 'appearance',
    label: 'Appearance',
    icon: ColorModeFillIcon,
    title: 'Appearance',
    description: 'How Stashly looks on this device.',
  },
  {
    id: 'notifications',
    path: 'notifications',
    label: 'Notifications',
    icon: NotificationFullFillIcon,
    title: 'Notifications',
    description: 'Choose what Stashly tells you about.',
  },
  {
    id: 'ai',
    path: 'ai',
    label: 'AI & privacy',
    icon: AIFillIcon,
    title: 'AI & privacy',
    description: 'What Stashly reads so search can work on file contents.',
  },
  {
    id: 'billing',
    path: 'billing',
    label: 'Plan & billing',
    icon: StorageFillIcon,
    title: 'Plan & billing',
    description: 'Your plan and storage.',
  },
  {
    id: 'accounts',
    path: 'accounts',
    label: 'Connected accounts',
    icon: LinkIcon,
    title: 'Connected accounts',
    description: 'Sign-in providers linked to this account.',
  },
]

export function findSettingsSection(id: unknown): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id)
}

/** What each child route exports as `handle`. */
export interface SettingsHandle {
  sectionId: SettingsSectionId
}

export function settingsHandle(sectionId: SettingsSectionId): SettingsHandle {
  return { sectionId }
}

/** `Settings · {Title} · Stashly`, for each child route's `meta`. */
export function settingsMeta(sectionId: SettingsSectionId) {
  const section = findSettingsSection(sectionId)
  return [{ title: `Settings · ${section?.title ?? 'Settings'} · Stashly` }]
}

/** The section of the deepest matched route that names one. */
export function activeSettingsSection(
  matches: readonly { handle?: unknown }[]
): SettingsSection | undefined {
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle as Partial<SettingsHandle> | undefined
    const section = findSettingsSection(handle?.sectionId)
    if (section) return section
  }
  return undefined
}
