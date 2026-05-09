import {
  Delete,
  FavoriteItems,
  MoveToTrash,
  Restore,
} from './core-components/buttons'
import { useParams, useSearchParams } from 'react-router'
import { hasQueryParam } from '@/utils/query-params'
import { cn } from '@/utils/styles'
import { Breadcrumbs } from './core-components/breadcrumb-navigation'
import { ButtonGroup } from './ui/button-group'
import { useLocation } from 'react-router'

export const AppToolbar = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) => {
  let { me, folderId } = useParams()
  let location = useLocation()
  if (
    location.pathname.includes('/videos') ||
    location.pathname.includes('/images')
  ) {
    return null
  }
  let [searchParams] = useSearchParams()
  let hasSelectedItems = hasQueryParam(searchParams, 'selectedItems')
  let selectedCount = searchParams.getAll('selectedItems').length
  if (!folderId && selectedCount <= 1) return null
  return (
    <div
      className={cn(
        'sticky bottom-0 w-full inline-flex gap-2 p-2 items-center bg-background z-40 h-12',
        className
      )}
      {...props}
    >
      <Breadcrumbs />
      <ButtonGroup hidden={!hasSelectedItems} className="ml-auto">
        <Restore variant="ghost" size="icon-sm" />
        <FavoriteItems variant="ghost" size="icon-sm" />
        <Delete
          variant="ghost"
          size="icon-sm"
          className="hover:bg-destructive/25! text-destructive-foreground!"
        />
        <MoveToTrash
          variant="ghost"
          size="icon-sm"
          className="hover:bg-destructive/25! text-destructive-foreground!"
        />
      </ButtonGroup>
    </div>
  )
}
