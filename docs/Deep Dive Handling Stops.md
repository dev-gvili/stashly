Deep Dive: Handling Stops
Handling "Stops" (cancellation or interruption) during a multipart file upload is critical for system stability, resource management, and a good user experience. It involves a coordinated effort between the client and the backend to ensure graceful abortion and thorough resource cleanup.

Here's a detailed description:

## Understanding "Stops" in Multipart Uploads

"Stops" can occur due to various reasons:

1. **Client-Initiated Cancellation:**

- User clicks a "Cancel" button on the UI.
- User closes the browser tab or navigates away from the page.
- Client-side application error (e.g., JavaScript crash).

2. **Network-Related Interruption:**

- Loss of internet connectivity (client or server side).
- Firewall issues, network timeouts.
- Server restarting or becoming temporarily unavailable during part uploads.

3. **Server-Side Interruption:**

- Backend service crash or restart.
- Storage issues (e.g., disk full on a temporary storage, S3 rate limits).
- Internal server errors during part processing or finalization.
- Security policy violations detected server-side.

## The Graceful Abortion Process

The goal of graceful abortion is to stop ongoing operations as cleanly as possible and mark the upload as terminated, preventing further parts from being uploaded or processed.

### 1. Client-Side Actions

- **Detection:**
- **User Cancel Button:** The simplest case. An event listener triggers the abortion logic.
- **Page Navigation/Tab Close:** Modern browsers provide `beforeunload` events, but these are primarily for user warnings, not reliable for initiating backend cancellation. Often, these result in an ungraceful disconnect from the client's perspective, relying on server-side timeouts for cleanup.
- **Network Errors/Timeouts:** The client's HTTP library (e.g., `fetch` with `AbortController`, `XMLHttpRequest`) detects network issues or timeouts on individual part uploads.

- **Initiating Abortion:**
- **`AbortController` (for `fetch`):** This is the modern and preferred way. When the client decides to cancel (e.g., user clicks cancel), it calls `abort()` on the `AbortController` instance. This signals all `fetch` requests associated with that controller to terminate.

```javascript
const controller = new AbortController();
const signal = controller.signal;

// For each part upload
fetch(`/upload/part/${partNumber}`, { method: 'PUT', body: partData, signal })
.then(...)
.catch(error => {
if (error.name === 'AbortError') {
console.log('Upload part aborted');
} else {
console.error('Upload part failed:', error);
}
});

// When user clicks cancel:
document.getElementById('cancelButton').addEventListener('click', () => {
controller.abort();
// Also notify the backend
sendAbortSignalToBackend(uploadId);
});
```

- **`XMLHttpRequest.abort()`:** Similar functionality for older XHR requests.
- **Sending an "Abort" Request to Backend:** Crucially, for explicit cancellations (like a user clicking cancel), the client _should_ send a dedicated API request to the backend (e.g., `DELETE /uploads/{upload_id}` or `POST /uploads/{upload_id}/abort`). This is the most reliable way to inform the server immediately.

- **UI Updates:** Inform the user that the upload has been cancelled or failed.

### 2. Server-Side Actions

The backend system is responsible for tracking the state of each multipart upload and initiating cleanup.

- **Upload State Tracking:**
- A database (e.g., SQL, NoSQL) stores metadata for each ongoing multipart upload:
- `upload_id` (unique identifier)
- `user_id`
- `file_name`, `file_size`
- `status` (e.g., `INITIATED`, `IN_PROGRESS`, `COMPLETED`, `ABORTED`, `FAILED`)
- `parts_completed` (a list or bitmask of successfully uploaded parts)
- `created_at`, `last_updated_at`
- `temporary_storage_path` (e.g., S3 prefix or folder)

- **Handling the Explicit "Abort" Request (e.g., `DELETE /uploads/{upload_id}`):**

1. **Receive Request:** The backend API receives the `DELETE` or `POST /abort` request from the client, containing the `upload_id`.
2. **Validate:** Verify the `upload_id` belongs to the requesting user and is currently `IN_PROGRESS`.
3. **Update Status:** Change the `status` of the `upload_id` in the database to `ABORTED`. This prevents any further `UploadPart` or `CompleteUpload` requests for this `upload_id` from being processed (they would return a 404 or 400).
4. **Initiate Cleanup:** Trigger the backend cleanup process (detailed below) for all temporary parts associated with this `upload_id`. This can be done synchronously for small files, or asynchronously via a message queue (e.g., Kafka, RabbitMQ) or a background job for larger cleanups.
5. **Respond:** Send a 204 No Content or 200 OK response to the client.

- **Handling Unsolicited Interruptions (Network Loss, Client Crash):**
  These are "silent" stops where the client doesn't send an explicit `abort` request. The backend relies on timeouts and background cleanup.

1. **Connection Timeouts:** If a client sending a part suddenly drops connection, the server's HTTP server will eventually timeout the request. Any partial data received for that specific part might be discarded by the web server (e.g., Nginx, Apache, Node.js HTTP module) and not even reach the application layer, or if it does, the application should not mark it as complete.
2. **Idle Timeouts:** If no parts are uploaded for a long period (e.g., several hours or days) for an `IN_PROGRESS` upload, the server considers it stale. This is handled by asynchronous cleanup mechanisms.

## Backend Resource Cleanup

Cleanup ensures that orphaned files and database entries don't consume unnecessary resources.

### 1. Immediate Cleanup (Upon Explicit Abort)

When an `ABORT` request is received:

- **Temporary File Deletion:** The system retrieves the `temporary_storage_path` associated with the `upload_id`.
- If using cloud object storage (e.g., AWS S3, Google Cloud Storage), all objects prefixed with the `upload_id` (e.g., `my-bucket/temp-uploads/{upload_id}/part_1`) are deleted. This is typically efficient.
- If using local disk storage, the directory and all files within it are deleted.
- **Database Record Update:** The `status` field in the `uploads` table is updated to `ABORTED`. While the record might not be immediately deleted (useful for audit trails or debugging), it's marked as inactive.

### 2. Asynchronous/Scheduled Cleanup (For Robustness)

This is crucial for handling "silent" stops where no explicit `abort` request is sent (e.g., network loss, browser crash before `abort` could be sent).

- **Lifecycle Policies (e.g., S3 Bucket Lifecycle Rules):**
- For object storage, this is highly effective. You can configure rules to automatically delete incomplete multipart uploads or objects within a specific prefix (e.g., `/temp-uploads/`) after a certain number of days (e.g., 1 or 7 days). This is the most hands-off and reliable method for cleaning up orphaned parts.
- **Scheduled Background Jobs (Cron Jobs, Lambda Functions, Worker Processes):**
- A nightly or hourly job runs to scan the `uploads` database table.
- It identifies records with `status = IN_PROGRESS` that haven't been `last_updated_at` for a configurable threshold (e.g., 24-48 hours). These are considered "stale" or "orphaned."
- For each stale record:
- The job sets its `status` to `FAILED` or `ABORTED`.
- It then triggers the temporary file deletion process for the `temporary_storage_path` associated with that `upload_id`.
- The job might also periodically scan the temporary storage bucket/directory directly to find any files that exist without a corresponding `IN_PROGRESS` or `COMPLETED` entry in the database, deleting them if they are old enough.

### What Gets Cleaned Up?

- **Temporary Part Files:** The individual chunks uploaded to temporary storage (e.g., `part_1`, `part_2`, etc.).
- **Associated Metadata:** Database entries tracking the upload's state.
- **Any Partially Assembled Files:** If the system attempts an early assembly or processing and fails, those intermediate files should also be targeted for cleanup.

## Key Design Principles for "Stop" Handling

- **Idempotency:** The `abort` endpoint should be idempotent. Calling it multiple times should have the same effect as calling it once (the upload remains `ABORTED` and resources are cleaned up once).
- **Robustness:** Don't rely solely on client-side signals. Implement server-side timeouts and scheduled cleanup jobs to catch orphaned resources.
- **Observability:** Log aborted uploads and cleanup actions. Monitor the number of orphaned resources to ensure cleanup mechanisms are working effectively.
- **Error Handling:** Both client and server should gracefully handle errors during the abortion process itself (e.g., what if the cleanup job fails?).

By combining explicit client-side abortion signals with robust server-side state management, timeouts, and asynchronous cleanup mechanisms, a system can efficiently and gracefully handle "stops" during multipart file uploads, ensuring resource hygiene and a resilient user experience.
