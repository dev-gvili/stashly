import { useMemo, useState } from 'react'
import { ChevronRightIcon, SearchIcon } from '@/components/icons'
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  useSidebar,
} from '@/components/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OutlineSymbol } from '@/.client/monaco-outline'
import { cn } from '@/utils/styles'

/**
 * Shared with the stage's `SidebarTrigger`, so the toggle and the rail read
 * the same entry in the sidebar provider — which is what gives the rail its
 * cookie-persisted open state, exactly like the Markdown outline.
 */
export const CODE_OUTLINE_SIDEBAR_ID = 'code_outline_rails'

/**
 * Symbol kind → its one-glyph badge. The Ink shell has no per-kind icon set
 * and inventing twenty would fight a monochrome system, so kinds read as
 * letter-forms — the same trick the editor's duotone syntax uses.
 */
const KIND_GLYPHS: Record<string, string> = {
  class: 'C',
  interface: 'I',
  // Type aliases and import aliases: distinctions Monaco's own outline adapter
  // collapses into "variable", and the reason TS/JS reads its kinds straight
  // off the navigation tree (see `.client/monaco-outline`).
  type: 'T',
  alias: 'a',
  enum: 'E',
  'enum-member': 'e',
  struct: 'S',
  function: 'ƒ',
  method: 'm',
  constructor: 'c',
  property: 'p',
  field: 'f',
  variable: 'v',
  constant: 'k',
  module: 'M',
  namespace: 'N',
  package: 'P',
  'type-parameter': 't',
  event: 'v',
  operator: 'o',
  object: '{',
  array: '[',
  key: ':',
  string: '"',
  number: '#',
  boolean: 'b',
  file: 'F',
  null: '∅',
}

/** One rendered line of the rail. */
type OutlineRow = {
  symbol: OutlineSymbol
  depth: number
  /** Ancestor trail, shown only while filtering. */
  container?: string
}

/** The tree as rows, skipping anything under a collapsed parent. */
function visibleRows(
  symbols: OutlineSymbol[],
  collapsed: ReadonlySet<string>,
  depth = 0
): OutlineRow[] {
  const rows: OutlineRow[] = []
  for (const symbol of symbols) {
    rows.push({ symbol, depth })
    if (symbol.children.length && !collapsed.has(symbol.id)) {
      rows.push(...visibleRows(symbol.children, collapsed, depth + 1))
    }
  }
  return rows
}

/** Every symbol whose name contains `query`, flattened, with its trail. */
function matchingRows(
  symbols: OutlineSymbol[],
  query: string,
  trail: string[] = []
): OutlineRow[] {
  const rows: OutlineRow[] = []
  for (const symbol of symbols) {
    if (symbol.name.toLowerCase().includes(query)) {
      rows.push({ symbol, depth: 0, container: trail.join(' › ') })
    }
    rows.push(...matchingRows(symbol.children, query, [...trail, symbol.name]))
  }
  return rows
}

/**
 * The deepest symbol whose body contains `line` — what the cursor is "inside".
 * Innermost wins, so a method highlights rather than its whole class.
 */
function symbolAtLine(symbols: OutlineSymbol[], line: number): string | null {
  for (const symbol of symbols) {
    if (line < symbol.startLine || line > symbol.endLine) continue
    return symbolAtLine(symbol.children, line) ?? symbol.id
  }
  return null
}

/**
 * CodeOutline — the code stage's outline rail: the document's symbol tree, the
 * same list VSCode's Outline view and its `@` quick-open show. Clicking a row
 * reveals that symbol in the editor; typing in the filter flattens the tree to
 * matches, which is what the `@:` form of quick-open does.
 *
 * Built like the Markdown outline: an inline collapsible card beside the
 * reader whose open state lives in the shared sidebar provider (so the
 * `SidebarTrigger` in the stage toolbar drives it and the choice persists in
 * the sidebar cookie), with rows as ghost `Button`s.
 *
 * The tree itself comes from the language service (see
 * `.client/monaco-outline`), so it re-derives after Format Document rather
 * than pointing at stale lines.
 */
export function CodeOutline({
  symbols,
  cursorLine,
  hasOutline,
  onSelect,
}: {
  symbols: OutlineSymbol[]
  cursorLine: number
  hasOutline: boolean
  onSelect: (symbol: OutlineSymbol) => void
}) {
  const { open } = useSidebar(CODE_OUTLINE_SIDEBAR_ID)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  const trimmed = query.trim().toLowerCase()
  const rows = useMemo(
    () =>
      trimmed
        ? matchingRows(symbols, trimmed)
        : visibleRows(symbols, collapsed),
    [symbols, trimmed, collapsed]
  )
  const activeId = useMemo(
    () => symbolAtLine(symbols, cursorLine),
    [symbols, cursorLine]
  )

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div
      data-state={open ? 'expanded' : 'collapsed'}
      className={cn(
        'flex h-[calc(100vh-4rem)] w-full shrink-0 flex-col overflow-hidden rounded-lg border border-input bg-card shadow-stashly transition-[width,display] duration-200 ease-linear',
        open && hasOutline ? 'w-72 max-w-80' : 'hidden'
      )}
    >
      <div className="flex flex-col gap-2 px-2 pt-4">
        <span className="px-2 font-stashly text-xs uppercase text-muted-foreground">
          Outline
        </span>
        <InputGroup className="h-8 rounded-md">
          <InputGroupAddon>
            <SearchIcon className="size-5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            className="font-stashly text-xs"
            placeholder="Filter symbols"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      <ScrollArea className="h-full w-72" type="auto">
        <ul className="flex w-full flex-col items-start gap-0.5 p-2">
          {rows.map(({ symbol, depth, container }) => (
            <SymbolRow
              key={symbol.id}
              active={symbol.id === activeId}
              collapsed={collapsed.has(symbol.id)}
              container={container}
              depth={depth}
              onSelect={onSelect}
              onToggle={toggle}
              symbol={symbol}
            />
          ))}
        </ul>

        {rows.length === 0 && (
          <p className="px-2 py-4 text-center font-stashly text-xs text-muted-foreground">
            No symbols match
          </p>
        )}
      </ScrollArea>
    </div>
  )
}

/**
 * One symbol. The chevron is a sibling button rather than nested inside the
 * label — collapsing a branch should never also jump the editor to it, and a
 * button inside a button is invalid markup.
 */
function SymbolRow({
  symbol,
  depth,
  active,
  collapsed,
  container,
  onSelect,
  onToggle,
}: {
  symbol: OutlineSymbol
  depth: number
  active: boolean
  collapsed: boolean
  container?: string
  onSelect: (symbol: OutlineSymbol) => void
  onToggle: (id: string) => void
}) {
  const expandable = symbol.children.length > 0
  const expanded = expandable && !collapsed
  return (
    <li
      className="flex w-full items-center"
      // Nesting has no fixed depth, so indentation can't come from a class.
      style={{ paddingLeft: `${depth * 8}px` }}
    >
      {expandable ? (
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${symbol.name}` : `Expand ${symbol.name}`}
          className="size-6 shrink-0 rounded-md border-none text-muted-foreground"
          onClick={() => onToggle(symbol.id)}
        >
          <ChevronRightIcon
            className={cn('size-5 transition-transform', expanded && 'rotate-90')}
          />
        </Button>
      ) : (
        <span className="size-6 shrink-0" />
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-current={active || undefined}
        title={container ? `${container} › ${symbol.name}` : symbol.name}
        onClick={() => onSelect(symbol)}
        className={cn(
          'min-w-0 flex-1 justify-start gap-2 font-stashly text-xs transition-colors hover:cursor-pointer',
          active
            ? 'bg-transparent font-semibold text-current'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <span aria-hidden className="w-3 shrink-0 text-center">
          {KIND_GLYPHS[symbol.kind] ?? '•'}
        </span>
        <span className="truncate">{symbol.name}</span>
        {(container || symbol.detail) && (
          <span className="ml-auto truncate pl-2 text-muted-foreground">
            {container || symbol.detail}
          </span>
        )}
      </Button>
    </li>
  )
}
