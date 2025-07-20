import { useRouteLoaderData } from 'react-router'
import { DropArea, MediaUploadRoot, FileList } from './file-upload'
import type { Route } from '../routes/+types/layout'

const Upload = ({
	ownerId,
	bucketName,
}: {
	ownerId: string
	bucketName: string
}) => {
	return (
		<MediaUploadRoot ownerId={ownerId} bucketName={bucketName}>
			{/* <DropArea /> */}
			{/* <FileList /> */}
            "Ddddd"
		</MediaUploadRoot>
	)
}

export { Upload }
