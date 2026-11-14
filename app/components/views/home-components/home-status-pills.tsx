import { useFetcher, useRouteLoaderData } from 'react-router'
import { AIFillIcon, InboxFillIcon, SuccessIcon } from '@/components/icons'
import { KIND_ICON, initials, relativeTime } from '@/components/views/home-components/home-format'
import type { NeedsYouEntry, SearchableStatus } from '@/types/home.types'
import { Button } from '@/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Progress } from '@/ui/progress'
import { cn } from '@/utils/styles'

/**
 * Home's slot in the app header (owner, 14 Nov: the status pills belong in
 * the top toolbar): reads the home loader's data by route id, as
 * `GalleryHeaderTools` does for Images, so it renders nothing elsewhere.
 */
export function HomeHeaderTools() {
  const data = useRouteLoaderData('stash-home') as
    | { searchable: SearchableStatus; needsYou: NeedsYouEntry[] }
    | undefined
  const invitations = useFetcher()
  if (!data) return null

  const respond =
    (intent: 'accept_invitation' | 'reject_invitation') => (entry: NeedsYouEntry) =>
      invitations.submit(
        { intent, recipientId: entry.recipientId },
        { method: 'POST', action: '/api/invitations' }
      )

  return (
    // Hidden while the header is under 672px: on a phone the two made it
    // 534px wide at 375 (header-responsive E2E). Its other controls come first.
    <div className="flex items-center gap-2 @max-2xl/header:hidden">
      <SearchablePill status={data.searchable} />
      <NeedsYouPill
        entries={data.needsYou}
        onAct={respond('accept_invitation')}
        onDismiss={respond('reject_invitation')}
      />
    </div>
  )
}

/** "n/m searchable" button → popover listing files AI hasn't processed yet. */
export function SearchablePill({
  status,
  onProcess,
  busyIds = [],
}: {
  status: SearchableStatus
  /** Omit when processing isn't available; the queue then shows each row as unavailable. */
  onProcess?: (id: string) => void
  busyIds?: string[]
}) {
  const pct = status.total ? Math.round((status.done / status.total) * 100) : 100
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // The header's controls: h-9, rounded-md, bg-card (no pills).
          className="h-9 rounded-md border-input bg-card! px-3 font-normal text-secondary-foreground shadow-none hover:bg-muted! data-[state=open]:bg-muted!"
        >
          <Progress value={pct} className="h-1 w-11 bg-secondary" />
          <span className="font-stashly text-2xs tabular-nums">
            {status.done}/{status.total}
          </span>
          <span className="font-stashly text-xs">searchable</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-85 flex-col gap-3.5 rounded-xl border border-border p-4 shadow-stashly">
        <div className="flex items-baseline gap-2">
          <span className="font-stashly text-2xl leading-none font-semibold tracking-tight tabular-nums">{status.done}</span>
          <span className="font-stashly text-sm text-muted-foreground">of {status.total} files searchable</span>
        </div>
        <Progress value={pct} className="h-1 bg-secondary" />
        <p className="m-0 font-stashly text-xs leading-relaxed text-pretty text-muted-foreground">
          {status.queue.length
            ? 'These files can’t be found by what’s inside them yet. Process them to add them to search.'
            : 'Everything in your stash is searchable.'}
        </p>
        {status.queue.map((q) => {
          const Icon = KIND_ICON[q.kind]
          const busy = busyIds.includes(q.id)
          return (
            <div key={q.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-stashly text-sm font-medium">{q.name}</span>
                <span className="truncate font-stashly text-2xs text-muted-foreground">{q.meta}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !onProcess}
                onClick={() => onProcess?.(q.id)}
                className="h-7 border-border! bg-transparent! px-2.5 text-primary shadow-none"
              >
                <AIFillIcon className="size-3.5" />
                <span className="font-stashly text-xs">
                  {!onProcess ? 'Unavailable' : busy ? 'Working…' : q.kind === 'video' || q.kind === 'audio' ? 'Transcribe' : 'Index'}
                </span>
              </Button>
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

/** "Needs you" pill → popover of comments, invites and shares awaiting action. */
export function NeedsYouPill({
  entries,
  onAct,
  onDismiss,
}: {
  entries: NeedsYouEntry[]
  onAct: (entry: NeedsYouEntry) => void
  onDismiss: (entry: NeedsYouEntry) => void
}) {
  const has = entries.length > 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className={cn(
            'h-9 gap-2 rounded-md bg-primary/10 pr-1.5 pl-3 text-primary hover:bg-primary/20 data-[state=open]:bg-primary/20',
            !has && 'pr-3'
          )}
        >
          <InboxFillIcon className="size-4" />
          <span className="font-stashly text-xs font-medium">{has ? 'Needs you' : 'All caught up'}</span>
          {has && (
            <span className="grid h-5 min-w-5 place-items-center rounded-[4px] bg-primary px-1.5 font-stashly text-2xs text-primary-foreground tabular-nums">
              {entries.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-95 flex-col gap-4 rounded-xl border border-border p-4 shadow-stashly">
        {has ? (
          entries.map((n) => (
            <div key={n.id} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-[4px] bg-primary/10 font-stashly text-2xs font-semibold text-primary">
                {initials(n.actorName)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="m-0 font-stashly text-sm leading-snug text-pretty text-secondary-foreground">
                  <span className="font-stashly font-medium text-foreground">{n.actorName}</span> {n.text}
                </p>
                {n.quote && (
                  <p className="m-0 rounded-lg border border-border/50 bg-muted px-2.5 py-2 font-stashly text-xs leading-snug text-pretty text-muted-foreground">
                    {n.quote}
                  </p>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => onAct(n)} className="h-7 bg-primary/10 px-3 text-primary hover:bg-primary/20">
                    <span className="font-stashly text-xs">{n.cta}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(n)} className="h-7 px-2.5 text-muted-foreground">
                    <span className="font-stashly text-xs">Dismiss</span>
                  </Button>
                </div>
              </div>
              <span className="pt-0.5 font-stashly text-2xs whitespace-nowrap text-muted-foreground">{relativeTime(n.at)}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <SuccessIcon className="size-4 text-primary" />
            <span className="font-stashly text-sm">You’re all caught up</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
