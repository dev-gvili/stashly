import { useFetcher } from 'react-router'
import { HeartIcon } from './icons'
import { Button } from './ui/button'
import { Toggle } from './ui/toggle'
import type { Route } from '../routes/api/+types/favorites'
import { cn } from '@/utils/styles'
import { toFavorite } from '../utils/converters'
import { useItemCard } from '../hooks/useItemCard'

export const Favorite = ({
  itemId,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
  itemId: string
}) => {
  let {favorites, user} = useItemCard()
  let favorited = toFavorite({favorites, userId: user!.id})
  const fetcher = useFetcher<Route.ComponentProps['loaderData']>({
    key: `favorite-${itemId}`,
  })
  if (fetcher.data) {
    favorited = fetcher.data.favorited ?? favorited
  }

  return (
    <Button
      onClick={(event) => {
        event.stopPropagation()
        fetcher.submit(
          {
            intent: favorited ? 'unfavorite' : 'favorite',
            itemId,
          },
          {
            method: 'GET',
            action: '/api/favorites',
          }
        )
      }}
      disabled={fetcher.state !== 'idle'}
      className={cn('z-20', className)}
      variant="ghost"
      size="icon-sm"
      {...props}
    >
      <HeartIcon
        fill={fetcher.data?.favorited || favorited ? 'currentColor' : 'none'}
        className="size-5!"
      />
    </Button>
  )
}
