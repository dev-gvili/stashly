import { DropdownIcon } from '@/components/icons'
import { ButtonGroup, ButtonGroupText } from '@/components/ui'
import { Button } from '@/ui/button'
import { cn } from '@/utils/styles'
import * as React from 'react'
import { useNavigate } from 'react-router'

// ---------------------------------------------------------------------------
// SiblingNav — prev/next navigation between media items in the same folder.
// Renders edge arrow buttons plus an "n of N" counter over the stage, and
// binds ArrowLeft/ArrowRight. Replaces history entries so Back returns to the
// gallery/folder the user came from, not through every sibling.
// ---------------------------------------------------------------------------

function EdgeNav({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className={cn(
        'absolute top-1/2 z-20 size-10 -translate-y-1/2 rounded-md backdrop-blur-sm transition-all hover:scale-105 hover:opacity-100',
        side === 'left' ? 'left-4' : 'right-4'
      )}
    >
      <DropdownIcon
        className={cn(
          'size-5',
          side === 'right' && '-rotate-90',
          side === 'left' && 'rotate-90'
        )}
      />
    </Button>
  )
}

export function SiblingNav({
  prevHref,
  nextHref,
  index,
  total,
}: {
  prevHref: string | null
  nextHref: string | null
  /** Zero-based position of the current item among its siblings; -1 hides the nav. */
  index: number
  total: number
}) {
  const navigate = useNavigate()
  const goTo = React.useCallback(
    (to: string | null) => {
      if (to) navigate(to, { replace: true })
    },
    [navigate]
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when another handler claimed the key (VideoStage seeks with the
      // arrows while the player is focused) or the user is typing in a field.
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))
      )
        return
      if (e.key === 'ArrowRight') goTo(nextHref)
      else if (e.key === 'ArrowLeft') goTo(prevHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, nextHref, prevHref])

  // if (index < 0 || total < 2) return null

  return (
    <ButtonGroup className="absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-md bg-card 
     border-none!" >
      <Button
        size="icon-sm"
        onClick={() => goTo(prevHref)}
        disabled={!prevHref}
        aria-label="Previous"
        className="border-none bg-card text-current"
      >
        <DropdownIcon className="rotate-90" />
      </Button>
      <ButtonGroupText className="px-2 text-xs text-muted-foreground border border-input rounded-md bg-card">
        {index + 1} of {total}
      </ButtonGroupText>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => goTo(nextHref)}
        disabled={!nextHref}
        aria-label="Next"
        className="border-none bg-card text-current"
      >
        <DropdownIcon className="-rotate-90" />
      </Button>
    </ButtonGroup>
  )
}
