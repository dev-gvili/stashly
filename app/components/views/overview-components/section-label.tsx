import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'

/**
 * The overview's only heading style: uppercase title, em-dash subtitle, and an
 * optional right-aligned action.
 */
export function SectionLabel({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-baseline gap-3', className)}>
      <h3 className="font-stashly text-sm whitespace-nowrap uppercase">
        {title}
      </h3>
      {subtitle && (
        <span className="text-muted-foreground truncate text-sm">
          — {subtitle}
        </span>
      )}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}
