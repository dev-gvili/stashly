import { Card } from '@/ui/card'
import { Button } from '@/ui/button'
import { cn } from '@/utils/styles'
import { useEffect, useState, type ReactNode } from 'react'
import { useMatches, useNavigation, useRevalidator } from 'react-router'
import { SettingsNav } from './settings-nav'
import { activeSettingsSection, findSettingsSection, type SettingsSectionId } from './settings-sections'

/** The list-card look shared by every settings card (spec §3.4, §4). */
export const SETTINGS_CARD = 'rounded-md border border-input bg-card shadow-none'

/**
 * Settings page shell: the h1, the section nav and the content column (the
 * active section's h2 and description above the outlet). Moving between
 * sections keeps the old one mounted; only after 300 ms of loading is the
 * column faded, so a fast loader never flashes.
 */
export function SettingsLayout({ base, children }: { base: string; children: ReactNode }) {
  const section = activeSettingsSection(useMatches())
  const slow = useSlowNavigation(300)

  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-8 px-10 pt-10 pb-36 max-md:px-4 max-md:pt-6">
      <h1 className="text-3xl tracking-tight text-foreground">Settings</h1>
      <div className="flex flex-wrap items-start gap-10">
        <SettingsNav base={base} />
        <div
          className={cn(
            'flex min-w-0 flex-1 basis-120 flex-col gap-5 transition-opacity',
            slow && 'opacity-60'
          )}
        >
          {section && (
            <div className="flex flex-col gap-1">
              <h2 className="text-lg tracking-tight text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

/** True once a navigation has been loading for longer than `delay` ms. */
function useSlowNavigation(delay: number) {
  const loading = useNavigation().state === 'loading'
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), delay)
    return () => clearTimeout(timer)
  }, [loading, delay])
  return slow
}

/** Each section route's `ErrorBoundary`: the nav and heading stay usable. */
export function SettingsSectionError({ sectionId }: { sectionId: SettingsSectionId }) {
  const revalidator = useRevalidator()
  const title = findSettingsSection(sectionId)?.title ?? 'this section'
  return (
    <Card className={cn(SETTINGS_CARD, 'flex-row items-center justify-between gap-4 p-6')}>
      <p className="text-sm text-foreground">Couldn't load {title}.</p>
      <Button
        variant="outline"
        size="sm"
        disabled={revalidator.state === 'loading'}
        onClick={() => revalidator.revalidate()}
      >
        Try again
      </Button>
    </Card>
  )
}
