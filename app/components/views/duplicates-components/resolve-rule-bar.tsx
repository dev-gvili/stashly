import { cn } from '@/utils/styles'
import { RESOLVE_RULES } from './duplicate-helpers'
import type { ResolveRule } from './types'

/**
 * The same rule chips as the duplicates ledger. The rule does not delete
 * anything — it only decides which copy starts out selected, which is what
 * makes one-tap triage possible.
 */
export function ResolveRuleBar({
  rule,
  onRuleChange,
  className,
}: {
  rule: ResolveRule
  onRuleChange: (rule: ResolveRule) => void
  className?: string
}) {
  const active = RESOLVE_RULES.find((entry) => entry.id === rule)
  return (
    <div className={cn('flex flex-wrap items-center gap-2 py-5', className)}>
      <span className="text-muted-foreground font-stashly mr-1 text-[10px] tracking-[0.2em] whitespace-nowrap uppercase">
        Resolve by
      </span>
      <div
        role="radiogroup"
        aria-label="Resolve duplicates by"
        className="flex flex-wrap items-center gap-2"
      >
        {RESOLVE_RULES.map((entry) => {
          const on = entry.id === rule
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={entry.hint}
              onClick={() => onRuleChange(entry.id)}
              className={cn(
                'font-stashly h-7 rounded-lg border px-2.5 text-[11px] whitespace-nowrap transition-colors',
                on
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-input text-muted-foreground hover:text-foreground hover:border-ring'
              )}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
      {active && (
        <span className="text-muted-foreground font-stashly ml-1 text-[11px]">
          {active.hint}
        </span>
      )}
    </div>
  )
}
