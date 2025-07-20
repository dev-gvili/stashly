import type { Route } from './+types/recent'
import { auth } from '@/services/auth.server'
import {
	DropArea,
	MediaUploadRoot,
	Trigger,
} from '@/components/file-upload'

export async function loader({ request, params }: Route.LoaderArgs) {
	// Fetch the 20 most recently updated items
	// const recentItems = await prisma.item.findMany({
	// 	take: 20,
	// 	orderBy: {
	// 		updatedAt: 'desc',
	// 	},
	// 	include: {
	// 		thumbnails: {
	// 			where: {
	// 				size: {
	// 					equals: 'medium',
	// 				},
	// 			},
	// 		},
	// 	},
	// })

	const session = await auth.api.getSession(request)
	// if (!session) throw new Error('Unauthorized')
	return { session }
}

export async function action({ request, params }: Route.ActionArgs) {
	// TODO: implement action logic
	return null
}

export default ({ loaderData }: Route.ComponentProps) => {
	const { session } = loaderData
	return (
		<div className="space-y-8">
			<MediaUploadRoot
				user={session?.user!}
				ownerId={session?.user?.id || ""}
				bucketName={session?.user?.bucket || ""}
			>
				<DropArea>
					<span>
						<Trigger>upload</Trigger>
					</span>
				</DropArea>
			</MediaUploadRoot>
			{/* <Upload
				ownerId={session.user.id}
				bucketName={session.user.bucket}
			/> */}
		</div>
	)
}
