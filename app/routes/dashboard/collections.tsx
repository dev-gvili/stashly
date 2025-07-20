import {
	DropArea,
	FileList,
	MediaUploadRoot,
	Trigger,
	Total,
	CountDown
} from '@/components/file-upload'
import { auth } from '@/services/auth.server'
import type { Route } from './+types/collections'
import { RiUpload2Fill } from '@remixicon/react'

export async function loader({ request, params }: Route.LoaderArgs) {
	// TODO: implement loader logic
	const session = await auth.api.getSession(request)
	if (!session) throw new Error('Unauthorized')
	return { date: new Date().toISOString(), session } // Example response
}

export async function action({ request, params }: Route.ActionArgs) {
	// TODO: implement action logic
	return null
}

export default ({ loaderData }: Route.ComponentProps) => {
	// This is a placeholder component for the collections route.
	// You can implement your collections UI here.
	return (
		<div>
			Collections Route - {loaderData.date}
			{/* <Upload
				ownerId={loaderData.session.user.id}
				bucketName={loaderData.session.user.bucket}
			/> */}
			<MediaUploadRoot
				user={loaderData.session.user}
				ownerId={loaderData.session.user.id}
				bucketName={loaderData.session.user.bucket}
			>
				<DropArea>
					<RiUpload2Fill />
					<Trigger>
						<span>Open</span>
					</Trigger>
				</DropArea>
				<FileList />
			</MediaUploadRoot>
		</div>
	)
}
