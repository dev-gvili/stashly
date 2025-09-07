// import { fromCallback } from 'xstate'
// import type { MediaFile, User } from './types'

// export const multipartActor = fromCallback<
// 	{ type: 'pause' | 'abort' },
// 	{
// 		mediaFile: MediaFile
// 		bucket: string
// 		user: User
// 		key: string
// 		chunkSize: number
// 	}
// >(({ sendBack, receive, input }) => {
// 	const {
// 		mediaFile: { file },
// 		bucket,
// 		user,
// 	} = input

// 	let s3 = new S3Service(bucket)
// 	let abort = new AbortController()

	
// 	s3.uploadFile(
// 		file,
// 		user,
// 		'',
// 		(progress) => {
// 			sendBack({
// 				type: 'progress',
// 				progress,
// 			})
// 		},
// 		abort
// 	).then((uploadedFile) => {
// 		if (uploadedFile) {
// 			sendBack({
// 				type: 'done',
// 				...uploadedFile,
// 			})
// 		}
// 	})

// 	receive(({ type }) => {
// 		if (type === 'abort') {
// 			abort.abort()
// 			sendBack({ type: 'aborted' })
// 		}
// 	})
// })
