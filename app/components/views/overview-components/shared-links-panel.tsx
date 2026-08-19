import { ItemCard } from '@/components/stash/item-card'
import useConfirm from '@/hooks/useConfirm'
import { useClipboard } from '@/hooks/useClipboard'
import type { LinkState, SharedLink } from '@/types/stash.types'
import { Button } from '@/ui/button'
import { toLinkState } from '@/utils/converters'
import { expiryLabel } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'
import { PanelCard } from './panel-card'

/** Literal tints — Tailwind only compiles class names it can see in source. */
const STATE_DOT: Record<LinkState, string> = {
  live: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-muted-foreground',
}

/** One outbound link: status dot, audience, permission, views, row actions. */
function SharedLinkRow({
  link,
  onCopy,
  onRevoke,
  onRenew,
}: {
  link: SharedLink
  onCopy?: (link: SharedLink) => void
  onRevoke?: (link: SharedLink) => void
  onRenew?: (link: SharedLink) => void
}) {
  const state = toLinkState(link)
  const { copy } = useClipboard()
  const { open: confirmRevoke } = useConfirm()

  const handleCopy = () => {
    if (onCopy) return onCopy(link)
    if (link.url) void copy(link.url)
  }

  const handleRevoke = () => {
    if (state === 'expired') return onRenew?.(link)
    if (!onRevoke) return
    confirmRevoke({
      title: 'Revoke this link?',
      description: `Anyone holding the link to “${link.item.name}” loses access immediately.`,
      confirmText: 'Revoke',
      variant: 'destructive',
      onConfirm: () => onRevoke(link),
    })
  }

  return (
    <ItemCard
      {...link.item}
      className="bg-muted group flex flex-row items-center gap-3 rounded-3xl border-none! p-2"
    >
      <ItemCard.Thumbnail className="bg-card size-14 shrink-0 overflow-hidden rounded-2xl">
        <ItemCard.ThumbnailImage className="rounded-2xl" />
        <ItemCard.ThumbnailFallback className="text-muted-foreground rounded-2xl p-2 [&_svg]:size-8" />
      </ItemCard.Thumbnail>

      <div className="min-w-0 flex-1">
        <ItemCard.Name
          className={cn(
            'font-stashly h-auto w-full max-w-full truncate text-left text-sm font-semibold',
            state === 'expired' && 'text-muted-foreground'
          )}
        />
        <p className="text-muted-foreground truncate text-xs">
          {link.audience} · {link.permission}
        </p>
        <p className="mt-1 flex items-center gap-1.5">
          <span
            className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT[state])}
          />
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {expiryLabel(link, state)} · {link.viewCount} views
          </span>
        </p>
      </div>

      {/* Revealed on hover *and* focus-within so the row stays keyboard
          reachable. */}
      <div className="flex shrink-0 items-center gap-1 pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="bg-card h-7 rounded-lg px-2.5 text-xs"
          onClick={(event) => {
            event.stopPropagation()
            handleCopy()
          }}
        >
          Copy
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="bg-card h-7 rounded-lg px-2.5 text-xs"
          onClick={(event) => {
            event.stopPropagation()
            handleRevoke()
          }}
        >
          {state === 'expired' ? 'Renew' : 'Revoke'}
        </Button>
      </div>
    </ItemCard>
  )
}

/** Outbound share links you own, with their live / expiring / expired state. */
export function SharedLinksPanel({
  links,
  manageTo,
  icon,
  className,
  onCopy,
  onRevoke,
  onRenew,
}: {
  links: SharedLink[]
  manageTo: string
  icon?: ReactNode
  className?: string
  onCopy?: (link: SharedLink) => void
  onRevoke?: (link: SharedLink) => void
  onRenew?: (link: SharedLink) => void
}) {
  if (!links.length) return null
  return (
    <PanelCard
      title="Shared by you"
      icon={icon}
      viewAll={{ to: manageTo, label: 'Manage links' }}
      bodyClassName="flex flex-col gap-2"
      className={cn(className)}
    >
      {links.slice(0, 4).map((link) => (
        <SharedLinkRow
          key={link.item.id}
          link={link}
          onCopy={onCopy}
          onRevoke={onRevoke}
          onRenew={onRenew}
        />
      ))}
    </PanelCard>
  )
}
