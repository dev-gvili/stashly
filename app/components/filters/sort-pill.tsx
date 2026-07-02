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
import type { Prisma } from '@/prisma/browser'
import { cn } from '@/utils/styles'
import type { JSX, SVGProps } from 'react'
import { useSearchParams } from 'react-router'
import { CURSOR_KEY } from './filter.data'

type SortDir = Prisma.SortOrder

type SortFieldDef = {
  key: string
  column: string | string[] | null
  label: string
  icon: string | ((props: SVGProps<SVGSVGElement>) => JSX.Element)
  hint: (dir: SortDir) => string
}

const SORT_FIELDS: SortFieldDef[] = [
  // {
  //   key: 'similarity',
  //   column: null,
  //   label: 'Similarity',
  //   icon: FuzzySearchIcon,
  //   hint: (d) => (d === 'asc' ? 'Least similar' : 'Most similar'),
  // },
  {
    key: 'name',
    column: 'name',
    label: 'Name',
    icon: SortByTextIcon,
    hint: (d) => (d === 'asc' ? 'A → Z' : 'Z → A'),
  },
  {
    key: 'updated',
    column: 'updatedAt',
    label: 'Updated',
    icon: SortByDateTimeIcon,
    hint: (d) => (d === 'asc' ? 'Old → New' : 'New → Old'),
  },
  {
    key: 'created',
    column: 'createdAt',
    label: 'Created',
    icon: SortByDateTimeIcon,
    hint: (d) => (d === 'asc' ? 'Old → New' : 'New → Old'),
  },
  {
    key: 'size',
    column: 'size',
    label: 'Size',
    icon: SortByNumberIcon,
    hint: (d) => (d === 'asc' ? 'Smallest first' : 'Largest first'),
  },
  {
    key: 'type',
    column: 'type',
    label: 'Type',
    icon: SortByTextIcon,
    hint: (d) => (d === 'asc' ? 'A → Z' : 'Z → A'),
  },
  {
    key: 'count',
    column: ['folder][childCount', 'collectionItems][_count'],
    label: 'Count',
    icon: SortByNumberIcon,
    hint: (d) => (d === 'asc' ? 'Fewest first' : 'Most first'),
  },
]

function readSortFromParams(searchParams: URLSearchParams): {
  field: SortFieldDef
  dir: SortDir
} {
  const re = /^orderBy\[(?:\d+\]\[)?(.+)\]$/
  for (const [k, v] of searchParams.entries()) {
    const m = k.match(re)
    if (m && (v === 'asc' || v === 'desc')) {
      const col = m[1]
      const found = SORT_FIELDS.find((f) =>
        Array.isArray(f.column) ? f.column.includes(col) : f.column === col
      )
      if (found) return { field: found, dir: v }
    }
  }
  return { field: SORT_FIELDS[0], dir: 'asc' }
}

export function SortPill() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { field, dir } = readSortFromParams(searchParams)
  const dirHint = field.hint(dir)
  const DirIcon = dir === 'asc' ? SortAscIcon : SortDescIcon

  const update = (next: { field?: SortFieldDef; dir?: SortDir }) => {
    setSearchParams(
      (p) => {
        const out = new URLSearchParams(p)
        for (const k of Array.from(out.keys())) {
          if (k.startsWith('orderBy[')) out.delete(k)
        }
        const nextField = next.field ?? field
        const nextDir = next.dir ?? dir
        const cols = Array.isArray(nextField.column)
          ? nextField.column
          : nextField.column
            ? [nextField.column]
            : []
        if (cols.length > 1) {
          cols.forEach((col, i) => out.set(`orderBy[${i}][${col}]`, nextDir))
        } else if (cols.length === 1) {
          out.set(`orderBy[${cols[0]}]`, nextDir)
        }
        out.delete(CURSOR_KEY)
        return out
      },
      { replace: true }
    )
  }

  const toggleDir = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    return update({ dir: dir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className="flex items-stretch gap-px">
      <Popover>
        <PopoverTrigger asChild>
          <ButtonGroup orientation="horizontal" className="h-auto gap-1">
            <Button
              variant="outline"
              size="default"
              className="max-w-max w-full border rounded-md! items-center justify-between font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground"
              title={`Sort by ${field.label.toLowerCase()} · ${dirHint}`}
            >
              <span className="flex items-center gap-1">
                <SortListIcon className="size-5 text-current" />
                <span className="text-sm font-stashly">{field.label}</span>
              </span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground rounded-md!"
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
          className="w-52 rounded-md shadow-xl overflow-hidden font-stashly border border-sidebar-border p-2 bg-sidebar"
        >
          <div className="text-xs uppercase text-muted-foreground px-2 pt-1 pb-1 font-stashly">
            Sort by
          </div>
          <div className="max-h-75 flex flex-col justify-start w-full gap-y-2">
            {SORT_FIELDS.map((f) => {
              const on = field.key === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => update({ field: f })}
                  className="inline-flex items-center gap-2 px-1.5 py-0"
                >
                  <f.icon className="size-6!" />
                  <span className="flex-1 text-left h-full align-text-bottom">
                    {f.label}
                  </span>
                  <Checkbox
                    className={cn('size-5 place-self-start hover:cursor-pointer bg-input')}
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
