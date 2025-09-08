Deep Dive: Sending Chunks
The "Sending Chunks" phase is the core of a multipart file upload, where the actual file data is transferred to the storage service. It comes after the initiation phase (where an `UploadId` is typically obtained) and before the completion phase. This phase leverages parallelization, resilience, and security to efficiently upload very large files.

Let's break down its components:

### 1. File Segmentation (Chunking)

Before any data is sent, the large file needs to be divided into smaller, manageable pieces called "chunks" or "parts."

* **How it's Done:**
* **Client-Side Processing:** The segmentation typically happens in the user's browser (JavaScript) or on the client application (Node.js, Python, etc.).
* **`File.slice()` (Browser):** In web applications, the HTML5 `File` API's `slice()` method is crucial. It allows you to select a byte range from a `File` or `Blob` object, effectively creating a new `Blob` representing that chunk without loading the entire file into memory.
* **Stream Reading (Node.js/Backend):** For server-side uploads or command-line tools, file streams are used to read fixed-size byte ranges from the disk.
* **Fixed Chunk Size:** Chunks are usually of a fixed size (e.g., 5 MB, 10 MB, 100 MB). The last chunk will often be smaller than the others, containing the remaining bytes.
* **Minimum/Maximum Size:** Cloud storage providers (like AWS S3) have specific minimum and maximum part sizes (e.g., S3 requires parts to be at least 5 MB, except for the last part).
* **Part Numbering:** Each chunk is assigned a sequential "part number" (e.g., 1, 2, 3...) which is critical for the storage service to reassemble the file in the correct order during the completion phase.

* **Why Segment?**
* **Resilience:** If an upload fails, only the failing chunk needs to be re-uploaded, not the entire file.
* **Parallelization:** Multiple chunks can be uploaded simultaneously, significantly speeding up the overall upload time, especially over high-latency networks.
* **Memory Efficiency:** The client doesn't need to load the entire file into memory at once.
* **Resume Capability:** If an upload is interrupted, it can often resume by only uploading the remaining chunks.
* **Handling Large Files:** Overcomes limitations of single-request uploads (e.g., HTTP timeouts, memory limits).

### 2. The Role of Pre-signed URLs

Pre-signed URLs are a cornerstone of secure and scalable multipart uploads. They enable direct, secure client-to-storage communication without exposing sensitive credentials.

* **The Problem:**
* **Security Risk:** Clients should not possess long-term cloud storage credentials (like API keys or secret access keys) in their code.
* **Server Bottleneck:** If the client uploads to *your* server, which then proxies the data to the cloud storage, your server becomes a bottleneck for large files and high traffic, incurring high bandwidth costs and requiring significant processing power.

* **The Solution: Pre-signed URLs:**
* **Server-Generated Authorization:** When the client is ready to upload a specific chunk (e.g., Part 3), it makes a request to *your* backend server.
* **Authentication & Authorization:** Your backend server authenticates the client (e.g., "Is this user allowed to upload files?") and then, using its *own* secure cloud credentials, generates a temporary, time-limited URL for a specific upload operation.
* **Specific Parameters:** This pre-signed URL is tailored for:
* A specific HTTP method (e.g., `PUT`).
* A specific object key (the file path in storage).
* A specific `UploadId` (obtained from the initiation phase).
* A specific `PartNumber`.
* An expiration time (e.g., 5 minutes, 1 hour).
* Potentially, specific headers that must be included in the client's PUT request (e.g., `Content-Type`).
* **Direct Client-to-Storage Upload:** The client then uses this pre-signed URL to `PUT` the chunk data *directly* to the cloud storage service (e.g., AWS S3, Azure Blob Storage, Google Cloud Storage). Your backend server is no longer in the data path.
* **Security Benefits:**
* **No Credentials on Client:** Client never sees your cloud credentials.
* **Fine-Grained Access:** Each URL can be scoped precisely for a single chunk upload.
* **Time-Limited:** If intercepted, the URL expires, limiting exposure.
* **Scalability Benefits:** Your server is freed from handling the large file data transfer, offloading it to the highly optimized cloud storage infrastructure.

### 3. The Chunk Upload Process

1. **Looping Through Chunks:** The client application iterates through the segmented chunks.
2. **Requesting Pre-signed URLs:** For each chunk (or a batch of chunks, if parallelizing), the client makes a request to its backend server to get a pre-signed URL. This request usually includes the `UploadId` and the `PartNumber` for which the URL is needed.
3. **Uploading the Chunk:** Once the client receives the pre-signed URL, it performs an HTTP `PUT` request directly to that URL, with the chunk's binary data as the request body.
4. **Collecting ETags (or similar identifiers):** Upon successful upload of a chunk, the cloud storage service responds with a unique identifier for that part (e.g., an `ETag` for S3, a content MD5 hash, or a version ID). This identifier, along with the `PartNumber`, must be collected by the client because it's required in the final "completion" step to tell the storage service how to assemble the file.
5. **Error Handling & Retries:** If a chunk upload fails (e.g., network error, server error), the client-side logic should attempt retries for that specific chunk. Exponential backoff is often used.

### 4. Mechanisms for Real-time Progress Tracking

Providing real-time progress feedback is crucial for user experience, especially with large files.

* **Client-Side Tracking (Primary Method):**
* **`XMLHttpRequest.onprogress` Event:** When using `XMLHttpRequest` (XHR) for chunk uploads, the `onprogress` event is fundamental. It fires periodically during the upload, providing `event.loaded` (bytes uploaded so far for *that specific request*) and `event.total` (total bytes of the chunk being uploaded).
* **Calculation for Individual Chunk:** `(event.loaded / event.total) * 100%` gives the progress for the current chunk.
* **Calculation for Overall File Progress:**
* Maintain a running total of `bytesUploadedSuccessfully` for all *completed* chunks.
* Maintain a variable for `currentChunkBytesUploaded` from the active chunk's `onprogress` event.
* Overall progress: `((bytesUploadedSuccessfully + currentChunkBytesUploaded) / totalFileSize) * 100%`.
* This allows a smooth, continuous progress bar even when multiple chunks are uploading in parallel.
* **`fetch` API (More Complex for Progress):** While `fetch` is modern, direct `onprogress` events aren't natively available in the same way as XHR for upload streams. You might need to use `XMLHttpRequest` specifically for upload, or implement custom logic with `TransformStream` and `ReadableStream` to monitor byte writes, which is more complex.
* **UI Updates:** The calculated percentages are then used to update a visual progress bar, percentage text, or other UI elements.

* **Server-Side Tracking (Less Common for Byte-Level Progress During Upload):**
* While the data is primarily going client-to-storage, your backend server might track the *state* of the upload.
* **WebSockets:** Your server could use WebSockets to push higher-level updates to the client (e.g., "Chunk 5/10 uploaded," "File processing started," "Upload complete") once it receives confirmations from the cloud storage or processes other parts of the workflow. This isn't usually for byte-level `onprogress` during the *transfer* itself but rather for overall job status.
* **Polling:** The client could periodically poll your server to ask for the current status of an upload identified by its `UploadId`. This is less real-time and more resource-intensive than client-side `onprogress`.

In summary, the "Sending Chunks" phase is a well-orchestrated dance between client, your backend, and the cloud storage, leveraging segmentation for robustness and parallelization, pre-signed URLs for security and scalability, and client-side event listeners for a responsive user experience.