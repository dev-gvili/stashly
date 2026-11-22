import { cn } from '@/utils/styles'
import { Card } from '@/ui/card'
import { useCallback, useState } from 'react'
import { SETTINGS_CARD } from './settings-layout'
import { SettingsSwitchRow } from './settings-switch-row'

type NotificationKey = 'comments' | 'shares' | 'ai' | 'weekly'

const ROWS: { key: NotificationKey; label: string; description: string }[] = [
  { key: 'comments', label: 'Comments on my files', description: 'When someone comments on a file you own' },
  { key: 'shares', label: 'Shares & invitations', description: 'Links shared with you, workspace invites' },
  { key: 'ai', label: 'AI processing finished', description: 'When a transcript or OCR pass completes' },
  { key: 'weekly', label: 'Weekly storage summary', description: 'Every Monday, by email' },
]

/** Notifications: four switches, saved one at a time as they change. */
export function NotificationsSettings({ prefs }: { prefs: Record<NotificationKey, boolean> }) {
  const [failed, onError] = useSaveError()
  return (
    <div className="flex flex-col gap-3">
      <Card className={cn(SETTINGS_CARD, 'gap-0 overflow-hidden p-0')}>
        {ROWS.map((row) => (
          <SettingsSwitchRow
            key={row.key}
            intent="set_notification_pref"
            prefKey={row.key}
            label={row.label}
            description={row.description}
            checked={prefs[row.key]}
            onError={onError}
          />
        ))}
      </Card>
      <SaveError failed={failed} />
    </div>
  )
}

/** The last switch write's outcome, for the line under a switch card. */
export function useSaveError(): [boolean, (failed: boolean) => void] {
  const [failed, setFailed] = useState(false)
  return [failed, useCallback((next: boolean) => setFailed(next), [])]
}

export function SaveError({ failed }: { failed: boolean }) {
  if (!failed) return null
  return (
    <p role="status" className="text-xs text-muted-foreground">
      Couldn't save — try again
    </p>
  )
}
