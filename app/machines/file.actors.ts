import { fromCallback, fromPromise } from 'xstate'
import { fileUploadHandler } from './file.handlers'
import type { MediaFile } from './types'
import { parseHeaders, getStats, getPresignUrl } from './file.utils'
import type { Item } from '@/prisma/client'
import { getFileExtension } from '@/utils/parsers'
import type { UploadProgress } from '@/services/s3.server'
import type { User } from 'better-auth'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Client } from '@aws-sdk/client-s3'

// ====================================================== //
// Actors												  //
// ====================================================== //

export const requestPresignedUrl = fromPromise<
	{ url: string },
	{ file: File; bucketName: string }
>(async ({ input }) => {
	const { file, bucketName } = input
	return await getPresignUrl(bucketName, file)
})

export const createItem = fromPromise<Item, { mediafile: MediaFile }>(
	async ({ input }) => {
		const { mediafile } = input
		// let regex = new RegExp(/.(\w+)$/)
		let ext = getFileExtension(mediafile.file.name)
		// let ext = mediafile.file?.name?.match(regex)
		console.log('EXT', ext)
		let formData = new FormData()
		formData.append('name', mediafile.file.name)
		formData.append('extension', ext)
		formData.append('ownerId', mediafile.ownerId!)
		formData.append('size', `${mediafile.file.size}`)
		formData.append('mimeType', mediafile.file.type)
		let res = await fetch('/api/items', {
			method: 'POST',
			body: formData,
		})
		let data: { item: Item } = await res.json()
		console.log('ITEM: ', data.item)
		return data.item
	}
)

/**
 * xstate callback actor that upload a file to minio server using XMLHttpRequest
 * i'm using XMLHttpRequest and NOT fetch beacuse i need to track the upload progress, I can't do that with fetch and in XMLHttpRequest it's built-in 
 * this actor will send back to it's parent a `progress` event every time the uploaded bytes changes.
 * it's also listen for an `abort` even to abort the upload, when received it will execute `xhr.abort()` and send back to the parent an `aborted` event.
 * there is one more event the `done` event, we send this event when `XMLHttpRequest.readyState is DONE (4)`, before we send this event we parsed the response headers, those headers contains the `etag` and the `version` for the uploaded file assigned by `minio server`
 * 
 * 
 * Example of response headers
 * @example 
		accept-ranges: bytes
		access-control-allow-credentials: true
		access-control-allow-origin: http://localhost:5173
		access-control-expose-headers: Date, Etag, Server, Connection, Accept-Ranges, Content-Range, Content-Encoding, Content-Length, Content-Type, Content-Disposition, Last-Modified, Content-Language, Cache-Control, Retry-After, X-Amz-Bucket-Region, Expires, X-Amz*, X-Amz*, *
		content-length: 0
		content-type: text/plain; charset=utf-8
		date: Sun, 04 Aug 2024 19:59:00 GMT
		etag: "010ca4824d52fddc247f21f77b72601a"
		server: MinIO
		strict-transport-security: max-age=31536000; includeSubDomains
		vary: Origin, Accept-Encoding
		x-amz-id-2: dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8
		x-amz-request-id: 17E89EDF9448F040
		x-amz-version-id: bbe66fe8-4ac4-4c0d-b6f8-67ca3783dab5
		x-content-type-options: nosniff
		x-xss-protection: 1; mode=block
 */
export const uploadHandler = fromCallback<
	{ type: 'abort' },
	{ mediaFile: MediaFile; user: User; bucket: string }
>(({ sendBack, receive, input }) => {
	let {
		mediaFile: { file, url },
		user,
		bucket,
	} = input
	const xhr = new XMLHttpRequest()
	const startTime = new Date().valueOf()

	xhr.onreadystatechange = () => {
		if (xhr.readyState === 4) {
			let data = parseHeaders(xhr)
			if (!data.etag) {
				return
			}
			sendBack({
				type: 'done',
				etag: data.etag,
				version: data.version,
			})
		}
	}

	uploadFile(file, bucket, user, undefined, (progress) => {
		sendBack({
			type: 'progress',
			...progress,
		})
	})

	// fileUploadHandler(
	// 	url,
	// 	file,
	// 	(loadedBytes) => {
	// 		let stats = getStats(loadedBytes, startTime, file)
	// 		sendBack({
	// 			type: 'progress',
	// 			...stats,
	// 		})
	// 	},
	// 	() => {
	// 		sendBack({
	// 			type: 'aborted',
	// 		})
	// 	},
	// 	xhr
	// )

	receive(({ type }) => {
		if (type === 'abort') {
			xhr.abort()
		}
	})
})

function toUploadSpeed(loadedDelta: number, timeDelta: number) {
	const speedBytesPerSec = loadedDelta / timeDelta
	const speedKBPerSec = speedBytesPerSec / 1024
	const speed =
		speedKBPerSec >= 1024
			? { value: speedKBPerSec / 1024, unit: 'MB/s' as const }
			: { value: speedKBPerSec, unit: 'KB/s' as const }
	return { speedBytesPerSec, speed }
}

function toTimeLeft(secondsRemaining: number) {
	if (isNaN(secondsRemaining)) {
		return { hours: 0, minutes: 0, seconds: 0 }
	}
	const hours = Math.floor(secondsRemaining / 3600)
	const minutes = Math.floor((secondsRemaining % 3600) / 60)
	const seconds = Math.floor(secondsRemaining % 60)
	if (hours === Infinity && isNaN(minutes) && isNaN(seconds)) {
		return { hours: 0, minutes: 0, seconds: 0 }
	}
	return { hours, minutes, seconds }
}

function generateFileKey(workspaceId: string | undefined, file: File): string {
	if (file.webkitRelativePath && workspaceId) {
		// If the file has a webkitRelativePath, use it as the key
		return `${workspaceId}/${file.webkitRelativePath}`
	}
	if (file.webkitRelativePath && !workspaceId) {
		// If the file has a webkitRelativePath but no workspaceId, use it directly
		return file.webkitRelativePath
	}

	return workspaceId ? `${workspaceId}/${file.name}` : file.name
}

function parseProgress(loadedBytes: number, size: number) {
	let progress = (loadedBytes / size) * 100
	return parseInt(progress.toFixed(0))
}

async function uploadFile(
	file: File,
	bucket: string,
	user: User,
	workspaceId: string | undefined,
	onProgress?: (progress: UploadProgress) => void,
	abortController?: AbortController
) {
	const s3Client = new S3Client({
		region: 'auto',
		endpoint:
			process.env.AWS_ENDPOINT_URL || import.meta.env.AWS_ENDPOINT_URL,
		credentials: {
			accessKeyId:
				process.env.AWS_ACCESS_KEY || import.meta.env.AWS_ACCESS_KEY,
			secretAccessKey:
				process.env.AWS_SECRET_KEY || import.meta.env.AWS_SECRET_KEY,
		},
		forcePathStyle: false,
	})
	// Generate unique key.
	const key = generateFileKey(workspaceId, file)
	let uploadStartTime = Date.now()
	let lastLoaded = 0
	let lastLoadedTime = uploadStartTime

	// Create a new upload instance
	const upload = new Upload({
		client: s3Client,
		abortController,
		tags: [
			{ Key: 'WorkspaceId', Value: workspaceId },
			{ Key: 'UploadedBy', Value: user.id },
			{ Key: 'FileName', Value: file.name },
		],
		params: {
			Bucket: bucket,
			Key: key,
			Body: file.stream(),
			ContentType: file.type,
			ContentLength: file.size,
			Metadata: {
				workspaceId: workspaceId || '',
				uploadedBy: user.id,
				uploadedAt: new Date().toISOString(),
			},
		},
	})

	// Handle cancellation
	if (abortController) {
		abortController.signal.addEventListener('abort', () => {
			upload.abort()
			console.log(`Upload for ${key} has been cancelled.`)
		})
	}
	// Track upload progress
	upload.on('httpUploadProgress', (progress) => {
		if (!progress.loaded || !progress.total) {
			console.warn(`No upload data available for ${key}`)
			return
		}

		const currentTime = Date.now()
		const stats = getStats(progress.loaded, uploadStartTime, file)
		// const elapsedTime = (currentTime - uploadStartTime) / 1000 // in seconds
		const loadedDelta = progress.loaded - lastLoaded
		const timeDelta = (currentTime - lastLoadedTime) / 1000 // in seconds

		// // Calculate upload speed
		const { speedBytesPerSec, speed } = toUploadSpeed(
			loadedDelta,
			timeDelta
		)

		// // If no time has passed, skip progress update
		if (timeDelta <= 0) {
			console.warn(`No time elapsed for ${key}, skipping progress update`)
			return
		}
		const percentage = parseProgress(progress.loaded, file.size)

		// Calculate time
		const remainingBytes = progress.total - progress.loaded
		const remainingSeconds = remainingBytes / speedBytesPerSec
		const timeLeft = toTimeLeft(remainingSeconds)

		// Update progress tracking
		lastLoaded = progress.loaded
		lastLoadedTime = currentTime

		// Call progress callback if provided
		onProgress?.({
			percentage,
			timeLeft,
			speed,
		})

		// Log progress
		console.log(
			`Upload Progress for ${key}:`,
			`${percentage}% |`,
			`Speed: ${speed.value.toFixed(2)} ${speed.unit} |`,
			`Time left: ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
		)
	})

	try {
		// Check if already aborted before starting
		if (abortController?.signal.aborted) {
			throw new Error('Upload aborted')
		}

		const response = await upload.done()

		return {
			key,
			etag: response.ETag,
			versionId: response.VersionId,
			metadata: response.$metadata,
		}
	} catch (error) {
		console.error('Error uploading file:', error)
		throw new Error('Failed to upload file to S3')
	}
}
