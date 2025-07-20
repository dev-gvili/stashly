import type { Route } from './+types'
import { useRouteLoaderData } from 'react-router'
import type { Route as LayoutRoute } from '../+types/layout'
import { SubscriptionButton } from '@/components/SubscriptionButton'

export function meta({ matches }: Route.MetaArgs) {
	return [
		{ title: `Stashly - ${matches.at(-1)?.pathname}` },
		{ description: 'Dashboard' },
	]
}

// export async function clientLoader({
// 	request,
// 	params,
// }: Route.ClientLoaderArgs) {
// 	const session = await authClient.getSession()
// 	if (session.error) {
// 		console.error('Error fetching session:', session.error)

// 		// Handle error
// 		throw new Response('Failed to fetch session')
// 	}
// 	return session
// }

export async function loader({ request, params }: Route.ActionArgs) {
	// TODO: implement action logic
	// const items = await prisma.item.findMany({
	// 	select: {
	// 		id: true,
	// 		name: true,
	// 		type: true,
	// 		size: true,
	// 		file: true,
	// 		folder: true,
	// 		_count: {
	// 			select: {
	// 				children: true,
	// 			},
	// 		},
	// 		thumbnails: {
	// 			where: {
	// 				size: {
	// 					equals: 'medium',
	// 				},
	// 			},
	// 			select: {
	// 				url: true,
	// 			},
	// 		},
	// 	},
	// })
	// return { items }
	return null // Placeholder return to avoid errors
}

export default function Index({ loaderData }: Route.ComponentProps) {
	// const items = loaderData.items
	const data =
		useRouteLoaderData<LayoutRoute.ComponentProps['loaderData']>('layout')
	return (
		<div className="flex flex-col w-full min-h-screen font-sans">
			<div className="flex flex-col items-center justify-center font-sans">
				<h1>Dashboard</h1>
				<p className="text-gray-500">Welcome to your dashboard!</p>
				<p className="text-gray-500">
					Welcome, {data?.user.name || data?.user.email}!
				</p>
				<p className="text-gray-500">
					Your user ID is: {data?.user.id}
				</p>
				<p className="text-gray-500">
					Your bucket name is:{' '}
					{data?.user.bucket || 'No bucket assigned'}
				</p>
				<p className="text-gray-500">
					Your role is: {data?.user.role || 'No role assigned'}
				</p>
				<p className="text-gray-500">
					Your subscription ID is:{' '}
					{data?.user.subscriptionId || 'No subscription assigned'}
				</p>
				<p className="text-gray-500">
					Your storage plan ID is:{' '}
					{data?.user.storagePlanId || 'No storage plan assigned'}
				</p>
				<div className="flex justify-between w-full max-w-4xl mt-8 mb-4">
					<SubscriptionButton
						storagePlanType={"basic"}
						subscriptionType={"monthly"}
					/>
					<SubscriptionButton
						storagePlanType={"standard"}
						subscriptionType={"monthly"}
					/>
					<SubscriptionButton
						storagePlanType={"premium"}
						subscriptionType={"monthly"}
					/>
				</div>
				<h2 className="text-2xl font-bold mb-4">Items</h2>
			</div>
				{/* {items.map((item) => (
					<ItemCard
						key={item.id}
						id={item.id}
						to={`/dashboard/items/${item.id}`}
						name={item.name}
						type={item.type}
						size={item.size}
						className="bg-sidebar"
						//@ts-ignore
						thumbnail={
							item.type === 'file' ? item?.thumbnails[0]?.url : undefined
						}
						favorited={false}
					/>
				))} */}
		</div>
	)
}
