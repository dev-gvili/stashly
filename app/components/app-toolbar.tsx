// generate the main app toolbar with the buttons
import {
  Delete,
  FavoriteItems,
  MoveToTrash,
  Restore,
} from './core-components/buttons'

import {
  useLoaderData,
  useMatches,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { getQueryParam } from '../utils/query-params'
import { cn } from '../utils/styles'
import { Button } from './ui/button'
import { BackIcon } from './icons'
import { ButtonGroup } from './ui/button-group'
import {
  Breadcrumbs,
  type StashBreadcrumbsProps,
} from './core-components/breadcrumb-navigation'
import { useBreadcrumbs } from '@/hooks'

export const AppToolbar = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) => {
  let { me } = useParams()
  let [searchParams] = useSearchParams()
  let selectedItems = getQueryParam(searchParams, 'selectedItems')
  return (
    <div
      className={cn(
        'sticky bottom-0 w-full inline-flex gap-2 p-2 items-center bg-background',
        className
      )}
      {...props}
    >
      <Breadcrumbs />
      <ButtonGroup>
        <MoveToTrash variant="ghost" size="icon-sm" />
        <Restore variant="ghost" size="sm" />
        <Delete variant="ghost" size="icon-sm" />
        <FavoriteItems variant="ghost" size="icon-sm" />
      </ButtonGroup>
    </div>
  )
}
