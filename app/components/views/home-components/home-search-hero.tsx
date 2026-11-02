import { AIFillIcon, RecentFillIcon } from '@/components/icons'
import { greetingFor } from '@/components/views/home-components/home-format'
import { Button } from '@/ui/button'
import { Kbd } from '@/ui/kbd'

export interface HomeSearchHeroProps {
  firstName: string
  /** Recent queries first; an entry with `ai: true` renders with the AI glyph. */
  suggestions: { query: string; ai?: boolean }[]
  onOpenSearch: (query?: string) => void
  now?: Date
}

/**
 * Greeting, a large AI search trigger that opens the command palette, and
 * recent-query chips that open it pre-filled.
 */
export function HomeSearchHero({ firstName, suggestions, onOpenSearch, now = new Date() }: HomeSearchHeroProps) {
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <section className="relative flex w-full max-w-180 flex-col items-center gap-4.5">
      <span className="font-stashly text-2xs tracking-widest text-muted-foreground uppercase">
        {greetingFor(now)} · {today}
      </span>
      <h1 className="m-0 text-center font-stashly text-4xl font-semibold tracking-tighter text-balance">
        What are you looking for, {firstName}?
      </h1>

      <button
        type="button"
        onClick={() => onOpenSearch()}
        className="flex h-16 w-full items-center gap-3.5 rounded-2xl border border-border bg-card pr-3.5 pl-5.5 text-left shadow-stashly ring-6 ring-primary/10 transition-[border-color,box-shadow] hover:border-primary focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:outline-none"
      >
        <AIFillIcon className="size-5.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-stashly text-base text-muted-foreground">
          Ask your stash — inside documents, audio and images
        </span>
        <Kbd className="h-6 bg-secondary px-2 font-stashly text-2xs">⌘K</Kbd>
      </button>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => {
            const Icon = s.ai ? AIFillIcon : RecentFillIcon
            return (
              <Button
                key={s.query}
                variant="outline"
                size="sm"
                onClick={() => onOpenSearch(s.query)}
                className="h-7.5 rounded-full border-border! bg-background! px-3 font-normal text-muted-foreground shadow-none hover:bg-background! hover:text-foreground hover:border-input!"
              >
                <Icon className={s.ai ? 'size-3.5 text-primary' : 'size-3.5'} />
                <span className="font-stashly text-xs">{s.query}</span>
              </Button>
            )
          })}
        </div>
      )}
    </section>
  )
}
