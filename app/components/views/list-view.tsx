import { useSearchParams, useNavigate, useRouteLoaderData } from 'react-router'
import type { LoaderData } from '@/hooks/usePagination'
import type { StashItem } from '@/types/stash.types'
import { DataTable, type DataTableColumn } from '@/components/core-components/data-table'
import { formatSize } from '@/utils/formaters'
import { getQueryParamArray } from '@/utils/query-params'
import { toIcon, toItemUrl } from '@/utils/converters'
import { FolderIcon } from '@/components/icons'
import { ItemCard } from '@/components/stash/item-card'
import { ItemCardContext } from '@/hooks/useItemCard'
import type { Route } from '../../routes/+types/layout'

type ListViewProps<T> = {
  items: LoaderData<T>['items']
}

function ListRowActions({ item }: { item: StashItem }) {
  const user = useRouteLoaderData<Route.ComponentProps['loaderData']>('layout')!.user
  const [searchParams, setSearchParams] = useSearchParams()
  return (
    <ItemCardContext.Provider value={{ ...item, user, searchParams, setSearchParams }}>
      <ItemCard.Actions />
    </ItemCardContext.Provider>
  )
}

export const ListLayout = <T extends StashItem>({ items }: ListViewProps<T>) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useRouteLoaderData<Route.ComponentProps['loaderData']>('layout')!.user

  const isLayoutTypeList = searchParams.has('layout', 'list')
  if (!isLayoutTypeList) return null

  const layout = searchParams.get('layout')
  // One comma-joined param, matching `getQueryParamArray` and the rest of the
  // app. Repeated params would read back as a single id through
  // `searchParams.get`, so the toolbar count and its bulk actions would only
  // ever see the first selected item.
  const selectedItems = getQueryParamArray(searchParams, 'selectedItems')
  const selectedIds = new Set(selectedItems)

  const columns: DataTableColumn<T>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (item) => {
        const Icon = item.type === 'folder' ? FolderIcon : toIcon(item.category)
        return (
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
            <span className="truncate text-sm">{item.name}</span>
          </div>
        )
      },
    },
    {
      key: 'size',
      header: 'Size',
      width: '110px',
      align: 'right',
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatSize('byte', 'unit', item.size)}
        </span>
      ),
    },
    {
      key: 'count',
      header: 'Items',
      width: '80px',
      align: 'right',
      cell: (item) =>
        item.type === 'folder' ? (
          <span className="text-sm text-muted-foreground">
            {item.folder?.childCount ?? 0}
          </span>
        ) : null,
    },
  ]

  return (
    <DataTable<T>
      className="bg-card rounded-md"
      columns={columns}
      data={items ?? []}
      getRowId={(item) => item.id}
      onRowClick={(item) => {
        const to = toItemUrl({
          parentId: item.parentId || '',
          type: item.type,
          id: item.id,
          ownerId: user.id,
        })
        navigate(layout ? `${to}?layout=${layout}` : to)
      }}
      selectable
      selectedIds={selectedIds}
      onSelectChange={(id, checked) => {
        const next = new URLSearchParams(searchParams)
        const updated = checked
          ? Array.from(new Set([...selectedItems, id]))
          : selectedItems.filter((i) => i !== id)
        if (updated.length) next.set('selectedItems', updated.join(','))
        else next.delete('selectedItems')
        setSearchParams(next, { replace: true })
      }}
      actions={(item) => <ListRowActions item={item as StashItem} />}
    />
  )
}
