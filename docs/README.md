Sure! Here's a visual representation of the file upload state machine:

```
+---------+
|  idle   |◄──┐
+---------+   │
     │        │ CANCEL
     │START   │
     ▼        │
+-----------+ │
| uploading |─┼─────────────┐
+-----------+ │             │
     │        │             │
     │DONE    │FAIL         │PROGRESS (updates progress)
     ▼        ▼             │
+---------+  +---------+    │
| success |  | failure |◄───┘
+---------+  +---------+
                │
                │RETRY
                ▼
           +-----------+
           | uploading |
           +-----------+
```

### 🌀 Legend

- `idle`: Waiting for the user to initiate upload.
- `uploading`: Actively transferring bytes; emits `PROGRESS` events.
- `success`: Completed without issues.
- `failure`: Error occurred during upload (e.g. network failure).
- `cancelled`: Aborted by user before completion.

This diagram uses straight transitions to show control flow. Actions like updating progress are internal to the `uploading` state, while failure or success transition to terminal states.

Want to see this diagram rendered as an image or integrated into documentation? I can generate it visually for you as well ✨.

Here are the three pieces that hook **PAUSE**/​**RESUME** into the upload:

1. The **machine actions** that actually stop (via abort) the in-flight upload actor when you leave the `uploading` state
2. The **transitions** on `PAUSE` and `RESUME` that move the state back and forth
3. The **UI buttons** that send `PAUSE` or `RESUME` to the child interpreter

---

### 1. Machine Actions

```ts
// fileUploadMachine.ts (excerpt)
states: {
  uploading: {
    entry: 'spawnUploader',
    exit: 'cleanupUploader',     // ← on exit (PAUSE, DONE, FAIL, CANCEL), abort the child
    on: {
      PAUSE: 'paused',           // ← move out of uploading
      CANCEL: 'cancelled',
      // …
    }
  },
  paused: {
    on: { RESUME: 'uploading' } // ← back into uploading spawns a fresh uploader
  },
  // …
},
{
  actions: {
    // Spawn your upload actor
    spawnUploader: assign((ctx) => ({
      uploadRef: spawn(uploadHandler, { id: ctx.file.name, input: {...} })
    })),

    // Abort the actor whenever we leave `uploading`
    cleanupUploader: (ctx) => {
      ctx.uploadRef?.send({ type: 'abort' });
    },
  }
}
```

- **`entry: 'spawnUploader'`** starts a new child actor to do the upload.
- **`exit: 'cleanupUploader'`** always runs when you leave `uploading` (for PAUSE, DONE, FAIL, CANCEL) and sends an `{type: 'abort'}` to the actor.

---

### 2. Transitions

```ts
uploading: {
  // …
  on: {
    PAUSE: 'paused',     // stops uploading → runs cleanupUploader
    CANCEL: 'cancelled',
    DONE:    'success',
    FAIL:    'failure'
  }
},
paused: {
  on: {
    RESUME: 'uploading'  // re‐enters uploading → runs spawnUploader again
  }
},
```

- Hitting **PAUSE** transitions you to `paused` (runs `exit` logic to abort in-flight upload).
- Hitting **RESUME** re‐enters `uploading`, which `spawn`s a brand‐new upload actor.

---

### 3. UI Buttons

In your React list of child uploads, you’ll see something like:

```tsx
{
  snapshot.matches('uploading') && (
    <button onClick={() => child.send('PAUSE')}>Pause</button>
  )
}
{
  snapshot.matches('paused') && (
    <button onClick={() => child.send('RESUME')}>Resume</button>
  )
}
```

- When the machine is in `uploading`, clicking **“Pause”** sends `PAUSE` → that triggers `cleanupUploader` → aborts the XHR/S3 actor.
- When in `paused`, clicking **“Resume”** sends `RESUME` → re‐spawns a new actor and restarts the upload.

---

#### Important

This approach **aborts** the current transfer and **restarts** from zero on resume.\
If you need **true byte-range resume** (continues from where you left off), you’ll have to chunk the file or use a multipart‐upload API that supports resuming parts.

Let me know if you’d like to dig into an actual chunked/resumable implementation!

Great—let’s build a small React example that uses @xstate/react to drive the upload machine, rendering a progress bar, Start/Cancel buttons, and error handling.

---

## 1. Install Dependencies

```
npm install xstate @xstate/react
```

---

## 2. Create the [`fileUploadMachine.ts`](https://fileUploadMachine.ts)

```ts
// fileUploadMachine.ts
import { createMachine, assign } from 'xstate'

export interface FileUploadContext {
  file: File | null
  progress: number
  error?: string
}

export type FileUploadEvent =
  | { type: 'START'; file: File }
  | { type: 'PROGRESS'; value: number }
  | { type: 'DONE' }
  | { type: 'FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export const fileUploadMachine = createMachine<
  FileUploadContext,
  FileUploadEvent
>(
  {
    id: 'fileUpload',
    initial: 'idle',
    context: {
      file: null,
      progress: 0,
      error: undefined,
    },
    states: {
      idle: {
        on: {
          START: {
            target: 'uploading',
            actions: assign({
              file: (_, e) => e.file,
              progress: (_) => 0,
              error: (_) => undefined,
            }),
          },
        },
      },
      uploading: {
        invoke: {
          src: (context) => uploadFileWithProgress(context.file!),
        },
        on: {
          PROGRESS: {
            actions: assign({ progress: (_, e) => e.value }),
          },
          DONE: 'success',
          FAIL: {
            target: 'failure',
            actions: assign({ error: (_, e) => e.error }),
          },
          CANCEL: 'cancelled',
        },
      },
      success: { type: 'final' },
      failure: {
        on: {
          RETRY: {
            target: 'uploading',
            actions: assign({
              progress: (_) => 0,
              error: (_) => undefined,
            }),
          },
        },
      },
      cancelled: { type: 'final' },
    },
  },
  {
    services: {
      // Define the upload invoke later
      uploadFileWithProgress: () => Promise.resolve(),
    },
  }
)
```

---

## 3. Implement the Upload Service

```ts
// uploadService.ts
import { ActorRefFrom, assign } from 'xstate'

type UploadCallback = (ev: { type: 'PROGRESS'; value: number }) => void

export function uploadFileWithProgress(
  file: File,
  progressCb: UploadCallback,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      progressCb({
        type: 'PROGRESS',
        value: Math.round((e.loaded / e.total!) * 100),
      })
    }
    xhr.upload.onerror = () => reject(new Error('Upload failed'))
    xhr.upload.onabort = () => reject(new Error('Upload cancelled'))
    xhr.onload = () =>
      xhr.status === 200 ? resolve() : reject(new Error(`Status ${xhr.status}`))

    xhr.open('PUT', '/presign-url-endpoint') // replace with actual URL
    xhr.send(file)

    signal.addEventListener('abort', () => {
      xhr.abort()
    })
  })
}
```

---

## 4. React Component

```tsx
// FileUpload.tsx
import React, { useRef } from 'react'
import { useMachine } from '@xstate/react'
import { fileUploadMachine } from './fileUploadMachine'
import { uploadFileWithProgress } from './uploadService'

export function FileUpload() {
  const [state, send, service] = useMachine(fileUploadMachine, {
    services: {
      uploadFileWithProgress: (ctx) =>
        uploadFileWithProgress(
          ctx.file!,
          (ev) => service.send(ev),
          ctx.signal!
        ),
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef(new AbortController())

  const startUpload = () => {
    if (fileInputRef.current?.files?.[0]) {
      abortControllerRef.current = new AbortController()
      send({ type: 'START', file: fileInputRef.current.files[0] })
    }
  }

  const cancelUpload = () => {
    abortControllerRef.current.abort()
    send('CANCEL')
  }

  return (
    <div>
      {state.matches('idle') && (
        <>
          <input type="file" ref={fileInputRef} />
          <button onClick={startUpload}>Start Upload</button>
        </>
      )}

      {state.matches('uploading') && (
        <>
          <progress value={state.context.progress} max={100} />
          <span>{state.context.progress}%</span>
          <button onClick={cancelUpload}>Cancel</button>
        </>
      )}

      {state.matches('failure') && (
        <>
          <div>Error: {state.context.error}</div>
          <button onClick={() => send('RETRY')}>Retry</button>
        </>
      )}

      {state.matches('success') && <div>Upload complete!</div>}
      {state.matches('cancelled') && <div>Upload cancelled.</div>}
    </div>
  )
}
```

---

### How It Flows

1. **Idle**: Choose a file, click “Start Upload”.
2. **Uploading**: Progress bar updates via XHR events.
3. **Success**: Machine reaches final `success` state.
4. **Failure**: On network error, show retry option.
5. **Cancelled**: Abort signal triggers transition.

This pattern cleanly separates UI, state, and side-effects. You can easily extend it for multi-file uploads by spawning child state machines. Let me know if you need any tweaks!

Absolutely! Here's a simplified and expressive example of an XState file upload machine. It captures the core states and transitions you'd expect for uploading a single file, complete with progress tracking, error handling, and retry logic.

---

## 🚀 Example: File Upload Machine (XState)

```ts
import { createMachine, assign } from 'xstate'

type FileUploadContext = {
  file: File | null
  progress: number
  error?: string
}

type FileUploadEvent =
  | { type: 'START'; file: File }
  | { type: 'PROGRESS'; value: number }
  | { type: 'DONE' }
  | { type: 'FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export const fileUploadMachine = createMachine<
  FileUploadContext,
  FileUploadEvent
>({
  id: 'fileUpload',
  initial: 'idle',
  context: {
    file: null,
    progress: 0,
    error: undefined,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'uploading',
          actions: assign({ file: (_, event) => event.file }),
        },
      },
    },
    uploading: {
      on: {
        PROGRESS: {
          actions: assign({ progress: (_, event) => event.value }),
        },
        DONE: 'success',
        FAIL: {
          target: 'failure',
          actions: assign({ error: (_, event) => event.error }),
        },
        CANCEL: 'cancelled',
      },
    },
    success: {
      type: 'final',
    },
    failure: {
      on: {
        RETRY: {
          target: 'uploading',
          actions: assign({ progress: (_) => 0, error: (_) => undefined }),
        },
      },
    },
    cancelled: {
      type: 'final',
    },
  },
})
```

---

## 🧠 How It Works

| State       | Description                                   |
| ----------- | --------------------------------------------- |
| `idle`      | Waiting to start; user selects a file         |
| `uploading` | Upload is in progress; updates via `PROGRESS` |
| `success`   | Completed upload                              |
| `failure`   | Upload failed; user can trigger `RETRY`       |
| `cancelled` | Upload aborted                                |

---

## 🌈 Add-On Features You Could Layer In

- ✅ Support for multiple files (spawn child machines)
- ⏸️ Pause/resume functionality
- ♻️ Automatic retry with exponential backoff
- 📦 Queue manager (limit concurrent uploads)
- 🔒 Secure abort/rollback flow

---

Would you like me to convert this into a visual flow diagram or expand it with React integration using `@xstate/react`? It’s pretty slick seeing this drive a real progress bar or a modal upload widget.

Here’s a pattern for a true resumable, chunked S3 upload using XState + AWS SDK v3 multipart‐upload. It:

1. Splits the file into parts
2. Initiates a multipart upload (gets an `uploadId`)
3. Uploads each part, one at a time (or in parallel)
4. Tracks ETags for each part
5. On pause/abort, keeps state so you can resume
6. Completes or aborts the multipart upload

---

## 1. Multipart‐Upload Actor

```ts
// multipartActor.ts
import { fromCallback } from 'xstate'
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'auto' })

export const multipartActor = fromCallback<
  { type: 'pause' | 'abort' },
  { file: File; bucket: string; key: string; chunkSize: number }
>(({ sendBack, receive, input }) => {
  const { file, bucket, key, chunkSize } = input

  let uploadId: string
  let paused = false

  // 1. Create a multipart upload
  const init = async () => {
    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
    )
    uploadId = UploadId!
  }

  // 2. Return parts already uploaded (for resume)
  const listUploadedParts = async () => {
    const parts: number[] = []
    let marker: number | undefined
    do {
      const resp = await s3.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        })
      )
      resp.Parts?.forEach((p) => p.PartNumber && parts.push(p.PartNumber))
      marker = resp.NextPartNumberMarker
    } while (marker)
    return new Set(parts)
  }

  // 3. Upload all chunks sequentially
  const uploadParts = async () => {
    const totalChunks = Math.ceil(file.size / chunkSize)
    const doneParts = await listUploadedParts()

    for (let part = 1; part <= totalChunks; part++) {
      if (paused) return // stop if paused
      if (doneParts.has(part)) continue // skip if already done

      const start = (part - 1) * chunkSize
      const end = Math.min(file.size, start + chunkSize)
      const blob = file.slice(start, end)

      const resp = await s3.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          PartNumber: part,
          UploadId: uploadId,
          Body: blob,
        })
      )

      sendBack({
        type: 'PROGRESS',
        progress: Math.round((part / totalChunks) * 100),
      })
      partsETags[part] = resp.ETag!
    }

    // 4. Complete
    if (!paused) {
      const multipartParams = {
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: Object.entries(partsETags).map(([PartNumber, ETag]) => ({
            PartNumber: Number(PartNumber),
            ETag,
          })),
        },
      }
      await s3.send(new CompleteMultipartUploadCommand(multipartParams))
      sendBack({ type: 'DONE' })
    }
  }

  // state to hold ETags
  const partsETags: Record<number, string> = {}

  // kick off
  init()
    .then(uploadParts)
    .catch((err) => sendBack({ type: 'FAIL', error: err.message }))

  // listen for pause/abort
  receive(({ type }) => {
    if (type === 'pause') paused = true
    if (type === 'abort') {
      paused = true
      s3.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        })
      )
      sendBack({ type: 'FAIL', error: 'Aborted' })
    }
  })
})
```

---

## 2. Extended File‐Upload Machine

```ts
// fileUploadMachine.ts
import { createMachine, assign, spawn } from 'xstate'
import { multipartActor } from './multipartActor'

export interface FileCtx {
  file: File
  progress: number
  error?: string
  actor?: any
}

export type FileEvt =
  | { type: 'START'; file: File }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'PROGRESS'; progress: number }
  | { type: 'DONE' }
  | { type: 'FAIL'; error: string }
  | { type: 'CANCEL' }

export const fileMachine = createMachine<FileCtx, FileEvt>(
  {
    id: 'fileUpload',
    initial: 'idle',
    context: { file: null as any, progress: 0 },
    states: {
      idle: {
        on: {
          START: {
            target: 'uploading',
            actions: assign({ file: (_, e) => e.file, progress: () => 0 }),
          },
        },
      },

      uploading: {
        entry: 'spawnMultipart',
        exit: 'stopMultipart',
        on: {
          PROGRESS: { actions: assign({ progress: (_, e) => e.progress }) },
          DONE: 'success',
          FAIL: {
            target: 'failure',
            actions: assign({ error: (_, e) => e.error }),
          },
          PAUSE: 'paused',
          CANCEL: 'cancelled',
        },
      },

      paused: {
        on: {
          RESUME: 'uploading',
          CANCEL: 'cancelled',
        },
      },

      success: { type: 'final' },

      failure: {
        on: { RETRY: 'uploading' },
      },

      cancelled: { type: 'final' },
    },
  },
  {
    actions: {
      spawnMultipart: assign((ctx) => {
        const actor = spawn(multipartActor, {
          id: ctx.file.name,
          input: {
            file: ctx.file,
            bucket: 'your-bucket-name',
            key: ctx.file.name,
            chunkSize: 5 * 1024 * 1024, // 5 MB per part
          },
        })
        return { actor }
      }),

      stopMultipart: (ctx) => {
        ctx.actor?.send({ type: 'abort' })
      },
    },
  }
)
```

---

## 3. React Multi‐Uploader with Pause/Resume

```tsx
// MultiFileUploader.tsx
import React, { useRef } from 'react'
import { useMachine } from '@xstate/react'
import { fileMachine } from './fileUploadMachine'

export function MultiFileUploader() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploads, send] = useMachine(
    createMachine(
      {
        id: 'multi',
        context: { files: [] as File[], uploadRefs: {} as any },
        initial: 'idle',
        states: {
          idle: { on: { ADD: { actions: 'addFiles' }, START: 'uploading' } },
          uploading: {
            entry: 'spawnAll',
            on: { PAUSE_ALL: 'paused', CANCEL_ALL: 'cancelled' },
          },
          paused: { on: { RESUME_ALL: 'uploading', CANCEL_ALL: 'cancelled' } },
          cancelled: { type: 'final' },
        },
      },
      {
        actions: {
          addFiles: assign({
            files: (ctx, e: any) => [...ctx.files, ...e.files],
          }),
          spawnAll: assign((ctx) => {
            const uploadRefs: any = {}
            ctx.files.forEach((file) => {
              uploadRefs[file.name] = spawn(
                fileMachine.withContext({ file, progress: 0 }),
                {
                  name: file.name,
                }
              )
            })
            return { uploadRefs }
          }),
        },
      }
    )
  )

  const onAdd = () => {
    const files = Array.from(fileInput.current!.files!)
    send({ type: 'ADD', files })
  }

  const startAll = () => send('START')
  const pauseAll = () => send('PAUSE_ALL')
  const resumeAll = () => send('RESUME_ALL')
  const cancelAll = () => send('CANCEL_ALL')

  return (
    <div>
      <input type="file" multiple ref={fileInput} />
      <button onClick={onAdd}>Add</button>
      <button onClick={startAll}>Start All</button>
      <button onClick={pauseAll}>Pause All</button>
      <button onClick={resumeAll}>Resume All</button>
      <button onClick={cancelAll}>Cancel All</button>

      <ul>
        {uploads.context.files.map((file) => {
          const child = uploads.context.uploadRefs[file.name]
          const state = child.getSnapshot()

          return (
            <li key={file.name}>
              {file.name} — {state.context.progress}%
              {state.matches('uploading') && (
                <button onClick={() => child.send('PAUSE')}>Pause</button>
              )}
              {state.matches('paused') && (
                <button onClick={() => child.send('RESUME')}>Resume</button>
              )}
              {state.matches('failure') && (
                <button onClick={() => child.send('RETRY')}>Retry</button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

---

### How It Fits Together

- **Chunking & Resume:** We use S3’s multipart API—if you pause, we abort the in‐flight part, but keep `uploadId` + uploaded ETags so resume skips finished parts.
- **XState Machine:** Spawns a child actor per file that drives the chunk upload. Pause/​resume just transitions states and respawns the actor.
- **React UI:** Controls each child machine and also offers global “all‐pause” / “all‐resume.”

This approach works on [Fly.io](https://Fly.io) + Tigris (for metadata) because you only need S3 object storage for chunks—and you can store the `uploadId` & completed ETags in Tigris if you want server‐side resume across browser sessions.
