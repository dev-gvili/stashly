// actors.ts (or wherever you define your uploader functions)

// This interface should match your provided UploadProgress
export interface UploadProgress {
	percentage: number
	timeLeft: {
		hours: number
		minutes: number
		seconds: number
	}
	speed: {
		value: number
		unit: 'KB/s' | 'MB/s'
	}
}

// A function that wraps XHR in a Promise to upload one chunk
// This function will now report its individual chunk's progress (loaded bytes)
function uploadChunk(
	url: string,
	chunk: Blob,
	onProgress: (event: ProgressEvent) => void // Callback for individual chunk progress
): Promise<{ etag: string | null }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest()
		xhr.open('PUT', url, true)
		xhr.setRequestHeader('Content-Type', 'application/octet-stream') // Generic content type for binary data

		// This is the key for progress tracking for this specific chunk
		xhr.upload.onprogress = onProgress

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const etag = xhr.getResponseHeader('ETag')
				resolve({ etag })
			} else {
				reject(
					new Error(
						`Upload failed with status: ${xhr.status} - ${xhr.statusText}`
					)
				)
			}
		}

		xhr.onerror = () =>
			reject(new Error('Network error during chunk upload.'))
		xhr.onabort = () => reject(new Error('Chunk upload aborted.'))

		xhr.send(chunk)
	})
}

// The main orchestration function, now with detailed progress reporting
export async function uploadFileInParts(
	file: File,
	uploadId: string,
	key: string,
	// Callback to send the full UploadProgress object to your XState machine
	onTotalProgress: (progress: UploadProgress) => void,
	// Callback to send the collected parts for the completion step
	onPartsUploaded: (parts: { ETag: string; PartNumber: number }[]) => void
): Promise<void> {
	const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
	const totalParts = Math.ceil(file.size / CHUNK_SIZE)

	// --- Progress Tracking Variables ---
	const startTime = Date.now() // When the overall upload started
	const partProgress: number[] = Array(totalParts).fill(0) // Holds loaded bytes for each part
	let lastReportedTotalLoaded = 0 // To calculate instantaneous speed
	let lastReportTime = startTime // To calculate instantaneous speed

	const uploadedParts: { ETag: string; PartNumber: number }[] = []
	const uploadPromises: Promise<any>[] = []

	// Helper function to calculate and report total progress
	const reportProgress = () => {
		const currentTime = Date.now()
		const totalLoaded = partProgress.reduce(
			(acc, loaded) => acc + loaded,
			0
		)
		const percentage = Math.round((totalLoaded * 100) / file.size)

		// Calculate speed (using average speed over the entire upload for stability)
		const elapsedTimeSeconds = (currentTime - startTime) / 1000 // in seconds
		let speedValue = 0
		let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'

		if (elapsedTimeSeconds > 0) {
			const bytesPerSecond = totalLoaded / elapsedTimeSeconds
			if (bytesPerSecond >= 1024 * 1024) {
				speedValue = bytesPerSecond / (1024 * 1024) // MB/s
				speedUnit = 'MB/s'
			} else {
				speedValue = bytesPerSecond / 1024 // KB/s
				speedUnit = 'KB/s'
			}
		}

		// Calculate time left
		let timeLeftSeconds = 0
		const remainingBytes = file.size - totalLoaded
		if (speedValue > 0) {
			// Avoid division by zero
			// Convert speed back to bytes/second for calculation
			const currentSpeedBytesPerSecond =
				speedUnit === 'MB/s'
					? speedValue * 1024 * 1024
					: speedValue * 1024
			timeLeftSeconds = remainingBytes / currentSpeedBytesPerSecond
		}

		const hours = Math.floor(timeLeftSeconds / 3600)
		const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
		const seconds = Math.floor(timeLeftSeconds % 60)

		onTotalProgress({
			percentage,
			timeLeft: { hours, minutes, seconds },
			speed: {
				value: parseFloat(speedValue.toFixed(2)),
				unit: speedUnit,
			},
		})

		// Update for next instantaneous speed calculation (if needed, currently using average)
		lastReportedTotalLoaded = totalLoaded
		lastReportTime = currentTime
	}

	for (let i = 0; i < totalParts; i++) {
		const partNumber = i + 1
		const start = i * CHUNK_SIZE
		const end = Math.min(start + CHUNK_SIZE, file.size) // Ensure end doesn't exceed file size
		const chunk = file.slice(start, end)

		// Request pre-signed URL for the current chunk from your backend
		const { presignedUrl } = await fetch('/api/get-upload-url', {
			method: 'POST',
			body: JSON.stringify({ key, uploadId, partNumber }),
			headers: { 'Content-Type': 'application/json' },
		}).then((res) => res.json())

		// Upload the chunk using XHR
		const uploadPromise = uploadChunk(presignedUrl, chunk, (event) => {
			// Update the progress for this specific part
			partProgress[i] = event.loaded
			reportProgress() // Recalculate and report total progress on each chunk's progress event
		}).then((result) => {
			if (result.etag) {
				uploadedParts.push({
					ETag: result.etag.replaceAll('"', ''),
					PartNumber: partNumber,
				})
			}
		})

		uploadPromises.push(uploadPromise)
	}

	// Wait for all chunks to finish uploading
	await Promise.all(uploadPromises)

	// After all parts are uploaded, notify the machine with the collected parts
	// This is crucial for the 'completingUpload' state in file.machine.ts
	onPartsUploaded(uploadedParts)

	console.log('All parts uploaded for:', key)
	// Ensure final progress is 100% and time left/speed are 0
	onTotalProgress({
		percentage: 100,
		timeLeft: { hours: 0, minutes: 0, seconds: 0 },
		speed: { value: 0, unit: 'KB/s' },
	})
}
