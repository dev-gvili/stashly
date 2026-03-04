// generate the main app toolbar with the buttons
import {
  Delete,
  FavoriteItems,
  MoveToTrash,
  Restore,
  UnfavoriteItems,
} from './core-components/buttons'

import { useNavigate, useSearchParams } from 'react-router'
import { getQueryParam } from '../utils/query-params'
import { cn } from '../utils/styles'
import { Button } from './ui/button'
import { BackIcon } from './icons'
import { ButtonGroup } from './ui/button-group'

export const AppToolbar = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) => {
  let navigate = useNavigate()
  let [searchParams] = useSearchParams()
  let selectedItems = getQueryParam(searchParams, 'selectedItems')
  return (
    <div
      className={cn('w-full flex gap-2 py-2 px-4 mb-2  rounded-sm', className)}
      {...props}
    >
      <ButtonGroup>
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <BackIcon className="size-6!" />
        </Button>
        <MoveToTrash />
        <Restore variant="ghost" size="sm" />
        <Delete size="sm" />
      </ButtonGroup>
    </div>
  )
}
