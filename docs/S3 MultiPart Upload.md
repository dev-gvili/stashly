# S3 Multipart Upload

This document outlines the architecture and implementation of the S3 multipart upload feature, detailing the state machine, actors, utilities, UI components, and the backend API endpoint that work together to provide a robust and resumable file upload experience.

### Machine

The core logic for the multipart upload process is managed by an XState machine defined in `s3.multipart.ts`. This machine orchestrates the entire flow, from initiating the upload to handling individual parts and finalizing or aborting the process.

```typescript
import { assertEvent, assign, setup } from 'xstate'
import {
  uploadParts,
  createUpload,
  presignedPartUrl,
  abortUpload,
  completeUpload,
} from '@/machines/s3.mulipart.utils'
import type {
  MultipartContext,
  MultipartEvents,
  MultipartInput,
  MultipartOutput,
} from './machine.types'

export const multipart = setup({
  types: {
    input: {} as MultipartInput,
    output: {} as MultipartOutput,
    context: {} as MultipartContext,
    events: {} as MultipartEvents,
  },
  actions: {
    assignUploadId: (_, params: { uploadId: string }) => ({
      uploadId: params.uploadId,
    }),
    assignProgress: assign({
      uploadProgress: ({ event }) => {
        assertEvent(event, '@multipart.upload.progress.change')
        return event.progress
      },
    }),
    assignUploadedParts: assign({
      uploadedParts: ({ event }) => {
        assertEvent(event, '@multipart.upload.done')
        return event.parts
      },
    }),
    assignError: assign({
      error: ({ event }) => {
        assertEvent(event, '@multipart.upload.error')
        return event.error
      },
    }),
  },
  actors: {
    createUpload,
    presignedPartUrl,
    abortUpload,
    completeUpload,
    uploadParts,
  },
}).createMachine({
  id: 'multipart',
  description:
    'This machine orchestrates the multipart upload process to S3. It handles the creation of the multipart upload, the uploading of individual parts, and the final completion or abortion of the upload.',
  context: ({ input }) => ({
    error: '',
    uploadId: '',
    file: input.file,
    uploadedParts: [],
    key: input.file.name,
    uploadProgress: {
      percentage: 0,
      speed: { unit: 'KB/s', value: 0 },
      timeLeft: { hours: 0, minutes: 0, seconds: 0 },
    },
    uploadCompleteData: {
      etag: '',
      version: '',
    },
  }),
  on: { '@multipart.upload.abort': 'abort' },
  initial: 'create',
  states: {
    create: {
      invoke: {
        id: '@multipart.create',
        src: 'createUpload',
        input: ({ context }) => ({
          key: context.key,
        }),
        onDone: {
          target: 'upload',
          actions: {
            type: 'assignUploadId',
            params: ({ event }) => event.output,
          },
        },
        onError: {
          target: 'abort',
        },
      },
      description:
        'Invokes a service to create a multipart upload, obtaining a unique uploadId from the S3 API. This uploadId is essential for subsequent upload parts and for completing or aborting the multipart upload.',
    },
    upload: {
      invoke: {
        id: '@multipart.upload',
        src: 'uploadParts',
        input: ({ context }) => ({
          file: context.file,
          key: context.key,
          uploadId: context.uploadId,
        }),
      },
      on: {
        '@multipart.upload.done': {
          target: 'complete',
          actions: { type: 'assignUploadedParts' },
        },
        '@multipart.upload.error': {
          target: 'cancelled',
          actions: { type: 'assignError' },
        },
        '@multipart.upload.progress.change': {
          actions: { type: 'assignProgress' },
        },
      },
      description:
        'In this state, the file is divided into multiple parts, each of which is pre-signed and uploaded. All successfully uploaded parts are collected into an array, which will be used in the `complete` state to finalize the multipart upload.',
    },
    abort: {
      invoke: {
        id: '@multipart.abort',
        src: 'abortUpload',
        input: ({ context }) => ({
          key: context.key,
          uploadId: context.uploadId,
        }),
        onDone: {
          target: 'cancelled',
        },
        onError: {
          target: 'cancelled',
          actions: 'assignError',
        },
      },
      description:
        'This state is entered if the multipart upload process needs to be stopped prematurely, either due to an error or a user-initiated cancellation. It sends a request to S3 to abort the multipart upload, which cleans up any uploaded parts and prevents incomplete files from being stored. This ensures that no partial or corrupted data remains on S3.',
    },
    complete: {
      invoke: {
        id: '@multipart.complete',
        src: 'completeUpload',
        input: ({ context }) => ({
          key: context.key,
          parts: context.uploadedParts,
          uploadId: context.uploadId,
        }),
        onDone: {
          target: 'done',
        },
        onError: {
          target: 'abort',
        },
      },
      description:
        'After all parts of the file have been successfully uploaded, this state finalizes the multipart upload. It sends a request to S3 with the `uploadId` and the list of all uploaded parts (including their ETags and part numbers). S3 then reassembles these parts into the complete file. This state is critical for ensuring data integrity and for making the uploaded file accessible.',
    },
    cancelled: {
      type: 'final',
      description:
        'This state indicates that the multipart upload process has been cancelled, either due to a failure or user action. This state is a final state',
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        ...context.uploadCompleteData,
      }),
      description:
        'This state indicates that the multipart upload has been successfully completed and the file is now accessible in S3. This state is a final state',
    },
  },
})
```

### Actors

Actors are responsible for executing side effects, such as communicating with the backend API. The `s3.mulipart.utils.ts` file defines actors for creating the upload, fetching pre-signed URLs, and completing or aborting the transaction.

```typescript
import { fromCallback, fromPromise, type ExtractEvent } from 'xstate'
import type {
  AbortMultipartUploadInput,
  AbortMultipartUploadOutput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadOutput,
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
  GetPresignedUrlForPartInput,
  GetPresignedUrlForPartOutput,
} from '@/.server/upload'
import type { MultipartEvents } from './machine.types'
import { streamParts } from './s3.multipart.stream'

const FetchInit: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}

/**
 * Initiates a multipart upload on S3.
 * @param params - The input parameters for creating a multipart upload.
 * @returns A promise that resolves to the output of the create multipart upload operation, including the upload ID.
 */
export async function createMultipartUpload(
  params: CreateMultipartUploadInput
): Promise<CreateMultipartUploadOutput> {
  const res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'create-multipart-upload',
    }),
  })
  return await res.json()
}

/**
 * Retrieves a presigned URL for a specific part of a multipart upload.
 * @param params - The input parameters for getting a presigned URL for a part.
 * @returns A promise that resolves to the output of the get presigned URL for part operation, including the URL.
 */
export async function getPresignedUrlForPart(
  params: GetPresignedUrlForPartInput
): Promise<GetPresignedUrlForPartOutput> {
  const res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'get-presigned-url',
    }),
  })
  return await res.json()
}

/**
 * Completes a multipart upload on S3.
 * @param params - The input parameters for completing the multipart upload.
 * @returns A promise that resolves to the output of the complete multipart upload operation,
 *   including the key, bucket, ETag, and version ID of the completed object.
 */
export async function completeMultipartUpload(
  params: CompleteMultipartUploadInput
): Promise<CompleteMultipartUploadOutput> {
  let res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'complete-multipart-upload',
    }),
  })
  return await res.json()
}

/**
 * Aborts a multipart upload on S3.
 * @param params - The input parameters for aborting the multipart upload.
 * @returns A promise that resolves to the output of the abort multipart upload operation.
 */
export async function abortMultipartUpload(
  params: AbortMultipartUploadInput
): Promise<AbortMultipartUploadOutput> {
  let res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'abort-multipart-upload',
    }),
  })
  return await res.json()
}

export interface UploadPartsInput {
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

/**
 * XState actor that orchestrates the streaming and uploading of file parts to S3.
 * It uses `streamParts` to handle the chunking, presigning, and uploading,
 * and reports progress and completion back to the parent machine.
 */
export const uploadParts = fromCallback<
  ExtractEvent<MultipartEvents, '@multipart.upload.abort'>,
  UploadPartsInput
>(({ sendBack, receive, input }) => {
  const abortController = new AbortController()

  // Stream the parts to s3 storage, every part is presigned and uploaded.
  streamParts({
    ...input,
    abortController,
    onDone: (parts) => {
      sendBack({ type: '@multipart.upload.done', parts })
    },
    onProgress: (progress) => {
      sendBack({ type: '@multipart.upload.progress.change', progress })
    },
  })

  receive(({ type }) => {
    if (type === '@multipart.upload.abort') {
      // TODO: replace with proper logging
      console.error('Multipart upload aborted')
      abortController.abort() // Trigger abort on the controller
      sendBack({ type: '@multipart.upload.aborted' }) // Notify fileMachine that actor is aborted
    }
  })
})

/**
 * XState actor that creates a multipart upload on S3.
 * It uses `createMultipartUpload` to initiate the upload and returns the upload ID.
 */
export const createUpload = fromPromise<
  CreateMultipartUploadOutput,
  CreateMultipartUploadInput
>(async ({ input }) => await createMultipartUpload(input))

/**
 * XState actor that gets a presigned URL for a specific part of a multipart upload.
 * It uses `getPresignedUrlForPart` to obtain the URL.
 */
export const presignedPartUrl = fromPromise<
  GetPresignedUrlForPartOutput,
  GetPresignedUrlForPartInput
>(async ({ input }) => await getPresignedUrlForPart(input))

/**
 * XState actor that aborts a multipart upload on S3.
 * It uses `abortMultipartUpload` to cancel the upload.
 */
export const abortUpload = fromPromise<
  AbortMultipartUploadOutput,
  AbortMultipartUploadInput
>(async ({ input }) => await abortMultipartUpload(input))

/**
 * XState actor that completes a multipart upload on S3.
 * It uses `completeMultipartUpload` to finalize the upload.
 */
export const completeUpload = fromPromise<
  CompleteMultipartUploadOutput,
  CompleteMultipartUploadInput
>(async ({ input }) => await completeMultipartUpload(input))
```

### Utils

The `s3.multipart.stream.ts` file contains the low-level logic for handling file streaming. It uses the Web Streams API to create a chunked file stream, report progress, and pipe the data to the upload handler.

```typescript
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
        const elapsedTimeInSeconds = (currentTime - this.startTime) / 1000

        let speedValue = 0 // Bytes per second
        if (elapsedTimeInSeconds > 0) {
          speedValue = this.totalBytesProcessed / elapsedTimeInSeconds
        }

        let timeLeftSeconds = 0
        if (this.totalBytesProcessed > 0 && speedValue > 0) {
          const remainingBytes = this.totalFileSize - this.totalBytesProcessed
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
```

### Components

The user interface for the file upload functionality is built with React. The `file-upload.tsx` component provides the drop zone, file list, and progress indicators, all connected to the XState `uploadManagerActor`.

```tsx
// ====================================================== //
// Actor                                                  //
// ====================================================== //
const { inspect } = createBrowserInspector()
export const uploadManagerActor = createActor(uploadMachine, {
  systemId: 'uploadManager',
  id: 'uploadManager',
  inspect: (inspEv) => {
    console.log(inspEv)
    inspect.next(inspEv)
  },
})
uploadManagerActor.start()

// ====================================================== //
// Hooks                                                  //
// ====================================================== //
export const useUploadMediaFiles = () => {
  let mediaFiles = useSelector(
    uploadManagerActor,
    (state) => state.context.mediaFiles
  )
  if (mediaFiles && mediaFiles.size > 0) {
    return Array.from(mediaFiles.values())
  }
  return []
}

// export const useUploadConfig = () => {
// 	let config = useSelector(
// 		uploadManagerActor,
// 		(state) => state.context.config
// 	)
// 	const setConfig = (config: Config) =>
// 		uploadManagerActor.send({ type: 'upload.config', {...config, user} })
// 	return { config, setConfig }
// }

// ====================================================== //
// Styles                                                 //
// ====================================================== //
const Styles = {
  FileExtention:
    'font-bold text-[0.55rem] dark:text-black dark:bg-white/40 bg-black text-white w-full max-w-max  flex items-center justify-center uppercase h-4 py-1 px-2 rounded-md group-data-[state=aborted]:dark:opacity-20',
  DropArea:
    'group z-50 min-w-96 w-full h-32 border-dashed border bg-inherit shadow-none rounded-lg p-4 grid place-items-center',
  Trigger:
    'max-w-max rounded-md bg-inherit px-2 py-1.5 font-mono text-xs  focus:outline-background hover:cursor-pointer border border-border/10',
  FileList: 'w-full max-w-md h-full space-y-3 p-1',
  Item: 'relative overflow-hidden grid grid-cols-8 w-full rounded-lg bg-card/5 p-1 list-none border-border border h-auto place-content-between place-items-center gap-2 group',
  ItemBody: 'col-span-6 w-full',
  ItemContent: 'flex w-full justify-between',
  Progress:
    'group/progress group-data-[state=aborted]:opacity-40 group-data-[state=uploading]:hover:cursor-default',
  FileIcon:
    'flex appearance-none items-center justify-center bg-transparent w-8 h-8 group-data-[state=aborted]:opacity-40',
  FileName:
    'overflow-hidden text-ellipsis text-nowrap text-start font-mono text-xs font-bold text-foreground group-data-[state=aborted]:opacity-20',
  Total:
    'w-56 overflow-hidden text-ellipsis text-nowrap text-start font-mono text-xs font-bold dark:text-white group-data-[state=aborted]:dark:opacity-20',
  CountDown:
    'text-start font-mono text-xs group-data-[state=aborted]:hidden text-nowrap',
  StatusText: (status: MediaFileStatus) =>
    `text-start font-mono text-xs hidden group-data-[state=aborted]:dark:opacity-10 group-data-[state=${status}]:block text-nowrap capitalize`,
  Description:
    'font-mono text-xs text-muted-foreground group-data-[state=aborted]:opacity-20',
  Cancel:
    'appearance-none bg-transparent disabled:cursor-default hidden group-data-[state=uploading]:group-hover/progress:block',
} as const

// ====================================================== //
// Helpers                                                //
// ====================================================== //
const formatCountdown = (value: any) => {
  let parsedProgress = uploadProgress.parse(value)
  let parsedtimeLeft = parsedProgress.timeLeft
  let countdownString = ''
  if (parsedtimeLeft.hours > 0) countdownString += `${parsedtimeLeft.hours} hr`
  if (parsedtimeLeft.minutes > 0)
    countdownString += `${parsedtimeLeft.minutes} min`
  if (parsedtimeLeft.seconds > 0 && parsedtimeLeft.minutes === 0)
    countdownString += `last then a min`
  if (countdownString) countdownString += ' left...'
  return `${countdownString}`
}

// ====================================================== //
// Components                                             //
// ====================================================== //
export const MediaUploadRoot = ({
  children,
  bucketName,
  ownerId,
  user,
}: {
  children: React.ReactNode
  bucketName: string
  ownerId: string
  user: User
}) => {
  React.useEffect(() => {
    uploadManagerActor.send({
      type: 'upload.config',
      bucketName,
      ownerId,
      user,
    })
    return () => {
      uploadManagerActor.send({ type: 'upload.config.reset' })
    }
  }, [])
  return children
}
MediaUploadRoot.displayName = 'MediaUploadRoot'

export const DropArea = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(
  (
    {
      id: propId,
      children,
      className,
      onDrop,
      onDragOver,
      onDragLeave,
      onDragEnter,
      ...props
    },
    forwardRef
  ) => {
    const id = propId || React.useId()
    const styles =
      'group z-50 min-w-96 w-full h-32 border-dashed dark:border dark:border-white/10 dark:bg-inherit dark:shadow-none rounded-lg p-4 grid place-items-center dark:border-dashed'
    const _onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      onDragOver?.(event)
    }

    const _onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget) {
        event.currentTarget.setAttribute('data-drop-target', 'true')
      }
      onDragEnter?.(event)
    }

    const _onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget) {
        event.currentTarget.setAttribute('data-drop-target', 'false')
      }
      onDragLeave?.(event)
    }

    const _onDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget) {
        event.currentTarget.setAttribute('data-drop-target', 'false')
      }
      const { files } = event.dataTransfer
      if (files && files.length > 0) {
        uploadManagerActor.send({
          type: 'upload.add',
          files: Array.from(files),
        })
      }
      onDrop?.(event)
    }

    return (
      <div
        id={id}
        ref={forwardRef}
        onDrop={_onDrop}
        onDragOver={_onDragOver}
        onDragEnter={_onDragEnter}
        onDragLeave={_onDragLeave}
        className={cn(Styles.DropArea, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DropArea.displayName = 'DropArea'

interface TriggerProps extends Omit<LabelPrimitive.LabelProps, 'onChange'> {
  name?: string
  webkitdirectory?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined
}

export const Trigger = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  TriggerProps
>(
  (
    {
      children,
      id: propId,
      className,
      webkitdirectory,
      name = 'files',
      onChange,
      ...props
    },
    forwardRef
  ) => {
    const id = propId || React.useId()
    const _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (files && files.length > 0) {
        uploadManagerActor.send({
          type: 'upload.add',
          files: Array.from(files),
        })
      }
      onChange?.(event)
    }
    return (
      <LabelPrimitive.Root
        ref={forwardRef}
        htmlFor={id}
        className={cn(Styles.Trigger, className)}
        {...props}
      >
        {children}
        <input
          ref={forwardRef}
          id={id}
          type="file"
          name={name}
          multiple
          webkitdirectory={webkitdirectory}
          className="sr-only"
          onChange={_onChange}
        />
      </LabelPrimitive.Root>
    )
  }
)
Trigger.displayName = 'Trigger'

export const FileList = React.forwardRef<
  React.ComponentRef<'ul'>,
  React.ComponentPropsWithoutRef<'ul'>
>(({ children, className, id: propId, ...props }, forwardRef) => {
  const id = propId || React.useId()
  let [parent] = useAutoAnimate<HTMLUListElement>()
  let refs = useComposedRefs(forwardRef, parent)
  const files = useSelector(
    uploadManagerActor,
    (state) => Array.from(state.context?.mediaFiles?.values()).reverse(),
    shallowEqual
  )
  return (
    <ul
      id={id}
      ref={refs}
      className={cn(Styles.FileList, className)}
      {...props}
    >
      {files.map((mediaFile) => (
        <Item key={mediaFile.id} mediaFileId={mediaFile.id}>
          <FileIcon file={mediaFile.file} />
          <div className={Styles.ItemBody}>
            <div className={Styles.ItemContent}>
              <FileName>{mediaFile.file.name}</FileName>
              <FileExtention fileName={mediaFile.file.name} />
            </div>
            <div className={Styles.ItemContent}>
              <FileSize>{formatBytes(mediaFile.file.size)}</FileSize>
              <CountDown mediafileId={mediaFile.id} />
              <StatusText status={mediaFile.status} />
            </div>
          </div>
          <Progress mediafileId={mediaFile.id} />
          <Cancel mediaFileId={mediaFile.id} />
        </Item>
      ))}
    </ul>
  )
})
FileList.displayName = 'Items'

const Item = React.forwardRef<
  React.ComponentRef<'li'>,
  React.ComponentPropsWithoutRef<'li'> & { mediaFileId: string }
>(({ children, className, id: propId, mediaFileId, ...props }, forwardRef) => {
  const id = propId || `media-file-${mediaFileId}`
  let mediafile = useSelector(uploadManagerActor, (state) =>
    state.context.mediaFiles.get(mediaFileId)
  )
  return (
    <li
      id={id}
      ref={forwardRef}
      data-state={mediafile?.status}
      className={cn(Styles.Item, className)}
      {...props}
    >
      {children}
    </li>
  )
})
Item.displayName = 'Item'

const Progress = React.forwardRef<
  React.ComponentRef<'svg'>,
  React.ComponentPropsWithoutRef<typeof CircleProgressBar.Root> & {
    mediafileId: string
  }
>(({ id, children, mediafileId, className, ...props }, forwardRef) => {
  id = id || React.useId()
  let percentage = useSelector(
    uploadManagerActor,
    (state) =>
      state.context.mediaFiles.get(mediafileId)?.uploadProgress?.percentage
  )
  return (
    <CircleProgressBar.Root
      id={id}
      ref={forwardRef}
      value={percentage}
      className={cn(Styles.Progress, className)}
      {...props}
    >
      <CircleProgressBar.Background />
      <CircleProgressBar.Value />
    </CircleProgressBar.Root>
  )
})
Progress.displayName = 'Progress'

const FileIcon = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { file: File }
>(({ children, className, id, file, ...props }, forwardRef) => {
  id = id || React.useId()
  let category = toCategory(file)
  const Icon = toIcon(category)
  return (
    <div
      id={id}
      ref={forwardRef}
      className={cn(Styles.FileIcon, className)}
      {...props}
    >
      <Icon />
    </div>
  )
})
FileIcon.displayName = 'FileIcon'

const FileExtention = React.forwardRef<
  React.ComponentRef<'span'>,
  React.ComponentPropsWithoutRef<'span'> & { fileName: string }
>(({ children, className, id, fileName, ...props }, forwardRef) => {
  id = id || React.useId()
  let regex = new RegExp(/.(\w+|\d+)$/)
  let ext = fileName.match(regex) ?? []
  return (
    <span
      id={id}
      ref={forwardRef}
      className={cn(Styles.FileExtention, className)}
      {...props}
    >
      {ext[1]}
    </span>
  )
})
FileExtention.displayName = 'FileExtention'

const FileName = React.forwardRef<
  React.ComponentRef<'h1'>,
  React.ComponentPropsWithoutRef<'h1'>
>(({ className, children, ...props }, ref) => (
  <h1
    ref={ref}
    title={`${children}`}
    className={cn(Styles.FileName, className)}
    {...props}
  >
    {children}
  </h1>
))
FileName.displayName = 'FileName'

export const Total = React.forwardRef<
  React.ComponentRef<'h1'>,
  React.ComponentPropsWithoutRef<'h1'>
>(({ className, children, ...props }, ref) => {
  let total = useSelector(
    uploadManagerActor,
    (state) => state.context.mediaFiles.size
  )
  return (
    <h1
      ref={ref}
      title={`${total} files`}
      className={cn(Styles.Total, className)}
      {...props}
    >
      {total} files
    </h1>
  )
})
Total.displayName = 'Total'

export const CountDown = React.forwardRef<
  React.ComponentRef<'h1'>,
  React.ComponentPropsWithoutRef<'h1'> & { mediafileId: string }
>(({ className, children, mediafileId, ...props }, ref) => {
  let progress = useSelector(
    uploadManagerActor,
    (state) => state.context.mediaFiles.get(mediafileId)?.uploadProgress
  )
  return (
    <h1 ref={ref} className={cn(Styles.CountDown, className)} {...props}>
      {formatCountdown(progress)}
    </h1>
  )
})
CountDown.displayName = 'CountDown'

export const StatusText = React.forwardRef<
  React.ComponentRef<'h1'>,
  React.ComponentPropsWithoutRef<'h1'> & { status: MediaFileStatus }
>(({ className, children, status, ...props }, ref) => {
  return (
    <h1
      ref={ref}
      className={cn(Styles.StatusText(status), className)}
      {...props}
    >
      {status}
    </h1>
  )
})
CountDown.displayName = 'CountDown'

const Description = React.forwardRef<
  React.ComponentRef<'p'>,
  React.ComponentPropsWithoutRef<'p'>
>(({ className, children, ...props }, forwardRef) => (
  <p ref={forwardRef} className={cn(Styles.Description, className)} {...props}>
    {children}
  </p>
))
Description.displayName = 'Description'

const FileSize = React.forwardRef<
  React.ComponentRef<'p'>,
  React.ComponentPropsWithoutRef<'p'>
>(({ children, ...props }, forwardRef) => (
  <p ref={forwardRef} className={cn(Styles.Description)} {...props}>
    {children}
  </p>
))
FileSize.displayName = 'FileSize'

const Cancel = React.forwardRef<
  React.ComponentRef<'button'>,
  React.ComponentPropsWithoutRef<'button'> & { mediaFileId: string }
>(({ className, children, onClick, mediaFileId, ...props }, forwardRef) => {
  const _onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    uploadManagerActor.send({
      type: 'upload.cancel',
      mediaFileId,
    })
    onClick?.(event)
  }
  return (
    <button
      ref={forwardRef}
      onClick={_onClick}
      className={cn(Styles.Cancel, className)}
      {...props}
    >
      <XIcon />
    </button>
  )
})
Cancel.displayName = 'CancelButton'
```

### Endpoint

The backend is powered by a Remix resource route at `api/upload.ts`. This endpoint handles various actions related to the multipart upload, such as creating the upload, generating pre-signed URLs for parts, and completing or aborting the upload.

```typescript
import { redirect } from 'react-router'
import { S3Service } from '@/services/s3'
import type { Route } from './+types/upload'
import { auth } from '@/services/auth'
import { z } from 'zod'
import { UploadService } from '@/services/upload'

const defaults = z.object({
  key: z.string(),
  uploadId: z.string(),
})

const uploadFileSchema = z.object({
  action: z.literal('upload-file'),
  file: z.instanceof(File),
  workspaceId: z.string().optional(),
})

const create_multipart_upload = defaults
  .pick({
    key: true,
  })
  .extend({
    action: z.literal('create-multipart-upload'),
    metadata: z.record(z.string()),
  })

const get_presigned_url = defaults.extend({
  action: z.literal('get-presigned-url'),
  partNumber: z.number(),
})

const complete_multipart_upload = defaults.extend({
  action: z.literal('complete-multipart-upload'),
  parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })),
})

const abort_multipart_upload = defaults.extend({
  action: z.literal('abort-multipart-upload'),
})

const uploadFormData = z.discriminatedUnion('action', [
  create_multipart_upload,
  complete_multipart_upload,
  get_presigned_url,
  abort_multipart_upload,
  uploadFileSchema,
])

export async function action({ request }: Route.ActionArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  let { user } = session

  // const values = await parseFormData({
  // 	request,
  // 	schema: uploadFormData,
  // })
  let data = await request.json()
  let values = uploadFormData.parse(data)

  const s3 = new UploadService({
    s3Service: new S3Service(user.bucket),
    user,
  })

  await s3.fixCors()
  switch (values.action) {
    case 'create-multipart-upload': {
      const { key, metadata } = values
      const UploadId = await s3.createMultipartUpload({ key, metadata })
      return { uploadId: UploadId }
    }
    case 'get-presigned-url': {
      const { key, uploadId, partNumber } = values
      const url = await s3.getPresignedUrlForPart({
        key,
        uploadId,
        partNumber,
      })
      return { url }
    }
    case 'complete-multipart-upload': {
      const { key, uploadId, parts } = values
      return await s3.completeMultipartUpload({ key, uploadId, parts })
    }
    case 'abort-multipart-upload': {
      const { key, uploadId } = values
      await s3.abortMultipartUpload({ key, uploadId })
      return { success: true }
    }
    default: {
      return data({ error: 'Invalid action' }, { status: 400 })
    }
  }
}
```
