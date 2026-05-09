import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Button } from '@/ui/button'
import { SemanticSearchIcon, SortAscIcon, SortDescIcon } from '@/components/icons'

export type SortDirection = 'asc' | 'desc'

export interface SortOption<F extends string = string> {
  field: F
  label: string
}

export interface SortValue<F extends string = string> {
  field: F
  direction: SortDirection
}

export interface SortDropdownProps<F extends string = string> {
  options: readonly SortOption<F>[]
  value: SortValue<F>
  onChange: (next: SortValue<F>) => void
  align?: 'start' | 'end'
  className?: string
}

export function SortDropdown<F extends string = string>({
  options,
  value,
  onChange,
  align = 'end',
  className,
}: SortDropdownProps<F>) {
  const current = options.find((o) => o.field === value.field) ?? options[0]
  const DirIcon = value.direction === 'asc' ? SortAscIcon : SortDescIcon

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          aria-label={`Sort by ${current.label}, ${value.direction}ending`}
        >
          <SemanticSearchIcon className="text-violet-500" />
          <span className="text-muted-foreground">Sort by</span>
          <span className="font-medium">{current.label}</span>
          <DirIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Field
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value.field}
          onValueChange={(field) =>
            onChange({ field: field as F, direction: value.direction })
          }
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.field} value={opt.field}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Direction
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => onChange({ ...value, direction: 'asc' })}
          aria-current={value.direction === 'asc'}
          className={value.direction === 'asc' ? 'bg-accent' : undefined}
        >
          <SortAscIcon />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onChange({ ...value, direction: 'desc' })}
          aria-current={value.direction === 'desc'}
          className={value.direction === 'desc' ? 'bg-accent' : undefined}
        >
          <SortDescIcon />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
