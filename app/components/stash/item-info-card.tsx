import { cn } from '@/utils/styles'
import {
  InfoCircleIcon,
  InfoFillIcon,
  InfoIcon,
  InfoSquareIcon,
  MenuDotsIcon,
  MoreFillIcon,
  MoreIcon,
} from '../icons'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { ItemType } from '@/prisma/enums'

const ItemInfo = ({
  className,
  type,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof Button>, 'type'> & {
  type: ItemType
}) => {
  // Closing parenthesis was missing
  if (type === 'folder') return null // This comparison appears to be unintentional because the types '"button" | "submit" | "reset" | undefined' and '"folder"' have no overlap.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            'absolute bottom-2 right-2 z-20 size-7!  rounded! bg-background   ',
            className
          )}
          type="button"
          {...props}
        >
          <MenuDotsIcon className={'size-5! font-stashly'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        side="top"
        className="w-72 z-20"
      >
        <p>
          Placeholder for item info. This will contain details about the item,
          such as its description, quantity, and location.
        </p>
      </PopoverContent>
    </Popover>
  )
}

export { ItemInfo }
