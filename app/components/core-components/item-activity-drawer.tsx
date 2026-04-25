import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ActivityFeed } from './activity-feed'
import type { ActivityWithRelations } from '@/utils/activity'

interface ItemActivityDrawerProps {
  itemId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ItemActivityDrawer({ itemId, open, onOpenChange }: ItemActivityDrawerProps) {
  const fetcher = useFetcher<{ data: ActivityWithRelations[] }>()

  useEffect(() => {
    if (open && fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(`/api/activities?itemId=${itemId}`)
    }
  }, [open, itemId])

  const activities = fetcher.data?.data ?? []
  const isLoading = fetcher.state === 'loading'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm">Activity</SheetTitle>
        </SheetHeader>
        <ActivityFeed activities={activities} isLoading={isLoading} />
      </SheetContent>
    </Sheet>
  )
}
