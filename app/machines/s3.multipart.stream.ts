// This code would typically be in a file like 'upload.utils.ts' or 'actors.ts'
// alongside your other upload helper functions.

import type { CompletedPart } from '@aws-sdk/client-s3'
import type { UploadProgress } from './machine.types' // Assuming UploadProgress interface is defined

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB, consistent with previous examples

/**
 * Creates a ReadableStream from a File object, ensuring data is yielded in fixed-size chunks.
 * This is crucial for S3 multipart uploads which require specific chunk sizes.
 * @param file The File object to stream.
 * @param chunkSize The desired size of each chunk in bytes.
 * @returns A ReadableStream that yields Blob chunks.
 */
function createChunkedFileStream(
	file: File,
	chunkSize: number
): ReadableStream<Blob> {
	let offset = 0
	return new ReadableStream({
		async pull(controller) {
			if (offset < file.size) {
				const chunk = file.slice(offset, offset + chunkSize)
				controller.enqueue(chunk)
				offset += chunk.size
			} else {
				controller.close()
			}
		},
		cancel(reason) {
			console.log('Chunked file stream cancelled:', reason)
		},
	})
}

/**
 * A TransformStream that reports progress as data chunks pass through it.
 * This allows for progress tracking when piping streams, especially useful
 * before sending data via `fetch` which doesn't expose upload progress directly.
 */
class ProgressReportingTransformStream extends TransformStream<Blob, Blob> {
	private totalBytesProcessed: number = 0
	private totalFileSize: number
	private startTime: number
	private onProgress: (progress: UploadProgress) => void

	constructor(
		totalFileSize: number,
		startTime: number,
		onProgress: (progress: UploadProgress) => void
	) {
		super({
			transform: (chunk, controller) => {
				this.totalBytesProcessed += chunk.size

				// Calculate total progress across all parts
				const totalPercentage = Math.round(
					(this.totalBytesProcessed * 100) / this.totalFileSize
				)

				// Calculate speed and time left
				const currentTime = Date.now()
				const elapsedTimeInSeconds =
					(currentTime - this.startTime) / 1000

				let speedValue = 0 // Bytes per second
				if (elapsedTimeInSeconds > 0) {
					speedValue = this.totalBytesProcessed / elapsedTimeInSeconds
				}

				let timeLeftSeconds = 0
				if (this.totalBytesProcessed > 0 && speedValue > 0) {
					const remainingBytes =
						this.totalFileSize - this.totalBytesProcessed
					timeLeftSeconds = remainingBytes / speedValue
				}

				// Format speed (KB/s or MB/s)
				let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'
				let formattedSpeed = speedValue / 1024 // Convert to KB/s
				if (formattedSpeed > 1024) {
					formattedSpeed /= 1024 // Convert to MB/s
					speedUnit = 'MB/s'
				}

				// Format time left (hours, minutes, seconds)
				const hours = Math.floor(timeLeftSeconds / 3600)
				const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
				const seconds = Math.floor(timeLeftSeconds % 60)

				// Report the detailed progress to the callback
				this.onProgress({
					percentage: totalPercentage,
					timeLeft: { hours, minutes, seconds },
					speed: {
						value: parseFloat(formattedSpeed.toFixed(2)),
						unit: speedUnit,
					},
				})

				controller.enqueue(chunk) // Pass the chunk along to the next stage
			},
			flush: (controller) => {
				// This method is called when the writable side is closed.
				// Ensure final 100% progress is reported
				this.onProgress({
					percentage: 100,
					timeLeft: { hours: 0, minutes: 0, seconds: 0 },
					speed: { value: 0, unit: 'KB/s' }, // Or a final average speed if desired
				})
				console.log('ProgressReportingTransformStream flushed.')
			},
		})
		this.totalFileSize = totalFileSize
		this.startTime = startTime
		this.onProgress = onProgress
	}
}

export interface StreamPartsInput {
	key: string
	file: File
	uploadId: string
	onProgress: (progress: UploadProgress) => void
	onDone: (parts: CompletedPart[]) => void
	abortController: AbortController
}

/**
 * Orchestrates a multipart file upload to S3 using Web Streams API for flow control,
 * and fetch for sending chunks, with a TransformStream for progress reporting.
 *
 * @param file The File object to upload.
 * @param uploadId The multipart upload ID obtained from the backend.
 * @param key The S3 object key for the file.
 * @param onProgress Callback to report overall upload progress (percentage, speed, time left).
 * @param onDone Callback to report the list of uploaded parts (ETags and PartNumbers).
 * @param abortController An AbortController to signal and handle upload cancellation.
 * @returns A Promise that resolves when the entire file has been uploaded (all parts).
 */
export async function streamParts({
	file,
	uploadId,
	key,
	onProgress: onTotalProgress,
	onDone: onPartsUploaded,
	abortController,
}: StreamPartsInput): Promise<void> {
	let partNumber = 0 // Tracks the current part number being uploaded
	const uploadedParts: CompletedPart[] = [] // Stores ETags and PartNumbers
	const startTime = Date.now() // Records the start time of the entire upload process

	// Create a custom WritableStream that will consume the chunks from the TransformStream
	// and handle their individual upload via fetch.
	const uploadWritableStream = new WritableStream({
		async write(chunk: Blob) {
			// This method is called for each chunk received from the ProgressReportingTransformStream.
			partNumber++
			const currentPartNumber = partNumber // Capture the current part number for this chunk

			// Check if the upload has been aborted before processing this chunk
			if (abortController.signal.aborted) {
				throw new DOMException('Upload aborted', 'AbortError')
			}

			const { url: presignedUrl } = await fetch('/api/s3/upload', {
				method: 'POST',
				body: JSON.stringify({
					key,
					uploadId,
					partNumber: currentPartNumber,
					action: 'get-presigned-url',
				}),
				headers: { 'Content-Type': 'application/json' },
				signal: abortController.signal, // Pass abort signal to fetch
			}).then((res) => {
				if (!res.ok) {
					throw new Error(
						`Failed to get pre-signed URL for part ${currentPartNumber}: ${res.statusText}`
					)
				}
				return res.json()
			})

			// 2. Use fetch to PUT the chunk data to the pre-signed URL.
			// The chunk is directly used as the body of the fetch request.
			const response = await fetch(presignedUrl, {
				method: 'PUT',
				body: chunk, // The Blob chunk is the request body
				signal: abortController.signal, // Pass abort signal to fetch
			})

			if (!response.ok) {
				throw new Error(
					`Chunk upload failed with status: ${response.status} - ${response.statusText}`
				)
			}

			const etag = response.headers.get('ETag')
			if (etag) {
				// Collect ETag and PartNumber for the final completeMultipartUpload call
				uploadedParts.push({
					ETag: etag.replace(/"/g, ''),
					PartNumber: currentPartNumber,
				})
			}
		},
		close() {
			// This method is called when the ReadableStream feeding into this WritableStream closes.
			console.log(
				'Upload WritableStream closed: All chunks processed and sent.'
			)
			// Report all collected parts to the parent
			onPartsUploaded(uploadedParts)
		},
		abort(reason) {
			// This method is called if the WritableStream itself is aborted.
			console.log('Upload WritableStream aborted:', reason)
			abortController.abort(reason) // Ensure the main abort controller is also signaled
		},
	})

	// Pipe the chunked file stream through the progress reporting TransformStream,
	// and then to our custom uploadWritableStream.
	try {
		await createChunkedFileStream(file, CHUNK_SIZE)
			.pipeThrough(
				new ProgressReportingTransformStream(
					file.size,
					startTime,
					onTotalProgress
				),
				{ signal: abortController.signal }
			)
			.pipeTo(uploadWritableStream, { signal: abortController.signal })
		console.log('File stream piping completed successfully.')
	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.log('File stream piping aborted by AbortController.')
			// Do not re-throw, as this is an intentional abort.
		} else {
			console.error('Error during file stream piping:', error)
			throw error // Re-throw other unexpected errors.
		}
	}
}
