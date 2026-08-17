import { cn } from '@/utils/styles'
import { avatarTint } from './overview-helpers'
import type { OverviewPerson } from './types'

/**
 * Initial-or-photo avatar. Tint is derived from the person id so the same
 * person keeps the same colour everywhere on the page.
 */
export function PersonAvatar({
  person,
  className,
}: {
  person: OverviewPerson
  className?: string
}) {
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt={person.name}
        loading="lazy"
        className={cn('size-6 shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'text-primary-foreground font-stashly flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs uppercase',
        avatarTint(person.id),
        className
      )}
    >
      {person.name.slice(0, 1)}
    </span>
  )
}
