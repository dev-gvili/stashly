import {
  SortAscIcon,
  SortByDateTimeIcon,
  SortByNumberIcon,
  SortByTextIcon,
  SortDescIcon,
  SortListIcon
} from '@/components/icons'
import {
  Button,
  ButtonGroup,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { useSortOrder } from '@/hooks/useSortOrder'
import type { SortField } from '@/utils/sort-fields'
import type { JSX, SVGProps } from 'react'

// A "Similarity" field (FuzzySearchIcon, Least/Most similar) was sketched here
// and left out; the field list itself lives in `@/utils/sort-fields`.
const FIELD_ICON: Record<
  SortField['key'],
  (props: SVGProps<SVGSVGElement>) => JSX.Element
> = {
  name: SortByTextIcon,
  updated: SortByDateTimeIcon,
  created: SortByDateTimeIcon,
  size: SortByNumberIcon,
  type: SortByTextIcon,
  count: SortByNumberIcon,
}

export function SortPill() {
  const { fields, field, dir, hint: dirHint, set } = useSortOrder()
  const DirIcon = dir === 'asc' ? SortAscIcon : SortDescIcon

  const update = (next: { field?: SortField; dir?: 'asc' | 'desc' }) => set(next)

  const toggleDir = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    return update({ dir: dir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className="flex items-stretch gap-px">
      <Popover>
        <PopoverTrigger asChild>
          <ButtonGroup orientation="horizontal" className="h-auto gap-2">
            <Button
              variant="outline"
              size="default"
              className="max-w-max w-full border-none ring-2 ring-accent rounded-md! items-center justify-between font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground"
              title={`Sort by ${field.label.toLowerCase()} · ${dirHint}`}
            >
              <span className="flex items-center gap-1">
                <SortListIcon className="size-5 text-current" />
                {/* A narrow header keeps the icon; the label stays for
                    screen readers. */}
                <span className="text-sm font-stashly @max-header-compact/header:sr-only">
                  {field.label}
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="font-stashly bg-card! border-none ring-2 ring-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground rounded-md!"
              onClick={toggleDir}
              title={`Direction: ${dirHint} (click to flip)`}
              aria-label={`Toggle sort direction (currently ${dirHint})`}
            >
              <DirIcon className="size-5 text-current" />
            </Button>
          </ButtonGroup>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-52 rounded-md shadow-xl overflow-hidden font-stashly border-none ring-2 ring-accent p-2 bg-card"
        >
          <div className="text-xs uppercase text-muted-foreground px-2 pt-1 pb-1 font-stashly">
            Sort by
          </div>
          <div className="max-h-75 flex flex-col justify-start w-full gap-y-2">
            {fields.map((f) => {
              const on = field.key === f.key
              const Icon = FIELD_ICON[f.key]
              return (
                <button
                  key={f.key}
                  onClick={() => update({ field: f })}
                  className="inline-flex items-center gap-2 px-1.5 py-0"
                >
                  <Icon className="size-6!" />
                  <span className="flex-1 text-left h-full align-text-bottom">
                    {f.label}
                  </span>
                  <Checkbox
                    className="place-self-start"
                    name={f.key}
                    checked={on}
                    onCheckedChange={() => update({ field: f })}
                  />
                </button>
              )
            })}
          </div>
          <div className="inline-flex items-center px-1.5 pt-4 w-full">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground font-stashly flex-1">
              Direction
            </span>
            <Button
              variant="ghost"
              onClick={toggleDir}
              size="sm"
              className="text-xs p-0 hover:bg-transparent"
            >
              <span>{dirHint}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
