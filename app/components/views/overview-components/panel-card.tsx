import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Surface for grouped overview modules. Deliberately the same shell as
 * `FileCardDetail` / `FolderCardTab` — filled, borderless, rounded-3xl with a
 * p-3 gutter — so its children sit concentrically at rounded-2xl.
 */
export function PanelCard({
  title,
  icon,
  viewAll,
  children,
  className,
  bodyClassName,
}: {
  title: string
  icon?: ReactNode
  viewAll?: { to: string; label: string }
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('bg-card rounded-3xl p-3', className)}>
      <div className="flex items-center px-1 pt-1 pb-3">
        <h3 className="font-stashly flex items-center gap-2 text-sm whitespace-nowrap uppercase">
          {icon && (
            <span className="text-accent-foreground flex items-center">
              {icon}
            </span>
          )}
          {title}
        </h3>
        {viewAll && (
          <Link
            to={viewAll.to}
            className="text-muted-foreground hover:text-foreground ml-auto shrink-0 text-xs tracking-wider whitespace-nowrap uppercase transition-colors"
          >
            {viewAll.label} →
          </Link>
        )}
      </div>
      <div className={cn('grid grid-cols-4 gap-2', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
