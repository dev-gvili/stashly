import { AudioFillIcon, ImageFillIcon, LockFillIcon, SearchFillIcon } from '@/components/icons'
import { setAiGates } from '@/machines/indexing/ai-gates'
import { cn } from '@/utils/styles'
import { useEffect } from 'react'
import { Card } from '@/ui/card'
import { SaveError, useSaveError } from './notifications-settings'
import { SETTINGS_CARD } from './settings-layout'
import { SettingsSwitchRow } from './settings-switch-row'

type AiKey = 'transcribe' | 'caption' | 'index'

const ROWS = [
  {
    key: 'transcribe',
    icon: AudioFillIcon,
    label: 'Transcribe audio & video',
    description: 'Whisper, 120+ languages, detected automatically',
  },
  { key: 'caption', icon: ImageFillIcon, label: 'Caption images', description: 'Alt text you can search' },
  {
    key: 'index',
    icon: SearchFillIcon,
    label: 'Read PDFs for search',
    description: 'Page-by-page OCR into your search index',
  },
] as const

/**
 * AI & privacy: which in-browser pipelines run on new uploads. The gates are
 * checked where each pipeline starts, not only here.
 */
export function AiSettings({ prefs }: { prefs: Record<AiKey, boolean> }) {
  const [failed, onError] = useSaveError()
  // The saved values (the loader revalidates after each save) drive this
  // tab's indexing gates at once, without waiting for a reload.
  useEffect(() => setAiGates(prefs), [prefs])
  return (
    <div className="flex flex-col gap-3">
      <Card className={cn(SETTINGS_CARD, 'gap-0 overflow-hidden p-0')}>
        {ROWS.map((row) => (
          <SettingsSwitchRow
            key={row.key}
            intent="set_ai_pref"
            prefKey={row.key}
            label={row.label}
            description={row.description}
            icon={row.icon}
            checked={prefs[row.key]}
            onError={onError}
          />
        ))}
        <div className="flex items-center gap-2.5 bg-muted px-5 py-3.5 text-xs text-muted-foreground">
          <LockFillIcon aria-hidden className="size-4" />
          Processing runs in your browser.
        </div>
      </Card>
      <SaveError failed={failed} />
    </div>
  )
}
