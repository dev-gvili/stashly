import { cn } from '@/utils/styles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RemoveIcon } from '@/components/icons'

export function Chip({
  children,
  onRemove,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof Badge> & { onRemove?: () => void, }) {
  return (
    <Badge
      variant={variant}
      className={cn(
        `inline-flex items-center gap-0.5 h-6! p-1.5 rounded border font-stashly`,
      )}
    >
      {children}
      {onRemove && (
        <Button
          onClick={onRemove}
          className="opacity-60 hover:opacity-100 hover:bg-black/10 rounded-[2px] p-0! size-3! data-[state=open]:bg-black/10"
        >
          <RemoveIcon className="size-4!" />
        </Button>
      )}
    </Badge>
  )
}

export function DashedDiv() {
  return (
    <span className="self-stretch w-px border-l border-dashed border-border mx-1.5" />
  )
}
