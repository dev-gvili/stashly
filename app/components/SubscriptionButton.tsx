import { useFetcher } from 'react-router'
import { Button } from './ui/button'
import { StoragePlanType } from '@/prisma/enums'

const SubscriptionButton = ({
  storagePlanType,
}: {
  storagePlanType: StoragePlanType
}) => {
  const fetcher = useFetcher()
  return (
    <Button
      onClick={() =>
        fetcher.submit(
          {
            storagePlanType,
          },
          {
            method: 'POST',
            action: `/api/subscription`,
          }
        )
      }
    >
      {`Subscribe to ${storagePlanType} plan`}
    </Button>
  )
}
export { SubscriptionButton }
