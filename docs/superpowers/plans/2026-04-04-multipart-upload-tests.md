# Multipart Upload Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests (Vitest) and an E2E test (Playwright) that verify both `s3.multipart.concurrent.ts` and `s3.multipart.stream.ts` behave identically and that a file drop in the UI reaches the `done` state.

**Architecture:** A single parameterized unit test suite (`describe.each`) runs the same 8 scenarios against both implementations, proving equivalence. A Playwright E2E test drops a synthetic file on the `DropArea`, waits for `data-state="done"` on the item row. A `UploadPage` POM encapsulates the drop and assertion logic.

**Tech Stack:** Vitest 4.1.0 (Node 22, globals enabled), Playwright 1.58.2, `vi.stubGlobal` for fetch mocking, `vi.useFakeTimers` for retry delay control.

---

## File Map

| File | Action |
|------|--------|
| `app/machines/multipart/__tests__/streamParts.contract.test.ts` | Create |
| `tests/e2e/pages/upload.page.ts` | Create |
| `tests/e2e/upload.spec.ts` | Create |
| `app/components/upload/index.tsx` | Modify — add `data-testid="upload-drop-area"` to `DropArea` in `UploadPanel` |

---

## Task 1: Unit test infrastructure + happy path

**Files:**
- Create: `app/machines/multipart/__tests__/streamParts.contract.test.ts`

- [ ] **Step 1: Create the test file with shared infrastructure and happy-path tests**

```ts
// app/machines/multipart/__tests__/streamParts.contract.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CompletedPart } from '@aws-sdk/client-s3'
import {
  streamParts as concurrentStreamParts,
  PauseController,
} from '../s3.multipart.concurrent'
import { streamParts as streamStreamParts } from '../s3.multipart.stream'
import type { StreamPartsInput } from '../s3.multipart.concurrent'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a File of exactly `sizeBytes` filled with zeros. Node 22 has File as a global. */
function makeFile(sizeBytes: number, name = 'test.bin'): File {
  return new File([new Uint8Array(sizeBytes)], name, {
    type: 'application/octet-stream',
  })
}

const PRESIGN_URL = 'https://s3.fake/part-upload'

/** Returns a Response-like object for POST /api/s3/upload (presign call). */
function presignResponse(url = PRESIGN_URL) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ url }),
    headers: { get: () => null },
  })
}

/** Returns a Response-like object for PUT to S3 (the actual chunk upload). */
function putResponse(etag = '"abc123"') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    headers: { get: (name: string) => (name === 'ETag' ? etag : null) },
  })
}

/**
 * Default fetch mock: POST to /api/s3/upload returns presign URL,
 * PUT to PRESIGN_URL returns 200 with ETag.
 */
function defaultFetchMock(url: string) {
  if (url === PRESIGN_URL) return putResponse()
  return presignResponse()
}

// ─── Base input factory ───────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<StreamPartsInput> & { file: File }
): StreamPartsInput {
  return {
    uploadId: 'test-upload-id',
    key: 'test/key.bin',
    onProgress: vi.fn(),
    onDone: vi.fn(),
    abortController: new AbortController(),
    concurrency: 2,
    ...overrides,
  }
}

// ─── Contract suite ───────────────────────────────────────────────────────────

describe.each([
  ['concurrent', concurrentStreamParts],
  ['stream', streamStreamParts],
] as const)('%s implementation', (_name, streamParts) => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockImplementation(defaultFetchMock)
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ── Happy path: single chunk ────────────────────────────────────────────────

  it('calls onDone with one CompletedPart for a single-chunk file', async () => {
    const onDone = vi.fn()
    const file = makeFile(1024) // 1 KB — well under the 5 MB chunk size

    await streamParts(makeInput({ file, onDone }))

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(1)
    expect(parts[0].PartNumber).toBe(1)
    expect(parts[0].ETag).toBe('"abc123"') // parseEtag strips+rewraps quotes
  })

  // ── Happy path: multi-chunk ─────────────────────────────────────────────────

  it('calls onDone with parts in correct order for a multi-chunk file', async () => {
    const CHUNK = 5 * 1024 * 1024 // 5 MB
    // 2 chunks: first full (5 MB), second partial (100 bytes)
    const file = makeFile(CHUNK + 100)

    // Return distinct ETags per part so we can verify ordering
    let putCall = 0
    mockFetch.mockImplementation((url: string) => {
      if (url === PRESIGN_URL) {
        putCall++
        return putResponse(`"etag-part-${putCall}"`)
      }
      return presignResponse()
    })

    const onDone = vi.fn()
    await streamParts(makeInput({ file, onDone, concurrency: 1 }))

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(2)
    expect(parts[0].PartNumber).toBe(1)
    expect(parts[1].PartNumber).toBe(2)
    // ETags are non-null (exact values depend on call order under concurrency)
    expect(parts[0].ETag).toMatch(/^"etag-part-\d+"$/)
    expect(parts[1].ETag).toMatch(/^"etag-part-\d+"$/)
  })

  // ── Progress reporting ──────────────────────────────────────────────────────

  it('reports progress for each chunk and reaches 100% by the end', async () => {
    const CHUNK = 5 * 1024 * 1024
    const file = makeFile(CHUNK + 100) // 2 chunks

    const onProgress = vi.fn()
    await streamParts(makeInput({ file, onProgress, concurrency: 1 }))

    expect(onProgress).toHaveBeenCalled()
    const calls = onProgress.mock.calls.map((c) => c[0].percentage as number)
    // Progress should be monotonically non-decreasing
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1])
    }
    // Final call should report 100%
    expect(calls[calls.length - 1]).toBe(100)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they pass**

```bash
pnpm test -- streamParts.contract
```

Expected: `6 tests passed` (3 scenarios × 2 implementations). If a test fails, examine the output — likely a type mismatch in the mock response shape.

- [ ] **Step 3: Commit**

```bash
git add app/machines/multipart/__tests__/streamParts.contract.test.ts
git commit -m "test(multipart): add contract tests — happy path (both implementations)"
```

---

## Task 2: Unit test — edge cases (empty file, missing ETag, abort)

**Files:**
- Modify: `app/machines/multipart/__tests__/streamParts.contract.test.ts`

Add these three tests inside the `describe.each` block, after the progress test.

- [ ] **Step 1: Add the three edge-case tests inside the existing `describe.each` block**

```ts
  // ── Empty file ──────────────────────────────────────────────────────────────

  it('throws immediately for an empty file', async () => {
    const file = makeFile(0)
    await expect(
      streamParts(makeInput({ file }))
    ).rejects.toThrow('Cannot upload an empty file')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Missing ETag ────────────────────────────────────────────────────────────

  it('throws when S3 returns no ETag header', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === PRESIGN_URL) {
        // PUT response with no ETag header
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
          headers: { get: () => null }, // ETag missing
        })
      }
      return presignResponse()
    })

    const file = makeFile(1024)
    await expect(
      streamParts(makeInput({ file }))
    ).rejects.toThrow('Missing ETag for part 1')
  })

  // ── Abort before upload starts ──────────────────────────────────────────────

  it('propagates AbortError and never calls onDone when aborted before start', async () => {
    const abortController = new AbortController()
    abortController.abort() // abort before streamParts is called

    const onDone = vi.fn()
    const file = makeFile(1024)

    await expect(
      streamParts(makeInput({ file, abortController, onDone }))
    ).rejects.toThrow('AbortError')

    expect(onDone).not.toHaveBeenCalled()
    // fetch should not have been called since abort is detected first
    expect(mockFetch).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test -- streamParts.contract
```

Expected: `12 tests passed` (6 scenarios × 2 implementations). If the AbortError test fails, check that `DOMException` is a global in Node 22 (it is). If `rejects.toThrow('AbortError')` doesn't match, use `.rejects.toMatchObject({ name: 'AbortError' })` instead.

- [ ] **Step 3: Commit**

```bash
git add app/machines/multipart/__tests__/streamParts.contract.test.ts
git commit -m "test(multipart): add edge-case contract tests (empty file, missing ETag, abort)"
```

---

## Task 3: Unit test — pause/resume and retry on 429

**Files:**
- Modify: `app/machines/multipart/__tests__/streamParts.contract.test.ts`

Add these two tests inside the `describe.each` block.

- [ ] **Step 1: Add the pause/resume test**

```ts
  // ── Pause + resume ──────────────────────────────────────────────────────────

  it('halts new chunks while paused and completes after resume', async () => {
    const CHUNK = 5 * 1024 * 1024
    const file = makeFile(CHUNK + 100) // 2 chunks, concurrency=1 ensures serial order
    const pauseController = new PauseController()
    const onDone = vi.fn()

    // After the first PUT completes, pause before the second chunk starts.
    // fetchCallCount tracks PUT calls (odd calls are presigns, even are PUTs with concurrency=1).
    let fetchCallCount = 0
    mockFetch.mockImplementation((url: string) => {
      fetchCallCount++
      if (url === PRESIGN_URL) {
        return putResponse(`"etag-${fetchCallCount}"`)
      }
      // After the first PUT response is delivered, pause
      if (fetchCallCount === 2) {
        // Pause synchronously so the next worker iteration blocks
        setTimeout(() => pauseController.pause(), 0)
      }
      return presignResponse()
    })

    const uploadPromise = streamParts(
      makeInput({ file, onDone, pauseController, concurrency: 1 })
    )

    // Give the first chunk time to complete and the pause to take effect
    await new Promise<void>((resolve) => setTimeout(resolve, 50))

    // Upload should not have finished yet (paused after chunk 1)
    expect(onDone).not.toHaveBeenCalled()

    // Resume — the second chunk should now complete
    pauseController.resume()
    await uploadPromise

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(2)
  })
```

- [ ] **Step 2: Add the retry on 429 test**

```ts
  // ── Retry on 429 ───────────────────────────────────────────────────────────

  it('retries after a 429 response and still calls onDone', async () => {
    vi.useFakeTimers()

    let putAttempts = 0
    mockFetch.mockImplementation((url: string) => {
      if (url === PRESIGN_URL) {
        putAttempts++
        if (putAttempts === 1) {
          // First attempt: 429 Too Many Requests
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({}),
            headers: { get: () => null },
          })
        }
        // Second attempt: success
        return putResponse()
      }
      return presignResponse()
    })

    const onDone = vi.fn()
    const file = makeFile(1024)
    const uploadPromise = streamParts(makeInput({ file, onDone }))

    // Advance all pending timers (the retry delay setTimeout)
    await vi.runAllTimersAsync()
    await uploadPromise

    expect(onDone).toHaveBeenCalledOnce()
    expect(putAttempts).toBe(2) // first attempt 429, second attempt 200

    vi.useRealTimers()
  })
```

- [ ] **Step 3: Run all unit tests**

```bash
pnpm test -- streamParts.contract
```

Expected: `16 tests passed` (8 scenarios × 2 implementations).

- [ ] **Step 4: Commit**

```bash
git add app/machines/multipart/__tests__/streamParts.contract.test.ts
git commit -m "test(multipart): add pause/resume and retry-on-429 contract tests"
```

---

## Task 4: Add `data-testid` to DropArea and create UploadPage POM

**Files:**
- Modify: `app/components/upload/index.tsx` — line ~847 inside `UploadPanel`
- Create: `tests/e2e/pages/upload.page.ts`

- [ ] **Step 1: Add `data-testid="upload-drop-area"` to the DropArea in UploadPanel**

In `app/components/upload/index.tsx`, find the `DropArea` inside `UploadPanel` (around line 847) and add the attribute:

```tsx
// Before:
<DropArea className="border-none h-auto p-0">

// After:
<DropArea className="border-none h-auto p-0" data-testid="upload-drop-area">
```

- [ ] **Step 2: Create the UploadPage POM**

```ts
// tests/e2e/pages/upload.page.ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class UploadPage {
  constructor(private readonly page: Page) {}

  /**
   * Dispatches a synthetic drop event on the DropArea with a programmatically
   * created File. Uses page.evaluate because Playwright cannot natively inject
   * FileSystemEntry objects into DataTransfer — but the DropArea falls back to
   * `item.getAsFile()` when `webkitGetAsEntry()` returns null, which is the
   * case for DataTransfer items created via DataTransfer.items.add(file).
   */
  async dropFile(file: {
    name: string
    sizeBytes: number
    type: string
  }): Promise<void> {
    await this.page.evaluate(
      ({ name, sizeBytes, type }) => {
        const dropArea = document.querySelector(
          '[data-testid="upload-drop-area"]'
        )
        if (!dropArea) throw new Error('DropArea not found')

        const fileData = new Uint8Array(sizeBytes)
        const syntheticFile = new File([fileData], name, { type })

        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(syntheticFile)

        const dropEvent = new DragEvent('drop', {
          dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        dropArea.dispatchEvent(dropEvent)
      },
      { name: file.name, sizeBytes: file.sizeBytes, type: file.type }
    )
  }

  /**
   * Waits for the upload item row to reach data-state="done".
   * The row is identified by the visible file name text.
   */
  async waitForUploadDone(
    fileName: string,
    timeout = 30_000
  ): Promise<void> {
    await expect(
      this.page
        .locator('li[data-state="done"]')
        .filter({ hasText: fileName })
    ).toBeVisible({ timeout })
  }
}
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
pnpm typecheck 2>&1 | grep -E "upload\.(page|index)"
```

Expected: no output (no errors in these files).

- [ ] **Step 4: Commit**

```bash
git add app/components/upload/index.tsx tests/e2e/pages/upload.page.ts
git commit -m "test(e2e): add UploadPage POM and data-testid to DropArea for testability"
```

---

## Task 5: E2E upload spec

**Files:**
- Create: `tests/e2e/upload.spec.ts`

- [ ] **Step 1: Create the spec file**

```ts
// tests/e2e/upload.spec.ts
import { test, expect } from './fixtures'
import { UploadPage } from './pages/upload.page'
import { TEST_USER_ID } from './constants'

test.describe('File upload', () => {
  test('dropping a file shows it in the upload panel and reaches done state', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)

    await page.goto(`/${TEST_USER_ID}/stash`)

    // Wait for the stash page to be fully loaded before dropping
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toBeVisible()

    await uploadPage.dropFile({
      name: 'e2e-upload-test.txt',
      sizeBytes: 10_000, // 10 KB — fast to upload, well under the 5 MB chunk size
      type: 'text/plain',
    })

    // The upload panel should appear and the item row should eventually show done
    await uploadPage.waitForUploadDone('e2e-upload-test.txt')
  })
})
```

- [ ] **Step 2: Start the dev server and run the E2E test**

In a separate terminal, ensure the dev server is running:
```bash
pnpm dev
```

Then run the E2E test:
```bash
pnpm exec playwright test tests/e2e/upload.spec.ts --headed
```

Expected: 1 test passes. The upload panel should appear, show a progress ring, and transition to the checkmark done state.

If the test times out at `waitForUploadDone`: open `--headed` mode and observe whether the upload panel appears at all. Common causes:
- The drop event isn't reaching the DropArea handler — confirm `data-testid="upload-drop-area"` is on the correct element.
- The upload config (`user`) isn't initialized — the `Upload` component's `useEffect` sends `upload.config` only after mount; adding a short `page.waitForTimeout(500)` after `goto` can help if the machine isn't ready.

- [ ] **Step 3: Run all unit tests one final time to confirm nothing is broken**

```bash
pnpm test
```

Expected: 16 tests passed (all contract tests).

- [ ] **Step 4: Final commit**

```bash
git add tests/e2e/upload.spec.ts
git commit -m "test(e2e): add upload drop-to-done E2E test"
```

---

## Verification Summary

| Check | Command | Expected |
|---|---|---|
| Unit tests | `pnpm test -- streamParts.contract` | 16 passed |
| All unit tests | `pnpm test` | all passed |
| E2E | `pnpm exec playwright test tests/e2e/upload.spec.ts` | 1 passed |
| TypeScript | `pnpm typecheck` | no new errors |
