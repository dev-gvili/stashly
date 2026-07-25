import {
  Delete,
  FavoriteItems,
  MoveToTrash,
  Restore,
  SelectAll,
} from './core-components/buttons'
import { useParams, useSearchParams, type Params, type UIMatch } from 'react-router'
import { getQueryParamArray, hasQueryParam } from '@/utils/query-params'
import { cn } from '@/utils/styles'
import { Breadcrumbs } from './core-components/breadcrumb-navigation'
import { ButtonGroup } from './ui/button-group'
import { useLocation } from 'react-router'
import { useBreadcrumbs } from '@/hooks'

type AppToolbarProps =
  React.ComponentPropsWithoutRef<'div'> & {
    title?: string
    route?: any
  }

export const AppToolbar = ({
  className,
  title,
  route,
  ...props
}: AppToolbarProps) => {
  let { me, folderId } = useParams()
  let location = useLocation()
  if (
    location.pathname.includes('/videos') ||
    location.pathname.includes('/images') || 
    location.pathname.includes('/storage') || 
    location.pathname.includes('/files') 
  ) {
    return null
  }
  let [searchParams] = useSearchParams()
  let selectedCount = getQueryParamArray(searchParams, 'selectedItems').length
  let breadcrumbs = useBreadcrumbs()

  // todo: create a function to detarmaind the title
  title = title ?? location.state?.name ?? breadcrumbs?.at(-1)?.name ?? location.pathname.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ') ?? ''
  return (
    <div
      className={cn(
        'mb-2  h-14 w-full gap-2 py-2 items-center justify-start bg-background z-10 flex shrink-0 sticky top-0',
        className
      )}
      {...props}
    >
      <h1 className="text-lg font-bold w-full max-w-max min-w-24">{title}</h1>
      <ButtonGroup  className="ml-auto gap-2">
        <Restore variant="ghost" size="icon-sm" />
        <FavoriteItems variant="outline" size="icon-sm" className='bg-card border-input' />
        <Delete
          variant="ghost"
          size="icon-sm"
          className="hover:bg-destructive/25! text-destructive-foreground!"
        />
        <SelectAll variant="outline" size="icon-sm" className='bg-card border-input' />
        <MoveToTrash
          variant="outline"
          size="icon-sm"
          className="hover:text-destructive-foreground! bg-destructive! border-input"
        />
      </ButtonGroup>
    </div>
  )
}
