import {
  ColorModeFillIcon,
  DarkModeFillIcon,
  LightModeFillIcon,
} from '@/components/icons'
import { Button } from '@/ui/button'
import { SegmentedControl, SegmentedControlItem } from '@/ui/segmented-control'
import { useFetcher, useRouteLoaderData } from 'react-router'
import type { loader } from '../root'
import { Popover, PopoverContent, PopoverTrigger } from './ui'

type ColorScheme = 'dark' | 'light' | 'system'

const MODES = [
  { value: 'dark', label: 'Dark', Icon: DarkModeFillIcon },
  { value: 'light', label: 'Light', Icon: LightModeFillIcon },
  { value: 'system', label: 'System', Icon: ColorModeFillIcon },
] as const

const isScheme = (v: unknown): v is ColorScheme =>
  v === 'dark' || v === 'light' || v === 'system'

/**
 * The header's color-mode button. Its popover is one three-way switch,
 * Dark | Light | System, on the search dialog's segment control. A pick shows
 * at once (read from the pending submission) and the popover stays open, so
 * the switch can be seen moving; outside click or Esc closes it.
 */
export function ModeToggle() {
  const fetcher = useFetcher<{ colorScheme: ColorScheme | null }>({
    key: 'color-scheme',
  })
  const root = useRouteLoaderData<typeof loader>('root')
  const pending = fetcher.formData?.get('color-scheme')
  const current: ColorScheme =
    (isScheme(pending) && pending) ||
    fetcher.data?.colorScheme ||
    root?.colorScheme ||
    'system'

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild className="cursor-pointer hover:mr-0 mr-0 peer">
        <Button
          variant="outline"
          size="icon"
          aria-label="Color mode"
          className="font-stashly bg-card! ring-2 ring-accent border-none data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground rounded-md!"
        >
          {current === 'dark' && <DarkModeFillIcon className="size-5!" />}
          {current === 'light' && <LightModeFillIcon className="size-5!" />}
          {current === 'system' && <ColorModeFillIcon className="size-5!" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        // Opening moved focus onto the selected tile, which Chrome drew with
        // the keyboard ring: a white outline on every open. Focus stays on the
        // button; Tab still reaches the switch, ring and all.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-auto rounded-xl border-input bg-card p-1.5 font-stashly shadow-stashly"
      >
        <SegmentedControl
          size="tile"
          aria-label="Color mode"
          value={current}
          onValueChange={(v) => {
            if (!isScheme(v) || v === current) return
            fetcher.submit(
              { 'color-scheme': v },
              { method: 'post', action: '/api/theme' }
            )
          }}
          className="border-none"
        >
          {MODES.map(({ value, label, Icon }) => (
            <SegmentedControlItem key={value} value={value} aria-label={label}>
              <Icon aria-hidden />
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </PopoverContent>
    </Popover>
  )
}
