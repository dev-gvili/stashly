import { fromCallback, fromPromise, type ExtractEvent } from 'xstate'
import { getPresignUrl } from './file.utils'
import type { Item } from '@/prisma/client'
import { parseFileExtension } from '@/utils/parsers'
import type { MediaFile, User, UploadProgress, MediaFileEvents } from './machine.types' // Ensure UploadProgress is
// import { uploadFileInPartsStream } from './file.stream.actor'
import { streamParts } from './s3.multipart.stream'
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
		let ext = parseFileExtension(mediafile.file.name)
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
	let progress = Math.round((loadedBytes / size) * 100)
	return parseInt(progress.toFixed(0))
}

export const api = {
	async createMultipartUpload(
		bucket: string,
		key: string,
		metadata?: Record<string, string>
	): Promise<{ uploadId: string }> {
		const res = await fetch('/api/s3/upload', {
			method: 'POST',
			body: JSON.stringify({
				bucket,
				key,
				metadata,
				action: 'create-multipart-upload',
			}),
			headers: { 'Content-Type': 'application/json' },
		})
		const { uploadId } = await res.json()
		return { uploadId }
	},
	async getPresignedUrl(
		partNumber: number,
		uploadId: string,
		key: string,
		bucket: string
	): Promise<{ url: string }> {
		const res = await fetch('/api/s3/upload', {
			method: 'POST',
			body: JSON.stringify({
				bucket,
				key,
				uploadId,
				partNumber,
				action: 'get-presigned-url',
			}),
			headers: { 'Content-Type': 'application/json' },
		})
		const { url } = await res.json()
		return { url }
	},
	async completeMultipartUpload({
		parts,
		key,
		uploadId,
	}: {
		parts: { ETag: string; PartNumber: number }[]
		key: string
		uploadId: string
	}): Promise<{
		etag: string
		key: string
		bucket: string
		versionId: string
	}> {
		let res = await fetch('/api/s3/upload', {
			method: 'POST',
			body: JSON.stringify({
				key,
				uploadId,
				parts,
				action: 'complete-multipart-upload',
			}),
			headers: { 'Content-Type': 'application/json' },
		})
		return await res.json()
	},
	async abortMultipartUpload(bucket: string, key: string, uploadId: string) {
		let res = await fetch('/api/s3/upload', {
			method: 'POST',
			body: JSON.stringify({
				bucket,
				key,
				uploadId,
				action: 'abort-multipart-upload',
			}),
			headers: { 'Content-Type': 'application/json' },
		})
		let { success } = await res.json()
		return { success }
	},
}

// Assuming your uploadChunk and uploadFileInParts are in a separate utility file, e.g., './upload.utils.ts'
// For this example, I'll put them directly below for self-containment.

// ====================================================== //
// Helper functions (could be in a separate upload.utils.ts)
// ====================================================== //

// A function that wraps XHR in a Promise to upload one chunk
export function uploadChunk(
	url: string,
	chunk: Blob,
	xhr: XMLHttpRequest,
	onProgress: (loaded: number, total: number) => void // Updated
): Promise<{ etag: string | null }> {
	return new Promise((resolve, reject) => {
		xhr.open('PUT', url, true)

		xhr.upload.onprogress = (event) => {
			onProgress(event.loaded, event.total) // Report loaded and total bytes for this chunk
		}

		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				let headers = xhr.getAllResponseHeaders()
				console.log(
					'UploadChunk:xhr.onreadystatechange:headers ',
					headers
				)
				// let data = parseHeaders(xhr)
				if (!headers.includes('etag')) return
				const Etag_first = xhr.getResponseHeader('Etag')
				const ETag_second = xhr.getResponseHeader('ETag')
				const etag_third = xhr.getResponseHeader('etag')
				console.log({ Etag_first, ETag_second, etag_third })
				// resolve({ etag: ETag_second })
			}
		}

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const etag = xhr.getResponseHeader('ETag')
				resolve({ etag })
			} else {
				reject(
					console.error(
						`Upload failed with status: ${xhr.status} - ${xhr.statusText}`
					)
				)
			}
		}

		xhr.upload.onerror = () =>
			reject(new Error('Network error during chunk upload.'))
		xhr.upload.onabort = () => reject(new Error('Chunk upload aborted.'))

		xhr.send(chunk)
	})
}

// The main orchestration function, now with detailed progress reporting
export async function uploadFileInParts(
	file: File,
	uploadId: string,
	key: string,
	onTotalProgress: (progress: UploadProgress) => void, // Updated signature
	onPartsUploaded: (args: {
		key: string | undefined
		bucket: string | undefined
		etag: string | undefined
		versionId: string | undefined
	}) => void,
	abortController: AbortController // Pass AbortController for cancellation
): Promise<void> {
	const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB
	const totalParts = Math.ceil(file.size / CHUNK_SIZE)
	const partProgress: number[] = Array(totalParts).fill(0) // Holds loaded bytes for each part
	const uploadedParts: { ETag: string; PartNumber: number }[] = []

	const uploadPromises: Promise<any>[] = [] // Array to hold promises for each chunk upload
	const startTime = Date.now() // Record start time
	const xhr = new XMLHttpRequest()

	for (let i = 0; i < totalParts; i++) {
		// Check for abort signal before starting new chunk upload
		if (abortController.signal.aborted) {
			console.log('Upload aborted before starting new chunk.')
			break // Exit loop if aborted
		}

		const partNumber = i + 1
		const start = i * CHUNK_SIZE
		const end = Math.min(start + CHUNK_SIZE, file.size)
		const chunk = file.slice(start, end)

		// Fetch pre-signed URL for this specific part
		let { url } = await api.getPresignedUrl(partNumber, uploadId, key, '')

		const uploadPromise = uploadChunk(url, chunk, xhr, (loadedForChunk) => {
			partProgress[i] = loadedForChunk // Update loaded bytes for this specific part

			const totalLoaded = partProgress.reduce(
				(acc, loaded) => acc + loaded,
				0
			)

			// NOTE: code was replace by parseProgress function

			// const totalPercentage = Math.round(
			// 	(totalLoaded * 100) / file.size
			// )

			const currentTime = Date.now()
			const elapsedTimeInSeconds = (currentTime - startTime) / 1000 // in seconds

			let speedValue = 0
			if (elapsedTimeInSeconds > 0) {
				speedValue = totalLoaded / elapsedTimeInSeconds // bytes per second
			}

			let timeLeftSeconds = 0
			if (totalLoaded > 0 && speedValue > 0) {
				const remainingBytes = file.size - totalLoaded
				timeLeftSeconds = remainingBytes / speedValue
			}

			// Convert speed to KB/s or MB/s
			// let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'
			// let formattedSpeed = speedValue / 1024 // KB/s
			// if (formattedSpeed > 1024) {
			// 	formattedSpeed /= 1024 // MB/s
			// 	speedUnit = 'MB/s'
			// }

			/**
			 * Note: code was replace by toTimeLeft function
			 *
			 * const hours = Math.floor(timeLeftSeconds / 3600)
			 * const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
			 * const seconds = Math.floor(timeLeftSeconds % 60)
			 */

			onTotalProgress({
				percentage: parseProgress(totalLoaded, file.size),
				timeLeft: toTimeLeft(timeLeftSeconds),
				speed: toUploadSpeed(totalLoaded, elapsedTimeInSeconds).speed,
				// Note: this code was replaced by toUploadSpeed

				// {
				// 	value: parseFloat(formattedSpeed.toFixed(2)),
				// 	unit: speedUnit,
				// },
			})
		})
			.then((result) => {
				if (result.etag) {
					// Remove quotes from ETag if present
					uploadedParts.push({
						ETag: result.etag.replace(/"/g, ''),
						PartNumber: partNumber,
					})
				}
			})
			.catch((error) => {
				// Re-throw if it's not an abort error, so the Promise.all catches it
				if (error.name !== 'AbortError') {
					throw error
				}
			})

		uploadPromises.push(uploadPromise)
	}

	// Wait for all parts to finish uploading, or for an abort
	try {
		await Promise.all(uploadPromises)
	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.log('Multipart upload aborted by AbortController.')
			// Do not re-throw, the actor will handle the 'aborted' state
		} else {
			throw error // Re-throw other errors
		}
	}

	// After all parts are uploaded (or aborted), notify the machine with the collected parts
	// Only call onPartsUploaded if not aborted
	if (!abortController.signal.aborted) {
		console.log('All the parts uploaded', uploadedParts.length)
		console.log('All parts uploaded for:', key)
		const {
			etag,
			bucket,
			key: fileKey,
			versionId,
		} = await api.completeMultipartUpload({
			parts: uploadedParts,
			key,
			uploadId,
		})
		console.log('Complete multipart upload - etag', etag)
		// Ensure 100% and final speed/time values are reported
		onPartsUploaded({ etag, key: fileKey, bucket, versionId })
		onTotalProgress({
			percentage: 100,
			timeLeft: { hours: 0, minutes: 0, seconds: 0 },
			speed: { value: 0, unit: 'KB/s' }, // Speed can be 0 or final average if needed
		})
	}
}

// ====================================================== //
// XState Actor Definition
// ====================================================== //

export interface MultipartUploadInput {
	file: File
	key: string
	uploadId: string
}

export interface MultipartUploadOutput {
	etag: string
	versionId: string
	key: string
	bucket: string
}

export const multipart = fromCallback<
	ExtractEvent<MediaFileEvents, 'abort'>,
	MultipartUploadInput
>(({ sendBack, receive, input }) => {
	const abortController = new AbortController()

	// 1. Create a multipart upload
	streamParts({
		...input,
		abortController,
		onDone: (parts) => {
			sendBack({ type: 'done', parts })
		},
		onProgress: (progress) => {
			sendBack({ type: 'progress', progress })
		},
	})

	// Listen for 'abort' event from the parent machine
	receive(({ type }) => {
		if (type === 'abort') {
			console.log('Multipart actor received abort signal.')
			abortController.abort() // Trigger abort on the controller
			sendBack({ type: 'aborted' }) // Notify fileMachine that actor is aborted
		}
	})
})
