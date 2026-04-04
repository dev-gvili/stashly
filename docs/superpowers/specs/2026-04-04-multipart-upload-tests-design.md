# Design: Multipart Upload Tests

**Date:** 2026-04-04  
**Scope:** Unit + E2E tests for `s3.multipart.concurrent.ts` and `s3.multipart.stream.ts`

---

## Context

Two concurrent multipart upload implementations exist side-by-side for comparison:

- `app/machines/multipart/s3.multipart.concurrent.ts` — worker pool, passes `Blob` directly as fetch body
- `app/machines/multipart/s3.multipart.stream.ts` — worker pool, same approach but derived from a streams-based design

Both export the same `streamParts(StreamPartsInput): Promise<void>` interface. Tests must prove they are behaviorally equivalent and protect against future divergence.

---

## Unit Tests

**File:** `app/machines/multipart/__tests__/streamParts.contract.test.ts`  
**Framework:** Vitest 4.1.0  
**Fetch mocking:** `vi.stubGlobal('fetch', vi.fn())` per-test

### Structure

A single `describe.each` parameterizes both implementations:

```ts
describe.each([
  ['concurrent', () => import('../s3.multipart.concurrent')],
  ['stream',     () => import('../s3.multipart.stream')],
])('%s implementation', (_, getModule) => {
  // all scenarios run against both
})
```

### Scenarios

| # | Test name | What it verifies |
|---|-----------|-----------------|
| 1 | Happy path — single chunk | `onDone` called with 1 `CompletedPart`, ETag matches mock |
| 2 | Happy path — multi-chunk | `onDone` called with parts in correct index order, all ETags present |
| 3 | Progress reporting | `onProgress` called after each chunk completes, final percentage = 100 |
| 4 | Empty file | Throws `"Cannot upload an empty file"` immediately |
| 5 | Missing ETag | PUT response returns no ETag header → throws `"Missing ETag for part…"` |
| 6 | Abort mid-upload | `AbortController.abort()` called before all chunks complete → `onDone` never called, AbortError propagates |
| 7 | Pause + resume | `PauseController.pause()` halts new chunks; `resume()` unblocks; upload completes with all parts |
| 8 | Retry on 429 | fetch returns 429 on first call, 200 on retry → `onDone` still called successfully |

### Fetch mock shape

Each test configures `fetch` to return:
1. **Presign call** (`POST /api/s3/upload`): `{ url: 'https://s3.fake/presigned?...' }`
2. **PUT to S3**: 200 with `ETag: '"abc123"'` header

For retry test: first PUT returns 429, second returns 200.

---

## E2E Test

**File:** `tests/e2e/upload.spec.ts`  
**Framework:** Playwright 1.58.2 (Chromium)  
**Auth:** Authenticated `test` fixture from `tests/e2e/fixtures.ts`

### New Page Object

**File:** `tests/e2e/pages/upload.page.ts`

```ts
class UploadPage {
  constructor(private page: Page) {}

  /** Dispatches a synthetic drop event with a programmatically created File */
  async dropFile(file: { name: string; size: number; type: string }): Promise<void>

  /** Waits for the file row with matching name to reach data-state="done" */
  async waitForUploadDone(fileName: string, timeout?: number): Promise<void>
}
```

**File injection approach:** `page.evaluate()` creates a synthetic `File` object and dispatches a native `drop` event on the `DropArea` element. This bypasses the OS file picker and `DataTransfer`/`FileSystemEntry` APIs that Playwright cannot inject directly.

### Spec

```ts
test.describe('File upload', () => {
  test('dropping a file uploads it and shows done state', async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)

    await uploadPage.dropFile({ name: 'e2e-test.txt', size: 10_000, type: 'text/plain' })
    await uploadPage.waitForUploadDone('e2e-test.txt')
  })
})
```

**Success criterion:** The `<li>` element with `data-state="done"` is visible for the uploaded file name. This exercises the full stack: drop handler → XState upload machine → multipart API → S3 presign → PUT → complete → XState done state → UI update.

---

## File Map

| File | Action |
|------|--------|
| `app/machines/multipart/__tests__/streamParts.contract.test.ts` | **Create** |
| `tests/e2e/pages/upload.page.ts` | **Create** |
| `tests/e2e/upload.spec.ts` | **Create** |

No existing files are modified.

---

## Out of Scope

- Testing `s3.mulipart.utils.ts` actors (XState `fromCallback` / `fromPromise` wrappers) — covered by integration via E2E
- Testing `file.machine.ts` state transitions — separate concern
- DB/API assertions in E2E (UI done state is sufficient per design decision)
