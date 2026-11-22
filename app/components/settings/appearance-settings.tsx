import { ColorModeFillIcon, DarkModeFillIcon, LightModeFillIcon } from '@/components/icons'
import { isColorScheme, useColorScheme } from '@/hooks/useColorScheme'
import { cn } from '@/utils/styles'
import { Card } from '@/ui/card'
import { RadioGroup } from '@/ui/radio-group'
import { SETTINGS_CARD } from './settings-layout'
import { ThemeOption } from './theme-option'

const THEMES = [
  { value: 'dark', label: 'Dark', icon: DarkModeFillIcon },
  { value: 'light', label: 'Light', icon: LightModeFillIcon },
  { value: 'system', label: 'System', icon: ColorModeFillIcon },
] as const

/**
 * Appearance: the theme, as three cards. It is the same `color-scheme` cookie
 * the header toggle writes (`useColorScheme`), so a pick applies at once and
 * both controls always agree.
 */
export function AppearanceSettings() {
  const [scheme, setScheme] = useColorScheme()
  return (
    <Card className={cn(SETTINGS_CARD, 'flex flex-col gap-6 p-6')}>
      <div className="flex flex-col gap-3">
        <span id="theme-label" className="text-sm text-foreground">
          Theme
        </span>
        <RadioGroup
          aria-labelledby="theme-label"
          value={scheme}
          onValueChange={(v) => isColorScheme(v) && setScheme(v)}
          // Three equal cards across the row, as drawn; one column on a phone.
          // (`grid-cards-sm` auto-fills and left an empty fourth track.)
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEMES.map((theme) => (
            <ThemeOption key={theme.value} {...theme} selected={scheme === theme.value} />
          ))}
        </RadioGroup>
      </div>
    </Card>
  )
}
