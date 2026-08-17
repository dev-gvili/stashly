import { cn } from '@/utils/styles'

/**
 * Why an item is being suggested — "opened 4x this week". Rides the bottom-left
 * of a thumbnail so the card's own footer keeps its name/size/date structure.
 *
 * Sits on a fixed black scrim, so the text is literal `text-white` rather than
 * a theme token that would invert and lose contrast.
 */
export function SuggestionReason({
  reason,
  className,
}: {
  reason: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-stashly pointer-events-none absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur-sm',
        className
      )}
    >
      {reason}
    </span>
  )
}
