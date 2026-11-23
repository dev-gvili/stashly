import { cn } from '@/utils/styles'
import { Switch } from '@/ui/switch'
import { useEffect, useId, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { useFetcher } from 'react-router'

/**
 * One settings switch row: optional icon tile (or a larger `visual` in its
 * place), label, description and a square switch. The switch shows a pending value at once (read from the
 * fetcher's submission); a failed write drops it back to the saved value and
 * calls `onError`. The row text labels and describes the switch but is not a
 * second click target.
 */
export function SettingsSwitchRow({
  intent,
  prefKey,
  label,
  description,
  checked,
  icon: Icon,
  visual,
  onError,
}: {
  intent: string
  prefKey: string
  label: string
  description: string
  checked: boolean
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Replaces the icon tile, e.g. an animated vector. */
  visual?: ReactNode
  onError: (failed: boolean) => void
}) {
  const fetcher = useFetcher<{ ok: true } | { error: string }>()
  const labelId = useId()
  const descriptionId = useId()

  const pending = fetcher.formData?.get('value')
  const value = pending != null ? pending === 'true' : checked

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    onError('error' in fetcher.data)
  }, [fetcher.state, fetcher.data, onError])

  return (
    <div className="flex items-center gap-4 border-b border-input px-5 py-4 last:border-b-0">
      {visual ? (
        <div className="flex shrink-0 items-center gap-1">{visual}</div>
      ) : Icon && (
        <div className="grid size-8.5 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon aria-hidden className="size-4" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5">
        <span id={labelId} className="text-sm text-foreground">
          {label}
        </span>
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      </div>
      <Switch
        shape="square"
        checked={value}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        onCheckedChange={(next) =>
          fetcher.submit({ intent, key: prefKey, value: String(next) }, { method: 'post' })
        }
        className={cn(
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          // Indigo is spent on the checked track (the primitive draws it muted).
          'data-[state=checked]:bg-primary! **:data-[slot=switch-thumb]:data-[state=checked]:bg-primary-foreground!'
        )}
      />
    </div>
  )
}
