import { AddIcon } from '@/components/icons'
import type { OverviewPerson } from '@/types/stash.types'
import { toRelativeTime } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { Link } from 'react-router'
import { PersonAvatar } from './person-avatar'
import { SectionLabel } from './section-label'

const CARD_SHELL = 'bg-muted flex flex-col rounded-3xl p-4'

/**
 * One person you trade files with. Same card surface as the item cards —
 * filled, borderless, rounded-3xl — with the exchange count as the figure and
 * a couple of recent thumbnails as evidence.
 *
 * `to` is optional: there is no per-person route yet, and a card that links
 * nowhere is better than one that links somewhere wrong.
 */
function PersonCard({
  person,
  recentThumbs,
  to,
}: {
  person: OverviewPerson
  recentThumbs?: string[]
  to?: string
}) {
  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <PersonAvatar person={person} className="size-9 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="font-stashly truncate text-sm font-semibold">
            {person.name}
          </div>
          {person.role && (
            <div className="text-muted-foreground mt-1 text-xs tracking-wider whitespace-nowrap uppercase">
              {person.role}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-xl leading-none font-bold tracking-tight tabular-nums">
          {person.exchangedCount ?? 0}
        </span>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          files exchanged
        </span>
      </div>

      {recentThumbs && recentThumbs.length > 0 && (
        <div className="mt-2.5 flex gap-1">
          {recentThumbs.slice(0, 2).map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="bg-card aspect-square w-1/2 rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      {person.lastExchangeAt && (
        <div className="text-muted-foreground mt-2.5 truncate text-xs">
          last · {toRelativeTime(person.lastExchangeAt)}
        </div>
      )}
    </>
  )

  if (!to) return <div className={CARD_SHELL}>{body}</div>

  return (
    <Link to={to} className={CARD_SHELL}>
      {body}
    </Link>
  )
}

/** The people row: who you exchange files with, plus the invite affordance. */
export function PeopleStrip({
  people,
  personTo,
  inviteTo,
  thumbsByPerson,
  className,
}: {
  people: OverviewPerson[]
  /** Builds the destination for a person card. Omit while no route exists. */
  personTo?: (person: OverviewPerson) => string
  inviteTo: string
  /** Optional preview images per person id. */
  thumbsByPerson?: Record<string, string[]>
  className?: string
}) {
  if (!people.length) return null
  return (
    <section className={cn(className)}>
      <SectionLabel
        title="People"
        subtitle="who you exchange files with"
        action={
          <Link
            to={inviteTo}
            className="text-muted-foreground hover:text-foreground text-xs tracking-wider uppercase transition-colors"
          >
            Invite →
          </Link>
        }
      />
      <div className="grid grid-cols-5 gap-3">
        {people.slice(0, 4).map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            to={personTo?.(person)}
            recentThumbs={thumbsByPerson?.[person.id]}
          />
        ))}
        {/* The dashed border is the affordance — the one intentional exception
            to the page's borderless rule. */}
        <Link
          to={inviteTo}
          className="border-input text-muted-foreground hover:text-foreground hover:border-ring flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed p-4 transition-colors"
        >
          <span className="border-input flex size-9 items-center justify-center rounded-full border border-dashed">
            <AddIcon className="size-4" />
          </span>
          <span className="text-xs whitespace-nowrap">Invite someone</span>
        </Link>
      </div>
    </section>
  )
}
