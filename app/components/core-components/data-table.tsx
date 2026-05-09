import React from 'react'
import { cn } from '@/utils/styles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/table'
import { Checkbox } from '@/ui/checkbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string
  header: string | React.ReactNode | (() => React.ReactNode) | null
  /**
   * CSS width string e.g. `'120px'`, `'8rem'`.
   * Omit on the primary content column — it will stretch to fill remaining space.
   */
  width?: string
  align?: 'left' | 'right' | 'center'
  /** Render the cell content for a given row. */
  cell: (row: T) => React.ReactNode
  /** Show sort indicators and call onSort when the header is clicked. */
  sortable?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Return a stable string key for each row. Falls back to row index. */
  getRowId?: (row: T) => string
  onRowClick?: (row: T) => void
  /** Show a hover-reveal checkbox column. Requires selectedIds + onSelectChange. */
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (id: string, checked: boolean) => void
  /** Trailing slot rendered per row, hidden until hover. */
  actions?: (row: T) => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
  /** Controlled sort state. */
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn('size-3 shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-30')}
    >
      <path
        d="M8 3L5 7h6L8 3Z"
        fill="currentColor"
        className={cn(active && dir === 'asc' ? 'opacity-100' : 'opacity-40')}
      />
      <path
        d="M8 13L5 9h6l-3 4Z"
        fill="currentColor"
        className={cn(active && dir === 'desc' ? 'opacity-100' : 'opacity-40')}
      />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  columns,
  data,
  getRowId,
  onRowClick,
  selectable,
  selectedIds,
  onSelectChange,
  actions,
  emptyState,
  className,
  sortKey,
  sortDir,
  onSort,
}: DataTableProps<T>) {
  const resolveId = (row: T, i: number) =>
    getRowId ? getRowId(row) : String(i)

  const colSpan =
    columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)

  return (
    <Table className={cn('table-fixed', className)}>
      {/* ── Header ── */}
      <TableHeader>
        <TableRow className="hover:bg-transparent border-border/50">
          {selectable && (
            <TableHead style={{ width: '40px' }} className="pr-2 pl-4" />
          )}
          {columns.map((col) => {
            const isActive = sortKey === col.key
            return (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  col.key && 'h-10 px-3 text-xs font-medium text-muted-foreground',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.sortable && 'cursor-pointer select-none',
                  col.sortable && 'hover:text-foreground transition-colors',
                )}
                onClick={
                 col.key && col.sortable && onSort ? () => onSort(col.key) : undefined
                }
              >
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    col.align === 'right' && 'flex-row-reverse',
                  )}
                >
                  {typeof col.header === 'function' ? col.header() : col.header}
                  {col.sortable && (
                    <SortIcon active={isActive} dir={sortDir} />
                  )}
                </span>
              </TableHead>
            )
          })}
          {actions && <TableHead style={{ width: '72px' }} />}
        </TableRow>
      </TableHeader>

      {/* ── Body ── */}
      <TableBody>
        {data.length === 0 ? (
          <TableRow className="hover:bg-transparent border-0">
            <TableCell
              colSpan={colSpan}
              className="py-14 text-center text-sm text-muted-foreground"
            >
              {emptyState ?? 'No results.'}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, i) => {
            const id = resolveId(row, i)
            const isSelected = selectedIds?.has(id) ?? false

            return (
              <TableRow
                key={id}
                data-slot="row"
                data-state={isSelected ? 'selected' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'group h-14 border-border/40 transition-colors rounded-md!',
                  onRowClick && 'cursor-pointer rounded-md! overflow-hidden',
                )}
              >
                {/* Checkbox */}
                {selectable && (
                  <TableCell style={{ width: '40px' }} className="pr-2 pl-4 py-0">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={(checked) =>
                        onSelectChange?.(id, !!checked)
                      }
                      className="size-5! opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity hover:cursor-pointer last-of-type:rounded-r-md!"
                    />
                  </TableCell>
                )}

                {/* Data cells */}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'py-0 px-3 h-14 align-middle',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      // Primary (grow) column — enable truncation
                      !col.width && 'overflow-hidden',
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}

                {/* Actions */}
                {actions && (
                  <TableCell
                    style={{ width: '72px' }}
                    className="py-0 px-2 h-14 align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {actions(row)}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
