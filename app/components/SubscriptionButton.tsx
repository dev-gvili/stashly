import { useFetcher } from 'react-router'
import { Button } from './ui/button'
import { StoragePlanType } from '@/prisma/enums'
import { SubscriptionType } from './../services/prisma/enums'

const SubscriptionButton = ({
	storagePlanType,
	subscriptionType,
}: {
	storagePlanType: StoragePlanType
	subscriptionType: SubscriptionType
}) => {
	const fetcher = useFetcher()
	return (
		<Button
			onClick={() => fetcher.submit({
                storagePlanType,
                subscriptionType
            }, {
                method: 'POST',
                action: `/api/subscription`
            })}
		>
			{`Subscribe to ${storagePlanType} plan`}
		</Button>
	)
}
export { SubscriptionButton }
