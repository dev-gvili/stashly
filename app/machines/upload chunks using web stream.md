// This code would typically be in a file like 'upload.utils.ts' or 'actors.ts'
// alongside your other upload helper functions.
```ts
import type { UploadProgress } from './types'; // Assuming UploadProgress interface is defined

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB, consistent with previous examples

/**
 * Creates a ReadableStream from a File object, ensuring data is yielded in fixed-size chunks.
 * This is crucial for S3 multipart uploads which require specific chunk sizes.
 * @param file The File object to stream.
 * @param chunkSize The desired size of each chunk in bytes.
 * @returns A ReadableStream that yields Blob chunks.
 */
function createChunkedFileStream(file: File, chunkSize: number): ReadableStream<Blob> {
    let offset = 0;
    return new ReadableStream({
        async pull(controller) {
            if (offset < file.size) {
                // Slice the file to get the next chunk as a Blob
                const chunk = file.slice(offset, offset + chunkSize);
                controller.enqueue(chunk); // Enqueue the chunk to the stream
                offset += chunk.size; // Move the offset forward
            } else {
                controller.close(); // All data has been read, close the stream
            }
        },
        cancel(reason) {
            console.log('Chunked file stream cancelled:', reason);
            // Any cleanup if necessary when the stream is cancelled
        }
    });
}

/**
 * Orchestrates a multipart file upload to S3 using Web Streams API for flow control,
 * and XMLHttpRequest for per-chunk upload and progress reporting.
 *
 * @param file The File object to upload.
 * @param uploadId The multipart upload ID obtained from the backend.
 * @param key The S3 object key for the file.
 * @param onTotalProgress Callback to report overall upload progress (percentage, speed, time left).
 * @param onPartsUploaded Callback to report the list of uploaded parts (ETags and PartNumbers).
 * @param abortController An AbortController to signal and handle upload cancellation.
 * @returns A Promise that resolves when the entire file has been uploaded (all parts).
 */
export async function uploadFileInPartsStream(
    file: File,
    uploadId: string,
    key: string,
    onTotalProgress: (progress: UploadProgress) => void,
    onPartsUploaded: (parts: { ETag: string; PartNumber: number }[]) => void,
    abortController: AbortController
): Promise<void> {
    let partNumber = 0; // Tracks the current part number being uploaded
    const uploadedParts: { ETag: string; PartNumber: number }[] = []; // Stores ETags and PartNumbers
    const partProgress: number[] = []; // Stores loaded bytes for each individual part
    const startTime = Date.now(); // Records the start time of the entire upload process

    // Create a custom WritableStream that will consume the chunks from the ReadableStream
    // and handle their individual upload via XMLHttpRequest.
    const uploadWritableStream = new WritableStream({
        start() {
            // This method is called when the WritableStream is first created.
            // No specific setup needed here for this implementation.
        },
        async write(chunk: Blob) {
            // This method is called for each chunk received from the ReadableStream.
            partNumber++;
            const currentPartNumber = partNumber; // Capture the current part number for this chunk
            partProgress[currentPartNumber - 1] = 0; // Initialize loaded bytes for this part to 0

            // Check if the upload has been aborted before processing this chunk
            if (abortController.signal.aborted) {
                throw new DOMException('Upload aborted', 'AbortError');
            }

            // 1. Request a pre-signed URL for this specific part from the backend.
            // This fetch call also respects the abort signal.
            const { presignedUrl } = await fetch('/api/get-upload-url', {
                method: 'POST',
                body: JSON.stringify({ key, uploadId, partNumber: currentPartNumber }),
                headers: { 'Content-Type': 'application/json' },
                signal: abortController.signal, // Pass abort signal to fetch
            }).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to get pre-signed URL for part ${currentPartNumber}: ${res.statusText}`);
                }
                return res.json();
            });

            // 2. Use XMLHttpRequest to PUT the chunk data to the pre-signed URL.
            // XHR is used here specifically for its reliable upload progress events.
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presignedUrl, true);
                // Set the Content-Type header for the chunk
                xhr.setRequestHeader('Content-Type', file.type); // Or chunk.type if more specific

                // Attach the abort signal to XHR
                abortController.signal.addEventListener('abort', () => {
                    xhr.abort();
                });

                // XHR upload progress event listener
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        partProgress[currentPartNumber - 1] = event.loaded; // Update loaded bytes for this part

                        // Calculate total progress across all parts
                        const totalLoaded = partProgress.reduce((acc, loaded) => acc + loaded, 0);
                        const totalPercentage = Math.round((totalLoaded * 100) / file.size);

                        // Calculate speed and time left
                        const currentTime = Date.now();
                        const elapsedTimeInSeconds = (currentTime - startTime) / 1000;

                        let speedValue = 0; // Bytes per second
                        if (elapsedTimeInSeconds > 0) {
                            speedValue = totalLoaded / elapsedTimeInSeconds;
                        }

                        let timeLeftSeconds = 0;
                        if (totalLoaded > 0 && speedValue > 0) {
                            const remainingBytes = file.size - totalLoaded;
                            timeLeftSeconds = remainingBytes / speedValue;
                        }

                        // Format speed (KB/s or MB/s)
                        let speedUnit: 'KB/s' | 'MB/s' = 'KB/s';
                        let formattedSpeed = speedValue / 1024; // Convert to KB/s
                        if (formattedSpeed > 1024) {
                            formattedSpeed /= 1024; // Convert to MB/s
                            speedUnit = 'MB/s';
                        }

                        // Format time left (hours, minutes, seconds)
                        const hours = Math.floor(timeLeftSeconds / 3600);
                        const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
                        const seconds = Math.floor(timeLeftSeconds % 60);

                        // Report the detailed progress to the callback
                        onTotalProgress({
                            percentage: totalPercentage,
                            timeLeft: { hours, minutes, seconds },
                            speed: { value: parseFloat(formattedSpeed.toFixed(2)), unit: speedUnit },
                        });
                    }
                };

                // XHR load (success) event
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const etag = xhr.getResponseHeader('ETag');
                        if (etag) {
                            // Collect ETag and PartNumber for the final completeMultipartUpload call
                            uploadedParts.push({ ETag: etag.replace(/"/g, ''), PartNumber: currentPartNumber });
                        }
                        resolve(); // Resolve the promise for this chunk
                    } else {
                        // Reject on HTTP error status
                        reject(new Error(`Chunk upload failed with status: ${xhr.status} - ${xhr.statusText}`));
                    }
                };

                // XHR error event (network errors, etc.)
                xhr.onerror = () => reject(new Error('Network error during chunk upload.'));

                // XHR abort event
                xhr.onabort = () => reject(new DOMException('Chunk upload aborted.', 'AbortError'));

                // Send the chunk data
                xhr.send(chunk);
            });
        },
        close() {
            // This method is called when the ReadableStream feeding into this WritableStream closes,
            // indicating all chunks have been written.
            console.log('WritableStream closed: All chunks processed.');
            // Report all collected parts to the parent
            onPartsUploaded(uploadedParts);
            // Ensure final 100% progress is reported
            onTotalProgress({
                percentage: 100,
                timeLeft: { hours: 0, minutes: 0, seconds: 0 },
                speed: { value: 0, unit: 'KB/s' },
            });
        },
        abort(reason) {
            // This method is called if the WritableStream itself is aborted.
            console.log('WritableStream aborted:', reason);
            // Signal the main abort controller to ensure all related operations stop
            abortController.abort(reason);
        }
    });

    // Pipe the chunked file stream to our custom uploadWritableStream.
    // The `pipeTo` method handles the flow control (backpressure) automatically.
    try {
        await createChunkedFileStream(file, CHUNK_SIZE).pipeTo(uploadWritableStream, { signal: abortController.signal });
        console.log('File stream piping completed successfully.');
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('File stream piping aborted by AbortController.');
            // Do not re-throw, as this is an intentional abort.
        } else {
            console.error('Error during file stream piping:', error);
            throw error; // Re-throw other unexpected errors.
        }
    }
}
```