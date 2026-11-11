import { HeartIcon } from './icons'
import { Button } from './ui/button'
import { cn } from '@/utils/styles'
import { toFavorite } from '../utils/converters'
import { useItemCard } from '../hooks/useItemCard'
import { useFavorite } from '@/hooks/useFavorite'

export const Favorite = ({
  itemId,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
  itemId: string
}) => {
  const { favorites, user } = useItemCard()
  const initiallyFavorited = toFavorite({ favorites, userId: user!.id })
  const { favorited, toggle, isPending } = useFavorite(itemId, initiallyFavorited)

  return (
    <Button
      onClick={(event) => {
        event.stopPropagation()
        toggle()
      }}
      disabled={isPending}
      className={cn('z-20', className)}
      variant="ghost"
      size="icon-sm"
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      {...props}
    >
      <HeartIcon
        fill={favorited ? 'currentColor' : 'none'}
        className="size-5!"
      />
    </Button>
  )
}
