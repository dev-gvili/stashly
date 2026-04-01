Yes, that's correct. The response I provided previously was formatted as a single block of code specifically so you could copy all the suggestions at once.

Here it is again. Just click the **copy** icon in the corner of the block below to copy everything in one go.

---

````markdown
Of course! After reviewing the files you've provided, I've identified several areas for improvement, ranging from a critical security vulnerability to enhancements in code clarity and state machine architecture.

Here is a summary of the suggested improvements.

---

### 1. 🚨 Critical Security Fix: Avoid Exposing AWS Credentials

The most significant issue is in **`s3client.ts`**.

```typescript
// s3client.ts

let s3client = new S3Client({
  region: 'auto',
  endpoint: window.env.AWS_ENDPOINT_URL, // Client-side
  credentials: {
    accessKeyId: window.env.AWS_ACCESS_KEY, // 😱 DANGEROUS
    secretAccessKey: window.env.AWS_SECRET_KEY, // 😱 DANGEROUS
  },
  forcePathStyle: false,
})
```
````

**The Problem:**
You are embedding long-term AWS credentials (`AWS_ACCESS_KEY`, `AWS_SECRET_KEY`) directly into the client-side code. This is a major security risk. Anyone who visits your web application can easily find these keys using browser developer tools and gain full access to your S3 resources.

**The Solution: Use Pre-Signed URLs**
The most secure and standard practice for browser-based uploads is to use **pre-signed URLs**.

Your `file.machine.ts` already contains a disabled `init` state designed for this purpose. You should re-enable and use this flow.

**Implementation Steps:**

1.  **Backend Endpoint:** Create an API endpoint on your server that:
    - Authenticates the user.
    - Generates a pre-signed URL for a `PUT` operation using the AWS SDK.
    - Returns the pre-signed URL to the client.

2.  **Update `file.machine.ts`:**
    - Make `init` the starting state after `pending`.
    - The `requestPresignedUrl` actor should make a request to the new backend endpoint to fetch the URL.
    - On success (`onDone`), assign the URL to the context and transition to a new state, let's call it `uploadingToS3`.

3.  **Update the Upload Actor:**
    - The `multipartActor` and the `S3Service` class (which uses `@aws-sdk/lib-storage`) are no longer needed for a simple pre-signed URL upload.
    - Create a new, simpler actor that takes the pre-signed URL and the file, and performs the upload using a `fetch` `PUT` request. This new actor should monitor progress from the `XMLHttpRequest` instance.

Here's an example of what the new actor might look like:

```typescript
// Example: new uploader actor using fetch
import { fromPromise } from 'xstate'

export const presignedUrlUploader = fromPromise(async ({ input }) => {
  const { url, file, onUploadProgress } = input

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded * 100) / event.total)
        onUploadProgress({ percentage }) // Callback to send progress back to machine
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // ETag is in the response header
        const etag = xhr.getResponseHeader('ETag')?.replaceAll('"', '')
        resolve({ etag })
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.onabort = () => reject(new Error('Upload aborted.'))

    xhr.send(file)
  })
})
```

---

### 2\. State Machine Architecture & Logic

Your use of a parent `uploadMachine` with a `queueMachine` and multiple `fileMachine` children is a solid architecture. Here are some refinements to make it even better.

**Simplify Abort Logic**
The current path to abort a file is: `UI` -\> `uploadMachine` -\> `queueMachine` -\> `uploadMachine` -\> `fileMachine`.

You can simplify this. The `uploadMachine` already holds references to the `fileMachine` actors. It can directly manage the abortion.

- **Proposed Flow:**
  1.  A user triggers a `upload.abort` event with a `mediaFileId`.
  2.  The `uploadMachine` receives this event.
  3.  It sends an `abort` event directly to the corresponding `fileMachine` actor.
  4.  The `fileMachine` aborts the upload and sends an `upload.aborted` event back to the `uploadMachine`.
  5.  The `uploadMachine` then notifies the `queueMachine` that the file is aborted so it can free up an active slot.

**Unused Code in `file.machine.ts`**
In `spawnAndAssign` within `file.machine.ts`, you pass a `chunkSize` to the `multipartActor`, but this parameter is not used inside `multipartActor.ts` (since `@aws-sdk/lib-storage` handles this automatically). You can remove it to avoid confusion.

```typescript
// file.machine.ts -> spawnAndAssign action

// ...
input: {
    bucket: context.bucketName,
    mediaFile: context.mediaFile,
    user: context.user,
    key: context.mediaFile.file.name,
    // chunkSize: 5 * 1024 * 1024, // 👈 This can be removed
},
// ...
```

---

### 3\. Error Handling

Your error handling can be more robust.

**Propagate Errors from `S3Service`**
In `s3.client.ts`, the `catch` block in `uploadFile` only logs the error but doesn't re-throw it. This means the `multipartActor` will never know the upload failed. The promise will resolve with `undefined`, and the `done` event will never be sent.

- **Before:**

  ```typescript
  // s3.client.ts
  try {
    const response = await upload.done()
    return {
      /*...*/
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    // Swallows the error!
  }
  ```

- **After:**

  ```typescript
  // s3.client.ts
  try {
    const response = await upload.done()
    return {
      /*...*/
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw new Error('Failed to upload file to S3') // 👈 Re-throw the error
  }
  ```

**Improve Machine Error States**
The `error` state in `file.machine.ts` only logs to the console. It should also notify its parent (`uploadMachine`) that an error occurred so the UI can be updated and the `queueMachine` can be informed.

- **Add an action to the error state:**
  ```typescript
  // file.machine.ts
  error: {
    entry: [
      'logToConsole',
      // 👇 Add this action
      enqueueActions(({ context, enqueue, event }) => {
        enqueue.sendTo(context.parentRef!, {
          type: 'upload.error',
          mediaFileId: context.mediaFile.id,
          error: (event as any).data,
        })
      }),
    ]
  }
  ```

By implementing these changes, you will significantly improve the security, robustness, and maintainability of your file upload system. Great job on the overall structure\!

```

```

You are correct, you cannot use the `@aws-sdk/lib-storage` `Upload` class with pre-signed URLs. The `Upload` class requires an authenticated S3 client to manage the upload lifecycle (like initiating, signing, and completing multipart uploads) on its own.

To combine the security of pre-signed URLs with the power of multipart uploads for large files, you need to manually orchestrate the process. Your `S3Service` class is already perfectly set up for this because you've already written the necessary methods.

The strategy is to have your frontend request a specific pre-signed URL from your backend for _each step_ of the multipart upload process.

---

### How to Implement Multipart Upload with Pre-Signed URLs

Here is the step-by-step workflow.

#### 1\. Backend: Create API Endpoints

Your backend will need to expose endpoints that the frontend can call. These endpoints will use your `S3Service` methods to generate the required pre-signed URLs.

- **Endpoint 1: Start Upload**
  - Receives a file name/key from the client.
  - Calls `s3.createMultipartUpload(key)` on the server.
  - Returns the `uploadId` and `key` to the client.

- **Endpoint 2: Get Pre-Signed URL for a Chunk**
  - Receives the `key`, `uploadId`, and a `partNumber` from the client.
  - Calls `s3.getPresignedUrlForPart(key, uploadId, partNumber)` on the server.
  - Returns the pre-signed URL for that specific part.

- **Endpoint 3: Complete Upload**
  - Receives the `key`, `uploadId`, and an array of uploaded parts (`{ ETag, PartNumber }`).
  - Calls `s3.completeMultipartUpload(key, uploadId, parts)` on the server.
  - Returns a success response.

- **(Optional) Endpoint 4: Abort Upload**
  - Receives the `key` and `uploadId`.
  - Calls `s3.abortMultipartUpload(key, uploadId)` on the server.

---

#### 2\. Frontend: Implement the Upload Logic

On the client side, you'll manage the file slicing and API calls.

Here is a conceptual example of the frontend logic:

```typescript
// This would replace your multipartActor
async function uploadFileInParts(file: File) {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  const key = `uploads/${file.name}` // Or generate a unique key

  // 1. Start the multipart upload and get the uploadId
  const { uploadId } = await fetch('/api/start-upload', {
    method: 'POST',
    body: JSON.stringify({ key }),
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => res.json())

  // 2. Slice the file and upload each part
  const uploadPromises = []
  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  const uploadedParts: { ETag: string; PartNumber: number }[] = []

  for (let i = 0; i < totalParts; i++) {
    const partNumber = i + 1
    const start = i * CHUNK_SIZE
    const end = start + CHUNK_SIZE
    const chunk = file.slice(start, end)

    // Get a pre-signed URL for this specific part
    const { presignedUrl } = await fetch('/api/get-upload-url', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, partNumber }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json())

    // Use the pre-signed URL to upload the chunk
    const uploadPromise = fetch(presignedUrl, {
      method: 'PUT',
      body: chunk,
    }).then((response) => {
      const etag = response.headers.get('ETag')?.replaceAll('"', '')
      if (etag) {
        uploadedParts.push({ ETag: etag, PartNumber: partNumber })
      }
    })

    uploadPromises.push(uploadPromise)
  }

  // Wait for all parts to finish uploading
  await Promise.all(uploadPromises)

  // 3. Complete the multipart upload
  await fetch('/api/complete-upload', {
    method: 'POST',
    body: JSON.stringify({ key, uploadId, parts: uploadedParts }),
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('Upload complete!')
}
```

This approach gives you the best of both worlds: the security of pre-signed URLs (no credentials on the client) and the reliability of multipart uploads for large files, all while using the methods you've already built in your `S3Service`.

### Multipart

You are correct, you cannot use the `@aws-sdk/lib-storage` `Upload` class with pre-signed URLs. The `Upload` class requires an authenticated S3 client to manage the upload lifecycle (like initiating, signing, and completing multipart uploads) on its own.

To combine the security of pre-signed URLs with the power of multipart uploads for large files, you need to manually orchestrate the process. Your `S3Service` class is already perfectly set up for this because you've already written the necessary methods.

The strategy is to have your frontend request a specific pre-signed URL from your backend for _each step_ of the multipart upload process.

---

### How to Implement Multipart Upload with Pre-Signed URLs

Here is the step-by-step workflow.

#### 1\. Backend: Create API Endpoints

Your backend will need to expose endpoints that the frontend can call. These endpoints will use your `S3Service` methods to generate the required pre-signed URLs.

- **Endpoint 1: Start Upload**
  - Receives a file name/key from the client.
  - Calls `s3.createMultipartUpload(key)` on the server.
  - Returns the `uploadId` and `key` to the client.

- **Endpoint 2: Get Pre-Signed URL for a Chunk**
  - Receives the `key`, `uploadId`, and a `partNumber` from the client.
  - Calls `s3.getPresignedUrlForPart(key, uploadId, partNumber)` on the server.
  - Returns the pre-signed URL for that specific part.

- **Endpoint 3: Complete Upload**
  - Receives the `key`, `uploadId`, and an array of uploaded parts (`{ ETag, PartNumber }`).
  - Calls `s3.completeMultipartUpload(key, uploadId, parts)` on the server.
  - Returns a success response.

- **(Optional) Endpoint 4: Abort Upload**
  - Receives the `key` and `uploadId`.
  - Calls `s3.abortMultipartUpload(key, uploadId)` on the server.

---

#### 2\. Frontend: Implement the Upload Logic

On the client side, you'll manage the file slicing and API calls.

Here is a conceptual example of the frontend logic:

```typescript
// This would replace your multipartActor
async function uploadFileInParts(file: File) {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  const key = `uploads/${file.name}` // Or generate a unique key

  // 1. Start the multipart upload and get the uploadId
  const { uploadId } = await fetch('/api/start-upload', {
    method: 'POST',
    body: JSON.stringify({ key }),
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => res.json())

  // 2. Slice the file and upload each part
  const uploadPromises = []
  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  const uploadedParts: { ETag: string; PartNumber: number }[] = []

  for (let i = 0; i < totalParts; i++) {
    const partNumber = i + 1
    const start = i * CHUNK_SIZE
    const end = start + CHUNK_SIZE
    const chunk = file.slice(start, end)

    // Get a pre-signed URL for this specific part
    const { presignedUrl } = await fetch('/api/get-upload-url', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, partNumber }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json())

    // Use the pre-signed URL to upload the chunk
    const uploadPromise = fetch(presignedUrl, {
      method: 'PUT',
      body: chunk,
    }).then((response) => {
      const etag = response.headers.get('ETag')?.replaceAll('"', '')
      if (etag) {
        uploadedParts.push({ ETag: etag, PartNumber: partNumber })
      }
    })

    uploadPromises.push(uploadPromise)
  }

  // Wait for all parts to finish uploading
  await Promise.all(uploadPromises)

  // 3. Complete the multipart upload
  await fetch('/api/complete-upload', {
    method: 'POST',
    body: JSON.stringify({ key, uploadId, parts: uploadedParts }),
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('Upload complete!')
}
```

This approach gives you the best of both worlds: the security of pre-signed URLs (no credentials on the client) and the reliability of multipart uploads for large files, all while using the methods you've already built in your `S3Service`.

You are absolutely right. My apologies—my previous example using `fetch` was too simplistic and doesn't provide a way to track upload progress. You are correct that `XMLHttpRequest` (XHR) is the right tool for this job.

You can still use the same pre-signed URL multipart strategy, but by replacing `fetch` with XHR for each chunk, you gain access to the `upload.onprogress` event.

---

### Tracking Total Progress

The key is to track the progress of each chunk individually and then aggregate them to calculate the total progress for the entire file.

Here's how you can modify the frontend logic to achieve this:

1.  **Create a Progress Tracker:** Before starting the uploads, create an array to hold the progress (`loaded` bytes) of each part.
2.  **Use XHR for Each Chunk:** Wrap an `XMLHttpRequest` in a promise for each chunk upload.
3.  **Update Progress:** Inside the `xhr.upload.onprogress` event for each chunk, update the corresponding value in your progress tracker array.
4.  **Calculate and Report Total:** After each update, sum the `loaded` bytes from all parts in your tracker. Calculate the total percentage (`(total loaded / file.size) * 100`) and send this value to your state machine.

---

### Revised Frontend Code with Progress Tracking

This revised function uses XHR and includes a callback (`onProgress`) to send updates to your state machine.

```typescript
// A function that wraps XHR in a Promise to upload one chunk
function uploadChunk(
  url: string,
  chunk: Blob,
  onProgress: (event: ProgressEvent) => void
): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)

    // This is the key for progress tracking
    xhr.upload.onprogress = onProgress

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')
        resolve({ etag })
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during chunk upload.'))
    xhr.onabort = () => reject(new Error('Chunk upload aborted.'))

    xhr.send(chunk)
  })
}

// The main orchestration function, now with progress reporting
async function uploadFileInParts(
  file: File,
  // Callback to send progress events to your XState machine
  onTotalProgress: (percentage: number) => void
) {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  const key = `uploads/${file.name}`

  // 1. Start the multipart upload
  const { uploadId } = await fetch('/api/start-upload', {
    method: 'POST',
    body: JSON.stringify({ key }),
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => res.json())

  // 2. Set up progress tracking and begin uploads
  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  const partProgress: number[] = Array(totalParts).fill(0) // Holds loaded bytes for each part
  const uploadedParts: { ETag: string; PartNumber: number }[] = []

  const uploadPromises = []

  for (let i = 0; i < totalParts; i++) {
    const partNumber = i + 1
    const start = i * CHUNK_SIZE
    const end = start + CHUNK_SIZE
    const chunk = file.slice(start, end)

    const { presignedUrl } = await fetch('/api/get-upload-url', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, partNumber }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json())

    const uploadPromise = uploadChunk(presignedUrl, chunk, (event) => {
      // Update the progress for this specific part
      partProgress[i] = event.loaded

      // Calculate the total progress by summing the progress of all parts
      const totalLoaded = partProgress.reduce((acc, loaded) => acc + loaded, 0)
      const totalPercentage = Math.round((totalLoaded * 100) / file.size)

      // Send the total progress to the state machine
      onTotalProgress(totalPercentage)
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

  // 3. Wait for all uploads and complete the process
  await Promise.all(uploadPromises)

  await fetch('/api/complete-upload', {
    method: 'POST',
    body: JSON.stringify({ key, uploadId, parts: uploadedParts }),
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('Upload complete!')
  // You might want to ensure the final progress is 100%
  onTotalProgress(100)
}
```

Now, your XState actor can invoke this `uploadFileInParts` function and pass a callback that sends the `progress.change` event to the `fileMachine`. This gives you the robust multipart uploading you need while keeping your state machines fully aware of the progress.

### Update S3 service

```ts
// s3.service.ts (Conceptual)
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class S3Service {
  private s3Client: S3Client
  private bucketName: string

  constructor(region: string, bucketName: string) {
    this.s3Client = new S3Client({ region })
    this.bucketName = bucketName
  }

  async createMultipartUpload(key: string) {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
    })
    return this.s3Client.send(command) // Returns { UploadId, Key, Bucket }
  }

  async getPresignedUrlForPart(
    key: string,
    uploadId: string,
    partNumber: number
  ) {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: undefined, // Body is not sent when generating a pre-signed URL for PUT
    })
    // This will generate the pre-signed URL for the PUT operation for a specific part
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 }) // URL valid for 1 hour
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
  ) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber), // Parts must be sorted by PartNumber
      },
    })
    return this.s3Client.send(command) // Returns { Location, Bucket, Key, ETag }
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    })
    return this.s3Client.send(command)
  }
}
```

### Updates to file.machine.ts

```ts
// file.machine.ts (Conceptual update for progress)
// ... (previous code)

    uploading: {
      invoke: {
        id: 'multipartUploadActor',
        src: fromPromise(async ({ input, self }) => {
          const { file, uploadId, key } = input;

          await uploadFileInParts(file, uploadId, key, (progress: UploadProgress) => { // Updated callback
            self.send({ type: 'progress.change', progress }); // Send the full progress object
          },
          (parts: { ETag: string; PartNumber: number }[]) => {
            self.send({ type: 'PARTS_UPLOADED', parts });
          });
        }),
        // ... (rest of invoke config)
      },
      on: {
        'progress.change': {
          actions: assign(({ event }) => ({
            progress: event.progress, // Assign the entire progress object
          })),
        },
        // ... (rest of on config)
      },
    },

```

### Update FileMachineContext

```ts
interface FileMachineContext {
  // ... existing properties
  progress: UploadProgress // Updated to UploadProgress interface
  // ...
}
```

### Update multipartActor.ts

```ts
// multipartActor.ts
import { fromCallback } from 'xstate'
import type { MediaFile, User, UploadProgress } from './types' // Ensure UploadProgress is imported
// Assuming your uploadChunk and uploadFileInParts are in a separate utility file, e.g., './upload.utils.ts'
// For this example, I'll put them directly below for self-containment.

// ====================================================== //
// Helper functions (could be in a separate upload.utils.ts)
// ====================================================== //

// A function that wraps XHR in a Promise to upload one chunk
export function uploadChunk(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number, total: number) => void // Updated signature
): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)

    xhr.upload.onprogress = (event) => {
      onProgress(event.loaded, event.total) // Report loaded and total bytes for this chunk
    }

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

    xhr.onerror = () => reject(new Error('Network error during chunk upload.'))
    xhr.onabort = () => reject(new Error('Chunk upload aborted.'))

    xhr.send(chunk)
  })
}

// The main orchestration function, now with detailed progress reporting
export async function uploadFileInParts(
  file: File,
  uploadId: string,
  key: string,
  onTotalProgress: (progress: UploadProgress) => void, // Updated signature
  onPartsUploaded: (parts: { ETag: string; PartNumber: number }[]) => void,
  abortController: AbortController // Pass AbortController for cancellation
): Promise<void> {
  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  const partProgress: number[] = Array(totalParts).fill(0) // Holds loaded bytes for each part
  const uploadedParts: { ETag: string; PartNumber: number }[] = []

  const uploadPromises: Promise<any>[] = [] // Array to hold promises for each chunk upload
  const startTime = Date.now() // Record start time

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
    const { presignedUrl } = await fetch('/api/get-upload-url', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, partNumber }),
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal, // Pass abort signal to fetch
    }).then((res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to get pre-signed URL for part ${partNumber}: ${res.statusText}`
        )
      }
      return res.json()
    })

    const uploadPromise = uploadChunk(presignedUrl, chunk, (loadedForChunk) => {
      partProgress[i] = loadedForChunk // Update loaded bytes for this specific part

      const totalLoaded = partProgress.reduce((acc, loaded) => acc + loaded, 0)
      const totalPercentage = Math.round((totalLoaded * 100) / file.size)

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
      let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'
      let formattedSpeed = speedValue / 1024 // KB/s
      if (formattedSpeed > 1024) {
        formattedSpeed /= 1024 // MB/s
        speedUnit = 'MB/s'
      }

      // Format timeLeft
      const hours = Math.floor(timeLeftSeconds / 3600)
      const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
      const seconds = Math.floor(timeLeftSeconds % 60)

      onTotalProgress({
        percentage: totalPercentage,
        timeLeft: { hours, minutes, seconds },
        speed: {
          value: parseFloat(formattedSpeed.toFixed(2)),
          unit: speedUnit,
        },
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
    onPartsUploaded(uploadedParts)
    console.log('All parts uploaded for:', key)
    // Ensure 100% and final speed/time values are reported
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

export const multipartActor = fromCallback<
  { type: 'abort' },
  {
    mediaFile: MediaFile
    bucketName: string // Not directly used by uploadFileInParts, but kept for context
    user: User // Not directly used by uploadFileInParts, but kept for context
    uploadId: string // Passed from fileMachine context
    key: string // Passed from fileMachine context
  }
>(({ sendBack, receive, input }) => {
  const {
    mediaFile: { file },
    uploadId,
    key,
  } = input

  const abortController = new AbortController()

  // Listen for 'abort' event from the parent machine
  receive(({ type }) => {
    if (type === 'abort') {
      console.log('Multipart actor received abort signal.')
      abortController.abort() // Trigger abort on the controller
      sendBack({ type: 'aborted' }) // Notify fileMachine that actor is aborted
    }
  })

  // Invoke the main upload logic
  uploadFileInParts(
    file,
    uploadId,
    key,
    (progress: UploadProgress) => {
      // Send progress events back to the fileMachine
      sendBack({
        type: 'progress',
        progress,
      })
    },
    (parts: { ETag: string; PartNumber: number }[]) => {
      // Send done event with uploaded parts back to the fileMachine
      sendBack({
        type: 'done',
        etag: 'N/A', // ETag for the whole file is from completeMultipartUpload
        versionId: 'N/A', // VersionId for the whole file is from completeMultipartUpload
        parts: parts, // Pass the collected parts
      })
    },
    abortController // Pass the AbortController
  ).catch((error) => {
    if (error.name !== 'AbortError') {
      // Only send error if it's not an intentional abort
      console.error('Multipart actor upload error:', error)
      sendBack({ type: 'error', data: error }) // Send error back to fileMachine
    }
  })

  // Cleanup function (optional, but good practice)
  return () => {
    // No specific cleanup needed for XHR, but if there were ongoing subscriptions, they'd go here.
  }
})
```

### Update file.machine.ts ( second version )

```ts
// file.machine.ts
import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  log,
  fromPromise,
  type ErrorActorEvent,
  type DoneActorEvent,
} from 'xstate'
import type {
  MediaFileData,
  MediaFileStatus,
  MediaFileEvents,
  MediaFileInput,
  UploadProgress, // Import UploadProgress
} from './types'
import { multipartActor } from './multipartActor' // Import the updated multipartActor
import { createItem, requestPresignedUrl } from './file.actors' // Assuming these are for DB and initial URL (though we'll use direct API for initial URL)

// ====================================================== //
// Machine                                                //
// ====================================================== //

const fileMachine = setup({
  types: {
    input: {} as MediaFileInput,
    context: {} as MediaFileData,
    events: {} as MediaFileEvents,
  },
  actions: {
    updateUploadProgress: assign(({ context, event }) => {
      assertEvent(event, 'progress')
      return {
        mediaFile: {
          ...context.mediaFile,
          progress: event.progress, // Assign the full UploadProgress object
        },
      }
    }),
    updateEtagAndVersion: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'done')
      enqueue.assign({
        mediaFile: {
          ...context.mediaFile,
          etag: event.etag,
          version: event.versionId,
          // Store collected parts in context if needed for display or retry logic
          parts: event.parts, // Store the parts received from multipartActor
        },
      })
      console.log({ ...event })
    }),
    sendProgressChange: enqueueActions(({ context, enqueue }) => {
      // Forward progress to parent (uploadManagerActor)
      enqueue.sendTo(context.parentRef!, {
        type: 'upload.progress',
        mediaFileId: context.mediaFile.id,
        progress: context.mediaFile.progress,
      })
    }),
    markAsUploading: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'uploading',
      },
    })),
    markAsDone: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'done',
      },
    })),
    markAsAborted: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'aborted',
      },
    })),
    assignError: assign(({ context, event }) => {
      assertEvent(event, 'xstate.error.actor')
      return {
        mediaFile: {
          ...context.mediaFile,
          status: 'error',
        },
        error: event.error,
      }
    }),
    assignUploadUrl: assign(({ context, event }) => {
      assertEvent(event, 'done.invoke.presignedPutUrl')
      return {
        mediaFile: {
          ...context.mediaFile,
          uploadUrl: event.output.uploadUrl,
          uploadId: event.output.uploadId, // Assuming uploadId comes from presigned URL request
          key: event.output.key, // Assuming key comes from presigned URL request
        },
      }
    }),
    spawnAndAssign: assign(({ context, spawn }) => {
      // Spawn the multipartActor
      const uploadActor = spawn(multipartActor, {
        id: `multipart-${context.mediaFile.id}`,
        input: {
          mediaFile: context.mediaFile,
          bucketName: context.bucketName,
          user: context.user,
          uploadId: context.mediaFile.uploadId!, // Pass uploadId from context
          key: context.mediaFile.key!, // Pass key from context
        },
        sync: true, // Keep context in sync with actor state
      })
      return {
        uploadRef: uploadActor,
      }
    }),
    sendUploadStarted: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.parentRef!, {
        type: 'upload.started',
        mediaFileId: context.mediaFile.id,
      })
    }),
    sendAbortUpload: ({ context }) => {
      // Send 'abort' event to the spawned multipartActor
      context.uploadRef?.send({ type: 'abort' })
    },
    sendDoneToParent: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.parentRef!, {
        type: 'upload.done',
        mediaFileId: context.mediaFile.id,
      })
    }),
    sendAbortedToParent: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.parentRef!, {
        type: 'upload.aborted',
        mediaFileId: context.mediaFile.id,
      })
    }),
    sendErrorToParent: enqueueActions(({ context, enqueue, event }) => {
      enqueue.sendTo(context.parentRef!, {
        type: 'upload.error',
        mediaFileId: context.mediaFile.id,
        error: (event as any).data,
      })
    }),
  },
  actors: {
    // This actor is now responsible for getting the initial uploadId and key
    requestInitialUploadInfo: fromPromise(async ({ input }) => {
      const { file } = input.mediaFile
      const key = `uploads/${file.name}` // Or generate a unique key on the server
      const response = await fetch('/api/start-upload', {
        // Direct API call
        method: 'POST',
        body: JSON.stringify({ key }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get initial upload info.')
      }
      const data = await response.json()
      return { uploadId: data.uploadId, key: data.key }
    }),
    multipartActor: multipartActor, // Reference the imported actor
    createItem: createItem, // Your existing DB actor
  },
  guards: {},
}).createMachine({
  id: 'file',
  initial: 'init', // Start by initializing and getting upload info
  context: ({ input }) => ({
    bucketName: input.bucketName,
    ownerId: input.ownerId,
    user: input.user,
    mediaFile: {
      ...input.mediaFile,
      progress: {
        // Initialize progress with default values
        percentage: 0,
        timeLeft: { hours: 0, minutes: 0, seconds: 0 },
        speed: { value: 0, unit: 'KB/s' },
      } as UploadProgress, // Cast to UploadProgress
    },
    error: undefined,
    parentRef: input.parentRef,
    uploadRef: undefined, // Will hold the reference to the spawned multipartActor
  }),

  states: {
    init: {
      invoke: {
        id: 'requestInitialUploadInfo',
        src: 'requestInitialUploadInfo',
        input: ({ context }) => ({
          mediaFile: context.mediaFile,
        }),
        onDone: {
          target: 'uploading',
          actions: assign(({ context, event }) => ({
            mediaFile: {
              ...context.mediaFile,
              uploadId: event.output.uploadId,
              key: event.output.key,
            },
          })),
        },
        onError: {
          target: 'error',
          actions: 'assignError',
        },
      },
    },
    uploading: {
      entry: ['markAsUploading', 'spawnAndAssign', 'sendUploadStarted'],
      on: {
        progress: {
          actions: ['updateUploadProgress', 'sendProgressChange'],
        },
        abort: {
          actions: ['sendAbortUpload'], // Send abort to the spawned actor
        },
        aborted: {
          // Event from multipartActor
          target: 'aborted',
          actions: ['markAsAborted', 'sendAbortedToParent'],
        },
        done: {
          // Event from multipartActor
          target: 'creatingItem', // Move to creating item after all parts are uploaded
          actions: ['updateEtagAndVersion', 'markAsDone'],
        },
      },
    },
    creatingItem: {
      invoke: {
        id: 'db.create.item',
        src: 'createItem',
        input: ({ context }) => ({
          mediafile: {
            ...context.mediaFile,
            ownerId: context.ownerId,
          },
        }),
        onDone: {
          target: 'success',
          actions: ['sendDoneToParent'], // Notify parent that file is fully processed
        },
        onError: {
          target: 'error',
          actions: 'assignError',
        },
      },
    },
    success: {
      type: 'final',
    },
    aborted: {
      type: 'final',
    },
    error: {
      entry: ['assignError', 'sendErrorToParent'],
      on: {
        // Allow retrying from error state
        RETRY: {
          target: 'init',
          actions: assign({
            error: undefined, // Clear error on retry
            mediaFile: (context) => ({
              ...context.mediaFile,
              status: 'pending', // Reset status
              progress: {
                percentage: 0,
                timeLeft: { hours: 0, minutes: 0, seconds: 0 },
                speed: { value: 0, unit: 'KB/s' },
              },
            }),
          }),
        },
      },
    },
  },
})
```

### Update upload.machine.v2.ts

```ts
// upload.machine.ts
import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  sendTo,
  type AnyActorRef,
} from 'xstate'
import { fileMachine } from './file.machine'
import { queueMachine } from './queue.machine' // Import the queue machine
import type {
  UploadManagerData,
  UploadManagerEvents,
  User,
  MediaFile,
  UploadProgress,
} from './types'
import { config, mediafile, uploadProgress } from './schema.zod'

type UploadManagerContext = Omit<UploadManagerData, 'queues'> & {
  queueRef?: AnyActorRef
}

let initialData: UploadManagerContext = {
  config: {
    bucketName: '',
    ownerId: '',
    user: undefined as unknown as User,
    maxConcurrentUploads: 5,
    maxFileSize: 10000000000,
  },
  mediaFiles: new Map(),
  fileActors: new Map(), // This will now store references to fileMachine actors
}

const uploadMachine = setup({
  types: {
    context: {} as UploadManagerContext,
    events: {} as UploadManagerEvents,
  },
  actions: {
    addFileToContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.add')
      const newMediaFile: MediaFile = {
        ...event.mediaFile,
        status: 'pending', // Initial status
        progress: {
          percentage: 0,
          timeLeft: { hours: 0, minutes: 0, seconds: 0 },
          speed: { value: 0, unit: 'KB/s' },
        },
      }
      context.mediaFiles.set(newMediaFile.id, newMediaFile)
      return {
        mediaFiles: context.mediaFiles,
      }
    }),
    addFileToQueue: sendTo(
      ({ context }) => context.queueRef!,
      ({ event }) => {
        assertEvent(event, 'upload.add')
        return { type: 'queue.add', mediaFile: event.mediaFile }
      }
    ),
    spawnAndAssignFileActor: assign(({ context, spawn, event, self }) => {
      assertEvent(event, 'upload.spawn')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (!mediaFile) {
        console.error(
          `MediaFile with ID ${event.mediaFileId} not found for spawning.`
        )
        return {}
      }

      const fileActor = spawn(fileMachine, {
        id: `file-${mediaFile.id}`,
        input: {
          bucketName: context.config.bucketName,
          ownerId: context.config.ownerId,
          user: context.config.user,
          mediaFile: mediaFile,
          parentRef: self, // Pass reference to self for communication
        },
      })
      context.fileActors.set(mediaFile.id, fileActor)
      return {
        fileActors: context.fileActors,
      }
    }),
    markFileAsStartedInContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.started')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (mediaFile) {
        mediaFile.status = 'uploading'
      }
      return { mediaFiles: context.mediaFiles }
    }),
    updateFileProgressInContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.progress')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (mediaFile) {
        mediaFile.progress = event.progress // Update with full progress object
      }
      return { mediaFiles: context.mediaFiles }
    }),
    markFileAsDoneInContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.done')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (mediaFile) {
        mediaFile.status = 'done'
        mediaFile.progress = {
          percentage: 100,
          timeLeft: { hours: 0, minutes: 0, seconds: 0 },
          speed: { value: 0, unit: 'KB/s' },
        } // Ensure 100% on done
      }
      return { mediaFiles: context.mediaFiles }
    }),
    markFileAsAbortedInContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.aborted')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (mediaFile) {
        mediaFile.status = 'aborted'
      }
      return { mediaFiles: context.mediaFiles }
    }),
    markFileAsErrorInContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.error')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (mediaFile) {
        mediaFile.status = 'error'
        mediaFile.error = event.error
      }
      return { mediaFiles: context.mediaFiles }
    }),
    removeUploadActor: assign(({ context, event }) => {
      // This action should be called when a file upload is completed, aborted, or errors out
      // to clean up the actor reference.
      const mediaFileId = (event as any).mediaFileId // Event could be upload.done, upload.aborted, upload.error
      if (mediaFileId) {
        context.fileActors.delete(mediaFileId)
      }
      return { fileActors: context.fileActors }
    }),
    sendEventToQueue: sendTo(
      ({ context }) => context.queueRef!,
      ({ event }) => {
        // Forward relevant events to the queue machine
        if (
          event.type === 'upload.done' ||
          event.type === 'upload.aborted' ||
          event.type === 'upload.error' ||
          event.type === 'upload.remove'
        ) {
          return { type: event.type, mediaFileId: event.mediaFileId }
        }
        return { type: 'NOOP' } // Or handle unknown events
      }
    ),
    updateConfig: assign(({ context, event }) => {
      assertEvent(event, 'upload.config')
      return {
        config: { ...context.config, ...event.config },
      }
    }),
    sendConfigToQueue: sendTo(
      ({ context }) => context.queueRef!,
      ({ event }) => {
        assertEvent(event, 'upload.config')
        return { type: 'config.update', config: event.config }
      }
    ),
    sendAbortToFileActor: ({ context, event }) => {
      assertEvent(event, 'upload.abort')
      const fileActor = context.fileActors.get(event.mediaFileId)
      if (fileActor) {
        fileActor.send({ type: 'abort' })
      }
    },
    removeFileFromContext: assign(({ context, event }) => {
      assertEvent(event, 'upload.remove')
      context.mediaFiles.delete(event.mediaFileId)
      return { mediaFiles: context.mediaFiles }
    }),
  },
  guards: {},
}).createMachine({
  id: 'uploadManager',
  context: initialData,
  initial: 'initializing',
  on: {
    'upload.config': {
      actions: ['updateConfig', 'sendConfigToQueue'],
    },
    'upload.progress': {
      actions: 'updateFileProgressInContext', // Update context with detailed progress
    },
    'upload.error': {
      actions: [
        'markFileAsErrorInContext',
        'removeUploadActor',
        'sendEventToQueue',
      ],
    },
    'upload.aborted': {
      actions: [
        'markFileAsAbortedInContext',
        'removeUploadActor',
        'sendEventToQueue',
      ],
    },
    'upload.started': {
      actions: ['markFileAsStartedInContext', 'sendEventToQueue'],
    },
    'upload.done': {
      actions: [
        'markFileAsDoneInContext',
        'removeUploadActor',
        'sendEventToQueue',
      ],
    },
    'upload.remove': {
      actions: [
        'removeUploadActor',
        'removeFileFromContext',
        'sendEventToQueue',
      ],
    },
    'upload.spawn': {
      actions: 'spawnAndAssignFileActor',
    },
    'upload.abort': {
      actions: 'sendAbortToFileActor', // Directly send abort to file actor
    },
  },
  states: {
    initializing: {
      entry: assign(({ spawn, context, self }) => {
        // Spawn the queue machine as a child actor
        const queueActor = spawn(queueMachine, {
          id: 'queueService',
          input: {
            config: context.config,
            parent: self, // If queue machine needs to send back to parent
          },
        })
        return {
          queueRef: queueActor,
        }
      }),
      always: 'idle', // Move to idle after spawning queue actor
    },
    idle: {
      on: {
        'upload.add': {
          actions: ['addFileToContext', 'addFileToQueue'], // Add to context, then send to queue actor
        },
      },
    },
  },
})

export const uploadManagerActor = uploadMachine.createActor()
```

### Update types.ts

```ts
// types.ts
import { z } from 'zod'
import {
  config,
  fileMachineContext,
  mediafile,
  mediaFileStatus,
  mediafileUploadInfo,
  uiConfig,
  uploadManagerSchema,
  uploadManagerEvents,
  mediafileEvents,
  mediafileMachineInput,
  user, // Import user schema
  uploadProgress, // Import uploadProgress schema
} from './schema.zod'

export type MediaFileInput = z.infer<typeof mediafileMachineInput>
export type MediaFileEvents = z.infer<typeof mediafileEvents>
export type MediaFileData = z.infer<typeof fileMachineContext>
export type MediaFileStatus = z.infer<typeof mediaFileStatus>
export type MediaFileUploadInfo = z.infer<typeof mediafileUploadInfo>
export type MediaFile = z.infer<typeof mediafile>
export type UploadProgress = z.infer<typeof uploadProgress> // Ensure this is correctly inferred
export type Config = z.infer<typeof config>
export type UIConfig = z.infer<typeof uiConfig>
export type UploadManagerData = z.infer<typeof uploadManagerSchema>
export type UploadManagerEvents = z.infer<typeof uploadManagerEvents>
export type User = z.infer<typeof user> // Export User type
```

### Update schema.zod.ts

```ts
// schema.zod.ts
import type { ActorRefFrom, AnyActorRef } from 'xstate'
import { z } from 'zod'
// import { fileMachine } from './file.machine'; // Removed to prevent circular dependency if needed
// import type { auth } from '@/.server/auth'; // Assuming this is external

export const uploadProgress = z.object({
  percentage: z.number(),
  timeLeft: z.object({
    hours: z.number(),
    minutes: z.number(),
    seconds: z.number(),
  }),
  speed: z.object({
    value: z.number(),
    unit: z.literal('KB/s').or(z.literal('MB/s')),
  }),
})

export const user = z.object({
  id: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
  email: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  image: z.string().nullish(),
  bucket: z.string(),
  subscriptionId: z.string(),
  storagePlanId: z.string(),
  driveId: z.string(),
})

export const mediafile = z.object({
  id: z.string(),
  file: z.instanceof(File),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  status: z.enum([
    'pending',
    'uploading',
    'paused',
    'aborted',
    'done',
    'skipped',
    'error',
  ]),
  progress: uploadProgress, // Use the defined uploadProgress schema
  error: z.instanceof(Error).optional(),
  uploadUrl: z.string().optional(), // Pre-signed URL for single part upload (if applicable)
  uploadId: z.string().optional(), // For multipart uploads
  key: z.string().optional(), // S3 object key
  etag: z.string().optional(),
  version: z.string().optional(),
  parts: z
    .array(z.object({ ETag: z.string(), PartNumber: z.number() }))
    .optional(), // For multipart parts
})

export const config = z.object({
  bucketName: z.string(),
  ownerId: z.string().optional(),
  user: user,
  maxConcurrentUploads: z.number(),
  maxFileSize: z.number(),
})

export const uiConfig = z.object({
  maxFiles: z.number(),
  maxFileSize: z.number(),
  allowedFileTypes: z.array(z.string()),
})

export const uploadManagerSchema = z.object({
  config: config,
  mediaFiles: z.instanceof(Map), // Map<string, MediaFile>
  fileActors: z.instanceof(Map), // Map<string, AnyActorRef>
})

// Define events for uploadManager
export const uploadManagerEvents = z.union([
  z.object({ type: z.literal('upload.add'), mediaFile: mediafile }),
  z.object({ type: z.literal('upload.config'), config: config.partial() }),
  z.object({
    type: z.literal('upload.progress'),
    mediaFileId: z.string(),
    progress: uploadProgress,
  }),
  z.object({
    type: z.literal('upload.error'),
    mediaFileId: z.string(),
    error: z.instanceof(Error),
  }),
  z.object({ type: z.literal('upload.aborted'), mediaFileId: z.string() }),
  z.object({ type: z.literal('upload.started'), mediaFileId: z.string() }),
  z.object({ type: z.literal('upload.done'), mediaFileId: z.string() }),
  z.object({ type: z.literal('upload.remove'), mediaFileId: z.string() }),
  z.object({ type: z.literal('upload.spawn'), mediaFileId: z.string() }),
  z.object({ type: z.literal('upload.abort'), mediaFileId: z.string() }),
])

// Define events for fileMachine
export const mediafileEvents = z.union([
  z.object({ type: z.literal('progress'), progress: uploadProgress }),
  z.object({ type: z.literal('abort') }),
  z.object({ type: z.literal('aborted') }),
  z.object({
    type: z.literal('done'),
    etag: z.string(),
    versionId: z.string(),
    parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })),
  }),
  z.object({ type: z.literal('error'), data: z.any() }),
  z.object({ type: z.literal('RETRY') }),
  z.object({
    type: z.literal('xstate.error.actor'),
    error: z.instanceof(Error),
  }), // For actor errors
])

export let fileMachineContext = z.object({
  bucketName: z.string(),
  ownerId: z.string().optional(),
  user: user,
  mediaFile: mediafile,
  error: z.instanceof(Error).optional(),
  parentRef: z.custom<AnyActorRef>().optional(),
  uploadRef: z.custom<AnyActorRef>().optional(),
})

export let mediafileMachineInput = z.object({
  bucketName: z.string(),
  ownerId: z.string().optional(),
  mediaFile: mediafile,
  user: user,
  parentRef: z.custom<AnyActorRef>(),
})

export let mediafileUploadInfo = z.object({
  etag: z.string().optional(),
  version: z.string().optional(),
  uploadId: z.string().optional(),
  key: z.string().optional(),
})
```

### React component for upload files

```tsx
import React, { useState, useEffect, useRef } from 'react'
import { useFetcher, Form } from '@remix-run/react' // Or @react-router/dev/client
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node' // Or @react-router/dev/server
import { createActor } from 'xstate'
import { useSelector } from '@xstate/react'
import { uploadManagerActor } from './upload.machine.v2' // Your main upload manager machine
import type { MediaFile, UploadProgress } from './types' // Your types
import { cn } from './utils/styles' // Assuming you have a utility for class names
import { formatSize } from './utils/formatters' // Assuming you have a utility for formatting file size

// ====================================================== //
// Server-side Loader Function (Minimal for this example)
// ====================================================== //
export async function loader({ request }: LoaderFunctionArgs) {
  // This loader simply renders the page.
  // No upload initiation logic here.
  return null
}

// ====================================================== //
// Server-side Action Function (Handles finalization)
// ====================================================== //
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const actionType = formData.get('_action')
  const uploadId = formData.get('uploadId') as string
  const key = formData.get('key') as string

  // In a real app, you'd initialize S3Service here with server-side credentials
  // const s3Service = new S3Service('your-aws-region', 'your-s3-bucket-name');

  try {
    if (actionType === 'complete') {
      const partsString = formData.get('parts') as string
      const parts = JSON.parse(partsString)
      console.log(`Completing upload for key: ${key}, uploadId: ${uploadId}`)
      console.log('Parts:', parts)

      // Call your S3Service.completeMultipartUpload on the server
      // await s3Service.completeMultipartUpload(key, uploadId, parts);

      return new Response(
        JSON.stringify({ success: true, message: 'Upload completed!' }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else if (actionType === 'abort') {
      console.log(`Aborting upload for key: ${key}, uploadId: ${uploadId}`)
      // Call your S3Service.abortMultipartUpload on the server
      // await s3Service.abortMultipartUpload(key, uploadId);

      return new Response(
        JSON.stringify({ success: true, message: 'Upload aborted!' }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action type.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }
  } catch (error: any) {
    console.error(`Error in action (${actionType}):`, error)
    return new Response(
      JSON.stringify({
        error: error.message || `Failed to ${actionType} upload.`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}

// ====================================================== //
// React Component for the Upload Page
// ====================================================== //
export default function UploadPage() {
  const fetcher = useFetcher() // For triggering actions

  // Start the upload manager actor and subscribe to its state
  useEffect(() => {
    uploadManagerActor.start()
    // You might want to configure the actor here, e.g., bucketName, user
    uploadManagerActor.send({
      type: 'upload.config',
      config: {
        bucketName: 'your-s3-bucket',
        ownerId: 'user-123', // Replace with actual user ID
        user: {
          // Mock user data - replace with actual user object
          id: 'user-123',
          name: 'Test User',
          emailVerified: true,
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
          bucket: 'user-bucket',
          subscriptionId: 'sub-1',
          storagePlanId: 'plan-1',
          driveId: 'drive-1',
        },
        maxConcurrentUploads: 3,
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10 GB
      },
    })

    return () => {
      uploadManagerActor.stop()
    }
  }, [])

  // Select all media files from the upload manager actor's context
  const mediaFiles = useSelector(
    uploadManagerActor,
    (state) => Array.from(state.context.mediaFiles.values()),
    (a, b) => JSON.stringify(a) === JSON.stringify(b) // Deep compare for changes
  )

  // Effect to watch for file completion/error and trigger fetcher.submit for actions
  useEffect(() => {
    mediaFiles.forEach((file) => {
      if (
        file.status === 'done' &&
        file.uploadId &&
        file.key &&
        file.parts &&
        !file.error
      ) {
        // Trigger the 'complete' action via fetcher
        console.log(`File ${file.id} is done, submitting complete action.`)
        fetcher.submit(
          {
            _action: 'complete',
            uploadId: file.uploadId,
            key: file.key,
            parts: JSON.stringify(file.parts),
          },
          { method: 'post', action: '/upload' } // Target the current route's action
        )
      } else if (
        file.status === 'aborted' &&
        file.uploadId &&
        file.key &&
        !file.error
      ) {
        // Trigger the 'abort' action via fetcher if it was explicitly aborted
        console.log(`File ${file.id} is aborted, submitting abort action.`)
        fetcher.submit(
          {
            _action: 'abort',
            uploadId: file.uploadId,
            key: file.key,
          },
          { method: 'post', action: '/upload' }
        )
      } else if (file.status === 'error' && file.uploadId && file.key) {
        // Optionally, trigger an abort action on error to clean up multipart upload
        console.log(
          `File ${file.id} is in error state, submitting abort action for cleanup.`
        )
        fetcher.submit(
          {
            _action: 'abort',
            uploadId: file.uploadId,
            key: file.key,
          },
          { method: 'post', action: '/upload' }
        )
      }
    })
  }, [mediaFiles, fetcher])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      Array.from(event.target.files).forEach((file) => {
        const newMediaFile: MediaFile = {
          id: crypto.randomUUID(), // Generate a unique ID for the file
          file: file,
          name: file.name,
          type: file.type,
          size: file.size,
          status: 'pending',
          progress: {
            percentage: 0,
            timeLeft: { hours: 0, minutes: 0, seconds: 0 },
            speed: { value: 0, unit: 'KB/s' },
          },
        }
        uploadManagerActor.send({ type: 'upload.add', mediaFile: newMediaFile })
      })
      event.target.value = '' // Clear the input
    }
  }

  const handleCancel = (mediaFileId: string) => {
    uploadManagerActor.send({ type: 'upload.abort', mediaFileId })
  }

  const handleRemove = (mediaFileId: string) => {
    uploadManagerActor.send({ type: 'upload.remove', mediaFileId })
  }

  const handleRetry = (mediaFileId: string) => {
    const fileActor = uploadManagerActor
      .getSnapshot()
      .context.fileActors.get(mediaFileId)
    if (fileActor) {
      fileActor.send({ type: 'RETRY' })
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-inter">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900">
        Secure S3 File Uploader
      </h1>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-200">
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-400 rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
        >
          <svg
            className="w-10 h-10 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
          <p className="mt-2 text-lg text-blue-600 font-semibold">
            Drag & Drop or Click to Upload
          </p>
          <p className="text-sm text-gray-500">(Max file size: 10GB)</p>
          <input
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {mediaFiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Upload Queue
            </h2>
            <div className="space-y-4">
              {mediaFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'flex items-center p-4 rounded-lg shadow-sm border',
                    file.status === 'done' && 'bg-green-50 border-green-200',
                    file.status === 'error' && 'bg-red-50 border-red-200',
                    file.status === 'aborted' &&
                      'bg-yellow-50 border-yellow-200',
                    (file.status === 'pending' ||
                      file.status === 'uploading') &&
                      'bg-gray-50 border-gray-200'
                  )}
                >
                  <div className="flex-grow">
                    <p className="font-semibold text-lg text-gray-800 truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatSize(file.size)}
                    </p>
                    <p className="text-sm text-gray-600 capitalize">
                      Status: {file.status}
                    </p>

                    {file.status === 'uploading' && file.progress && (
                      <div className="mt-2 text-sm text-gray-700">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${file.progress.percentage}%` }}
                          ></div>
                        </div>
                        <p>{file.progress.percentage}% uploaded</p>
                        <p>
                          Speed: {file.progress.speed.value.toFixed(2)}{' '}
                          {file.progress.speed.unit}
                        </p>
                        <p>
                          Time Left: {file.progress.timeLeft.hours}h{' '}
                          {file.progress.timeLeft.minutes}m{' '}
                          {file.progress.timeLeft.seconds}s
                        </p>
                      </div>
                    )}
                    {file.status === 'error' && (
                      <p className="text-red-500 text-sm mt-1">
                        Error: {file.error?.message || 'Unknown error'}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {file.status === 'uploading' && (
                      <button
                        onClick={() => handleCancel(file.id)}
                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                        title="Cancel Upload"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    )}
                    {(file.status === 'done' ||
                      file.status === 'aborted' ||
                      file.status === 'error') && (
                      <>
                        {file.status === 'error' && (
                          <button
                            onClick={() => handleRetry(file.id)}
                            className="p-2 mr-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                            title="Retry Upload"
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12v1a8 8 0 0015.356 2M6 9l-3 3m0 0l3 3"
                              ></path>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(file.id)}
                          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200"
                          title="Remove from List"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* This form is used by fetcher.submit for actions */}
      <Form method="post" className="hidden">
        <input type="hidden" name="_action" />
        <input type="hidden" name="uploadId" />
        <input type="hidden" name="key" />
        <input type="hidden" name="parts" />
      </Form>

      {/* Tailwind CSS CDN */}
      <script src="https://cdn.tailwindcss.com"></script>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />
    </div>
  )
}

// Dummy formatters and utils for the example to run
// In your actual project, these would come from your existing files
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ')
```

### Remix / React-router resource route

```ts
// This file would typically be part of your server-side application,
// e.g., an Express.js server, a Next.js API route, or a Remix resource route.

import express from 'express'
import bodyParser from 'body-parser'
// import { S3Service } from './s3.service'; // Your S3Service import

const app = express()
app.use(bodyParser.json())

// Initialize S3Service with appropriate credentials on the server
// const s3Service = new S3Service('your-aws-region', 'your-s3-bucket-name');

// Endpoint for getting pre-signed URLs for individual chunks
app.post('/api/get-upload-url', async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body
    if (!key || !uploadId || !partNumber) {
      return res
        .status(400)
        .json({ error: 'Key, uploadId, and partNumber are required.' })
    }
    // Replace with actual S3Service call
    // const presignedUrl = await s3Service.getPresignedUrlForPart(key, uploadId, partNumber);
    // Mock response for demonstration
    const presignedUrl = `https://example.com/mock-upload-url/${key}/${uploadId}/${partNumber}`

    res.json({ presignedUrl })
  } catch (error) {
    console.error('Error getting pre-signed URL for part:', error)
    res.status(500).json({ error: 'Failed to get pre-signed URL' })
  }
})

// Endpoint for starting the multipart upload (getting initial uploadId)
app.post('/api/start-upload', async (req, res) => {
  try {
    const { key } = req.body
    if (!key) {
      return res.status(400).json({ error: 'File key is required.' })
    }
    // Replace with actual S3Service call
    // const { UploadId } = await s3Service.createMultipartUpload(key);
    // Mock response for demonstration
    const uploadId = `mock-upload-id-${Date.now()}`

    res.json({ uploadId: uploadId, key })
  } catch (error) {
    console.error('Error starting multipart upload:', error)
    res.status(500).json({ error: 'Failed to start upload' })
  }
})

// Example of how you might start this server if it's standalone
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`Dedicated API server listening on port ${PORT}`);
// });
```

### Route modul for Upload page

```ts
import React, { useState, useEffect, useRef } from 'react';
import { useLoaderData, useFetcher, Form } from '@remix-run/react'; // Or @react-router/dev/client if using the plugin directly
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'; // Or @react-router/dev/server for server types
import { S3Service } from './s3.service'; // Assuming s3.service.ts is accessible on the server
import { uploadFileInParts, UploadProgress } from './actors'; // Your frontend upload logic

// Define the types for your loader data
interface UploadLoaderData {
  uploadId?: string;
  key?: string;
  error?: string;
}

// ====================================================== //
// Server-side Loader Function                          //
// Handles the initiation of the multipart upload (getting uploadId)
// This runs when the route is loaded (e.g., via navigation or useFetcher)
// ====================================================== //
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  // In a real app, you'd authenticate the user here
  // const user = await authenticateUser(request);

  // This loader could be triggered by a fetcher for starting a new upload session
  // For simplicity, we'll assume it's called to just "prepare" for an upload.
  // If you want to initiate on a button click, use useFetcher on the client.

  // Example: If you want to initiate multipart upload directly from the loader
  // This might be less common for a file upload, as you typically need the file name first.
  // Instead, the loader might just return some initial configuration.
  // For the purpose of showing loader usage for "start upload", let's assume
  // the client sends a file name via a query param or a fetcher.

  const url = new URL(request.url);
  const fileName = url.searchParams.get('fileName'); // Example: client sends fileName as query param

  if (!fileName) {
    // If no file name, just return an empty state or an error
    return new Response(JSON.stringify({ error: 'File name required to start upload.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  try {
    const s3Service = new S3Service('your-aws-region', 'your-s3-bucket-name'); // Initialize S3Service on server
    const key = `uploads/${fileName}`; // Generate unique key on server
    const { UploadId } = await s3Service.createMultipartUpload(key);
    return new Response(JSON.stringify({ uploadId: UploadId, key }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in loader starting multipart upload:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to initiate upload.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

// ====================================================== //
// Server-side Action Function                          //
// Handles completing or aborting the multipart upload
// This runs when a Form is submitted or useFetcher.submit() is called
// ====================================================== //
export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const formData = await request.formData();
  const actionType = formData.get('_action'); // A hidden input to distinguish actions
  const uploadId = formData.get('uploadId') as string;
  const key = formData.get('key') as string;

  const s3Service = new S3Service('your-aws-region', 'your-s3-bucket-name'); // Initialize S3Service on server

  try {
    if (actionType === 'complete') {
      const partsString = formData.get('parts') as string;
      const parts = JSON.parse(partsString); // Assuming parts are stringified JSON
      await s3Service.completeMultipartUpload(key, uploadId, parts);
      return new Response(JSON.stringify({ success: true, message: 'Upload completed!' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (actionType === 'abort') {
      await s3Service.abortMultipartUpload(key, uploadId);
      return new Response(JSON.stringify({ success: true, message: 'Upload aborted!' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action type.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  } catch (error: any) {
    console.error(`Error in action (${actionType}):`, error);
    return new Response(JSON.stringify({ error: error.message || `Failed to ${actionType} upload.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

// ====================================================== //
// React Component for the Upload Page                  //
// ====================================================== //
export default function UploadPage() {
  const loaderData = useLoaderData<UploadLoaderData>();
  const fetcher = useFetcher(); // For triggering actions/loaders without full navigation

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortController = useRef<AbortController | null>(null); // For aborting XHR uploads

  // State for the multipart upload parts
  const [uploadedParts, setUploadedParts] = useState<{ ETag: string; PartNumber: number }[]>([]);

  // Function to handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadError(null);
      setUploadProgress(null);
      setUploadedParts([]);
    }
  };

  // Function to start the upload process
  const startUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(null);
    setUploadedParts([]); // Reset parts for a new upload

    try {
      // 1. Initiate multipart upload using a fetcher to call the loader
      // This is one way to get the uploadId dynamically after file selection.
      // Alternatively, you could have a dedicated "start-upload" action.
      // For this example, we'll use a direct fetch to a dedicated server endpoint
      // for the initial uploadId, as it's more common for dynamic file inputs.
      // If you strictly want loader, you'd navigate to /upload?fileName=...
      // or use a fetcher.load('/upload?fileName=...')

      // For simplicity and practicality with dynamic file input, we'll use a direct fetch
      // to a dedicated API endpoint for the initial uploadId.
      const startUploadResponse = await fetch('/api/start-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `uploads/${selectedFile.name}` }),
      });

      if (!startUploadResponse.ok) {
        const errorData = await startUploadResponse.json();
        throw new Error(errorData.error || 'Failed to initiate multipart upload.');
      }
      const { uploadId, key } = await startUploadResponse.json();

      // 2. Perform the multipart upload using the client-side logic
      await uploadFileInParts(
        selectedFile,
        uploadId,
        key,
        (progress: UploadProgress) => {
          setUploadProgress(progress);
        },
        (parts: { ETag: string; PartNumber: number }[]) => {
          setUploadedParts(parts); // Store the collected parts
        }
      );

      // 3. Complete the upload using the action
      fetcher.submit(
        {
          _action: 'complete',
          uploadId: uploadId,
          key: key,
          parts: JSON.stringify(uploadedParts), // Stringify parts to send via FormData
        },
        { method: 'post', action: '/upload' } // Target the current route's action
      );

    } catch (error: any) {
      console.error('Upload process error:', error);
      setUploadError(error.message || 'An unexpected error occurred during upload.');
      setIsUploading(false);
    }
  };

  // Effect to watch fetcher state for completion/error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        console.log(fetcher.data.message);
        setIsUploading(false);
        // You might want to clear the file input or show a success message
      } else if (fetcher.data.error) {
        setUploadError(fetcher.data.error);
        setIsUploading(false);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const abortUpload = () => {
    if (!isUploading || !loaderData.uploadId || !loaderData.key) return;

    // Trigger the abort action
    fetcher.submit(
      {
        _action: 'abort',
        uploadId: loaderData.uploadId,
        key: loaderData.key,
      },
      { method: 'post', action: '/upload' } // Target the current route's action
    );

    // Also, if you have an AbortController for the XHRs in uploadFileInParts,
    // you would trigger it here. (Need to pass it down or manage it in the actor)
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
    }
    setIsUploading(false);
    setUploadProgress(null);
    setUploadError('Upload aborted by user.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">File Upload to S3</h1>

      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100 mb-4"
        />

        {selectedFile && (
          <p className="text-gray-700 mb-2">Selected File: {selectedFile.name} ({selectedFile.size} bytes)</p>
        )}

        {uploadError && (
          <p className="text-red-600 mb-4">{uploadError}</p>
        )}

        {!isUploading && selectedFile && !uploadProgress?.percentage && (
          <button
            onClick={startUpload}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition duration-300 ease-in-out"
          >
            Start Upload
          </button>
        )}

        {isUploading && (
          <div className="mt-4">
            <p className="text-lg font-semibold text-blue-600">Uploading...</p>
            {uploadProgress && (
              <div className="mt-2 text-gray-700">
                <p>Percentage: {uploadProgress.percentage}%</p>
                <p>Speed: {uploadProgress.speed.value} {uploadProgress.speed.unit}</p>
                <p>Time Left: {uploadProgress.timeLeft.hours}h {uploadProgress.timeLeft.minutes}m {uploadProgress.timeLeft.seconds}s</p>
              </div>
            )}
            <button
              onClick={abortUpload}
              className="w-full mt-4 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition duration-300 ease-in-out"
            >
              Cancel Upload
            </button>
          </div>
        )}

        {!isUploading && uploadProgress?.percentage === 100 && (
          <p className="text-green-600 font-bold mt-4">Upload Complete!</p>
        )}

        {/* This form is used by fetcher.submit for actions */}
        <Form method="post" className="hidden">
          <input type="hidden" name="_action" value="" />
          <input type="hidden" name="uploadId" value="" />
          <input type="hidden" name="key" value="" />
          <input type="hidden" name="parts" value="" />
        </Form>
      </div>
    </div>
  );
}
```
