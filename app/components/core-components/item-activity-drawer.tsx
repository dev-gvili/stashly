import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ActivityFeed } from './activity-feed'
import type { ActivityWithRelations } from '@/utils/activity'
import { ScrollArea } from '../ui'

interface ItemActivityDrawerProps {
  itemId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}

export function ItemActivityDrawer({
  itemId,
  open,
  onOpenChange,
  children
}: ItemActivityDrawerProps) {
  const fetcher = useFetcher<{ data: ActivityWithRelations[] }>()

  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(`/api/activities?itemId=${itemId}`)
    }
  }, [itemId])

  const activities = fetcher.data?.data ?? []
  const isLoading = fetcher.state === 'loading'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80  bg-background rounded-md focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none shadow-stashly flex-col justify-center"
      >
        <SheetHeader>
          <SheetTitle className="text-sm font-stashly">Activity</SheetTitle>
          <SheetDescription>
            View the activity feed for this item.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
          <ActivityFeed activities={activities} isLoading={isLoading} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
