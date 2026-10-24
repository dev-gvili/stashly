import { useFetcher, useRouteLoaderData } from 'react-router'
import { ColorModeFillIcon, DarkModeFillIcon, LightModeFillIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/styles'
import type { loader } from '../../../root'

type ThemeMode = 'light' | 'dark' | 'system'

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof LightModeFillIcon }[] = [
  { mode: 'light', label: 'Light', Icon: LightModeFillIcon },
  { mode: 'dark', label: 'Dark', Icon: DarkModeFillIcon },
  { mode: 'system', label: 'System', Icon: ColorModeFillIcon },
]

export type ThemeModeSwitcherProps = React.ComponentProps<'div'>

/**
 * Segmented Light / Dark / System control. Writes the same `color-scheme`
 * cookie as `ModeToggle` (via `/api/theme`, shared fetcher key), so the root
 * loader server-renders `<html data-theme>` and the choice survives sign-in.
 */
export function ThemeModeSwitcher({ className, ...props }: ThemeModeSwitcherProps) {
  const fetcher = useFetcher<{ colorScheme: ThemeMode }>({ key: 'color-scheme' })
  const root = useRouteLoaderData<typeof loader>('root')
  const mode =
    (fetcher.formData?.get('color-scheme') as ThemeMode | null) ??
    fetcher.data?.colorScheme ??
    root?.colorScheme ??
    'system'

  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      className={cn('surface-glass flex items-center gap-0.5 rounded-xl p-1 shadow-stashly', className)}
      {...props}
    >
      {OPTIONS.map(({ mode: value, label, Icon }) => {
        const active = mode === value
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            variant="ghost"
            size="sm"
            onClick={() =>
              fetcher.submit({ 'color-scheme': value }, { method: 'post', action: '/api/theme' })
            }
            data-active={active}
            className="h-7 gap-1.5 rounded-lg px-2.5 font-mono text-xs font-normal text-muted-foreground hover:bg-secondary! hover:text-foreground! data-[active=true]:bg-secondary data-[active=true]:text-foreground"
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        )
      })}
    </div>
  )
}
