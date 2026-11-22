import type { ColorScheme } from '@/hooks/useColorScheme'
import { cn } from '@/utils/styles'
import { RadioGroupItem } from '@/ui/radio-group'
import type { ComponentType, SVGProps } from 'react'

/**
 * One theme card in Settings → Appearance. The whole card is the radio's
 * label. Its preview is a tiny app (side panel + canvas of two tiles) drawn
 * with design tokens under a forced `data-theme`, so it needs no literal
 * colours; System overlays a light preview clipped corner to corner.
 */
export function ThemeOption({
  value,
  label,
  icon: Icon,
  selected,
}: {
  value: ColorScheme
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  selected: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2 pb-3 text-foreground transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        selected ? 'border-primary ring-4 ring-primary/15' : 'border-input hover:bg-muted'
      )}
    >
      <div aria-hidden className="relative flex h-23 overflow-hidden rounded-lg border border-input">
        {value === 'system' ? (
          <>
            <ThemePreview theme="dark" />
            <ThemePreview theme="light" className="absolute inset-0 clip-diagonal" />
          </>
        ) : (
          <ThemePreview theme={value} />
        )}
      </div>
      <div className="flex items-center gap-2 px-1 text-sm">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {label}
        <RadioGroupItem value={value} aria-label={label} className="ml-auto" />
      </div>
    </label>
  )
}

function ThemePreview({ theme, className }: { theme: 'dark' | 'light'; className?: string }) {
  return (
    <div data-theme={theme} className={cn('flex flex-1', className)}>
      <div className="flex w-3/10 flex-col gap-1.25 bg-sidebar p-2">
        <div className="h-1.25 w-7/10 rounded-xs bg-primary" />
        <div className="h-1 rounded-xs bg-secondary" />
        <div className="h-1 w-4/5 rounded-xs bg-secondary" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1.5 bg-background p-2.5">
        <div className="rounded-sm bg-card" />
        <div className="rounded-sm bg-card" />
      </div>
    </div>
  )
}
