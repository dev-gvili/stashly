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

export const AppToolbar = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) => {
  let { me } = useParams()
  let [searchParams] = useSearchParams()
  let hasSelectedItems = hasQueryParam(searchParams, 'selectedItems')
  return (
    <div
      className={cn(
        'sticky bottom-0 w-full inline-flex gap-2 p-2 items-center bg-background z-50 h-12',
        className
      )}
      {...props}
    >
      <Breadcrumbs />
      <ButtonGroup hidden={!hasSelectedItems} className="ml-auto">
        <Restore variant="ghost" size="sm" />
        <Delete variant="ghost" size="icon-sm" />
        <FavoriteItems variant="ghost" size="icon-sm" />
        <MoveToTrash variant="ghost" size="icon-sm" />
      </ButtonGroup>
    </div>
  )
}
