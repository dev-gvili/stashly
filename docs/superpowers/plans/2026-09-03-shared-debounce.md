# Shared Debounce Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four hand-rolled debounce implementations with one framework-free primitive and one thin React wrapper, and get the fiddly timer behaviour under unit test.

**Architecture:** `app/utils/debounce.ts` exports `createDebouncer()` — a plain object with `call(fn, delayMs)`, `cancel()`, `flush()` and `pending`. It has no React dependency, so it serves imperative callers directly and is testable in the existing `environment: 'node'` Vitest setup with `vi.useFakeTimers()`. `app/hooks/useDebouncedCommit.ts` layers the React concern on top: commit a value once it settles, skip values already committed, and hold the callback in a ref so an unstable identity cannot restart the timer forever.

**Tech Stack:** TypeScript (strict), React 19, Vitest (node environment), no new dependencies.

**Spec:** No separate spec document. The survey that motivates this plan is in the Context section below; it was produced by reading every `setTimeout` site under `app/`.

## Global Constraints

- **No new dependencies.** `@testing-library/react` and a DOM environment are explicitly out of scope; that is why the tested logic lives in a plain function.
- Vitest runs `environment: 'node'` (`vitest.config.ts:8`). Unit tests go in `app/utils/__tests__/`.
- Test baseline is **459 passing / 11 failing (470 in 29 files)**. The 11 failures are pre-existing (`activity.test.ts` x4, `collection-actions.test.ts` x7). Do not chase them.
- `pnpm typecheck` baseline is **~202-204 pre-existing errors**. Confirm none are in touched files; do not expect a clean run.
- Cross-directory imports use path aliases (`@/utils/*`, `@/hooks/*`); relative imports only within the same directory.
- `npx prettier --write` only on files this plan **creates**. On modified files, check `git diff` afterwards and revert hunks the edit did not cause.
- Conventional commit prefixes with a body explaining the *why*. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- The shell is **PowerShell**. Bash heredocs are not available for commit messages — write the message to a temp file and use `git commit -F <file>`, or pass repeated single-line `-m` flags.
- Do not restart or kill the dev server. Avoid running `pnpm typecheck` while it is up — `react-router typegen` recreates `.react-router/types`, which has crashed Vite's file watcher on Windows.

## Context: what is being consolidated

Every `setTimeout` under `app/` was read and classified. Three tiers:

**Tier A — imperative, restart-on-call, caller-supplied delay.** Adopts `createDebouncer` directly.

| Site | Delay | Notes |
|---|---|---|
| `app/components/ui/design-canvas.tsx:286` | 200 ms | Needs `flush()` on unmount. **In scope.** |
| `app/.client/monaco-outline.ts:367` | variable | **Out of scope** — see below. |

**Tier B — React, commit a settled value, guarded by a last-committed ref.** Adopts `useDebouncedCommit`.

| Site | Delay | Existing guard |
|---|---|---|
| `app/components/filters/filters.tsx` (`FiltersSearch`) | 200 ms | `lastPushed` |
| `app/components/core-components/move-to-folder-dialog.tsx:178` | 200 ms | none (skips empty query instead) |
| `app/components/upload/upload-thumbnail-runner.tsx:119` | 700 ms | `lastRevalidated` |

Two of these independently invented the same guard ref. That convergence is the evidence this abstraction is real.

**Tier C — not debounces, or not extractable. Do not touch:**

- `app/hooks/useItemSearch.ts:327` — the timer is welded to an `AbortController` and the effect debounces on `[query, mode, filterKey, ...]` together. Routing it through a generic hook would drop the abort or silently change when mode/filter changes fire.
- `app/.client/monaco-outline.ts:367` — four lines, variable delay per call, entangled with a retry budget that resets in two places, and its `dispose()` is already correct (`clearTimeout`, `pending?.cancel()`, every listener disposed). A genuine variant, not a duplicate. Converting it is churn.
- `app/hooks/useClipboard.ts:56` — fixed reset delay after a copy. Not restart-on-change.
- `app/hooks/useAutoHideControls.ts:36` — idle timer reset by events, not by a changing value.
- `app/hooks/useThumbnail.ts:71` — a poll loop.

## File Structure

| File | Responsibility |
|---|---|
| Create `app/utils/debounce.ts` | The primitive. No React. Owns timer lifecycle: schedule, replace, cancel, flush. |
| Create `app/utils/__tests__/debounce.test.ts` | Full behavioural coverage of the primitive with fake timers. |
| Create `app/hooks/useDebouncedCommit.ts` | React wrapper. Owns the committed-value guard and the callback ref. |
| Modify `app/components/filters/filters.tsx` | `FiltersSearch` adopts the hook. |
| Modify `app/components/core-components/move-to-folder-dialog.tsx` | Folder search adopts the hook. |
| Modify `app/components/upload/upload-thumbnail-runner.tsx` | Revalidate-after-upload adopts the hook. |
| Modify `app/components/ui/design-canvas.tsx` | Viewport autosave adopts the primitive directly. |

---

### Task 1: The debounce primitive

**Files:**

- Create: `app/utils/debounce.ts`
- Test: `app/utils/__tests__/debounce.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `createDebouncer(): Debouncer`, and the `Debouncer` interface with `call(fn: () => void, delayMs: number): void`, `cancel(): void`, `flush(): void`, and a readonly `pending: boolean`.

- [ ] **Step 1: Write the failing test**

Create `app/utils/__tests__/debounce.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from '@/utils/debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs the call after the delay', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(199)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('replaces a pending call rather than queueing it', () => {
    const d = createDebouncer()
    const first = vi.fn()
    const second = vi.fn()
    d.call(first, 200)
    vi.advanceTimersByTime(150)
    d.call(second, 200)
    vi.advanceTimersByTime(200)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('restarts the delay on every call', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    for (let i = 0; i < 5; i++) {
      d.call(fn, 100)
      vi.advanceTimersByTime(90)
    }
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the pending call', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush runs the pending call immediately and only once', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('flush with nothing pending is a no-op', () => {
    const d = createDebouncer()
    expect(() => d.flush()).not.toThrow()
  })

  it('reports whether a call is pending', () => {
    const d = createDebouncer()
    expect(d.pending).toBe(false)
    d.call(() => {}, 200)
    expect(d.pending).toBe(true)
    vi.advanceTimersByTime(200)
    expect(d.pending).toBe(false)
  })

  it('is reusable after firing', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 100)
    vi.advanceTimersByTime(100)
    d.call(fn, 100)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('a zero delay still defers past the current tick', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 0)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run app/utils/__tests__/debounce.test.ts`

Expected: FAIL — cannot resolve `@/utils/debounce`.

- [ ] **Step 3: Write the implementation**

Create `app/utils/debounce.ts`:

```ts
/**
 * A restartable trailing-edge timer.
 *
 * Four places in the app hand-rolled this, each slightly differently, and two
 * of them independently invented the same "skip what was already handled"
 * guard. The behaviour that is easy to get wrong lives here so it can be
 * tested: replacing a pending call rather than queueing a second one,
 * cancelling cleanly on teardown, and flushing a pending call synchronously
 * when a component is going away and the write still has to happen.
 *
 * Deliberately framework-free. `app/.client/` modules and imperative callbacks
 * cannot use a hook, and a plain function is testable in the repo's existing
 * `environment: 'node'` Vitest setup without adding a DOM.
 *
 * The delay is passed per call rather than baked in at construction because
 * callers legitimately vary it — an immediate rebuild versus a debounced one.
 */
export interface Debouncer {
  /** Schedule `fn` after `delayMs`, replacing any call already pending. */
  call(fn: () => void, delayMs: number): void
  /** Drop the pending call without running it. */
  cancel(): void
  /** Run the pending call now, if there is one. */
  flush(): void
  /** Whether a call is currently scheduled. */
  readonly pending: boolean
}

/**
 * @example
 * // Imperative caller with a teardown path
 * const saves = createDebouncer()
 * onPan(() => saves.call(() => persist(state), 200))
 * onUnmount(() => saves.flush())
 *
 * @example
 * // Varying the delay per call
 * const rebuilds = createDebouncer()
 * rebuilds.call(build, 0) // first paint
 * rebuilds.call(build, 250) // subsequent edits
 */
export function createDebouncer(): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: (() => void) | null = null

  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    queued = null
  }

  return {
    call(fn, delayMs) {
      if (timer !== null) clearTimeout(timer)
      queued = fn
      timer = setTimeout(() => {
        // Read and clear *before* running: `fn` is free to schedule the next
        // call, and it must not be wiped out by this one's bookkeeping.
        const run = queued
        timer = null
        queued = null
        run?.()
      }, delayMs)
    },
    cancel: clear,
    flush() {
      const run = queued
      clear()
      run?.()
    },
    get pending() {
      return timer !== null
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run app/utils/__tests__/debounce.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Format the new files**

Run: `npx prettier --write app/utils/debounce.ts app/utils/__tests__/debounce.test.ts`

- [ ] **Step 6: Commit**

```bash
git add app/utils/debounce.ts app/utils/__tests__/debounce.test.ts
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
feat(utils): add a shared restartable debounce primitive

Four places hand-rolled this timer, each slightly differently, and two
independently invented the same already-handled guard. Extracting the
primitive rather than a hook is what makes it testable: it has no React
dependency, so it runs under the existing node Vitest environment with
fake timers and no new dependencies.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 2: The React wrapper

**Files:**

- Create: `app/hooks/useDebouncedCommit.ts`

**Interfaces:**

- Consumes: `createDebouncer`, `Debouncer` from `@/utils/debounce`.
- Produces: `useDebouncedCommit<T>(value: T, commit: (value: T) => void, options?: { delayMs?: number; enabled?: boolean }): UseDebouncedCommit<T>`, where `UseDebouncedCommit<T>` is `{ markCommitted: (value: T) => void; flush: () => void; cancel: () => void }`.

**Note on testing:** this hook gets no unit test. Testing it needs a React renderer (`@testing-library/react`) and a DOM environment, both of which the Global Constraints rule out. That is the deliberate trade: everything with real behaviour is in Task 1's tested primitive, and this wrapper is thin enough to review by reading. Its verification is typecheck plus the three adopters in Tasks 3-5.

- [ ] **Step 1: Write the implementation**

Create `app/hooks/useDebouncedCommit.ts`:

```ts
import { useEffect, useMemo, useRef } from 'react'
import { createDebouncer, type Debouncer } from '@/utils/debounce'

/** Matches the delay the adopting call sites already used. */
const DEFAULT_DELAY_MS = 200

export interface UseDebouncedCommit<T> {
  /**
   * Record `value` as already committed and drop anything pending.
   *
   * For a caller whose committed value can change from outside — a URL the
   * user navigated back to, a field cleared by another control — this is what
   * stops the incoming value being immediately echoed back out again.
   */
  markCommitted: (value: T) => void
  /** Commit the pending value now rather than waiting out the delay. */
  flush: () => void
  /** Drop the pending commit. */
  cancel: () => void
}

/**
 * Commit a value once it stops changing, skipping values already committed.
 *
 * The shape three call sites had each built by hand. Two details are easy to
 * get wrong and are handled here once:
 *
 *   • **The committed guard.** Without it, a value arriving from outside is
 *     immediately pushed back out, and a caller writing to shared state
 *     (a URL, a route) loops.
 *   • **The callback ref.** `commit` is usually rebuilt every render — a hook
 *     result, an inline closure. Depending on it directly would clear and
 *     restart the timer on every render, and the debounce would silently
 *     never fire.
 *
 * @param value - The value to commit once it settles.
 * @param commit - Called with the settled value. Identity may change freely.
 * @param options.delayMs - Quiet period before committing. Defaults to 200.
 * @param options.enabled - Pass false to suspend committing entirely.
 *
 * @example
 * // A search field whose text is local and whose URL write is debounced
 * const [text, setText] = useState(query)
 * const { markCommitted } = useDebouncedCommit(text, setQuery)
 * useEffect(() => {
 *   markCommitted(query)
 *   setText(query)
 * }, [query, markCommitted])
 *
 * @example
 * // Coalesce a burst of uploads into one revalidation
 * useDebouncedCommit(createdCount, () => revalidate(), { delayMs: 700 })
 */
export function useDebouncedCommit<T>(
  value: T,
  commit: (value: T) => void,
  options: { delayMs?: number; enabled?: boolean } = {},
): UseDebouncedCommit<T> {
  const { delayMs = DEFAULT_DELAY_MS, enabled = true } = options

  // Created once, lazily — `useRef(createDebouncer())` would build a throwaway
  // on every render.
  const ref = useRef<Debouncer | null>(null)
  if (ref.current === null) ref.current = createDebouncer()
  const debouncer = ref.current

  const committed = useRef(value)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!enabled) return
    if (Object.is(value, committed.current)) return
    debouncer.call(() => {
      committed.current = value
      commitRef.current(value)
    }, delayMs)
    // Covers both a further change to `value` and unmount.
    return () => debouncer.cancel()
  }, [value, delayMs, enabled, debouncer])

  return useMemo(
    () => ({
      markCommitted: (next: T) => {
        committed.current = next
        debouncer.cancel()
      },
      flush: () => debouncer.flush(),
      cancel: () => debouncer.cancel(),
    }),
    [debouncer],
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck 2>&1 | grep -E "useDebouncedCommit|utils/debounce" || echo clean`

Expected: `clean`. (Do not run this while the dev server is up — see Global Constraints.)

- [ ] **Step 3: Format the new file**

Run: `npx prettier --write app/hooks/useDebouncedCommit.ts`

- [ ] **Step 4: Commit**

```bash
git add app/hooks/useDebouncedCommit.ts
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
feat(hooks): add useDebouncedCommit over the debounce primitive

Wraps createDebouncer with the two details the three hand-rolled React
call sites each had to get right: a committed-value guard so a value
arriving from outside is not echoed straight back, and a callback ref so
an unstable commit identity cannot restart the timer every render and
stop it ever firing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 3: Adopt in the filters search field

**Files:**

- Modify: `app/components/filters/filters.tsx` (the `FiltersSearch` component, in the `Search` section)

**Interfaces:**

- Consumes: `useDebouncedCommit` from `@/hooks/useDebouncedCommit`.
- Produces: nothing new.

**Behaviour that must not change:** the field renders local text immediately; the URL is written after a 200 ms pause; an external URL change (back/forward, a removed chip, "Clear all") replaces the field's contents; the component's own write coming back through the URL does not.

- [ ] **Step 1: Replace the body of `FiltersSearch`**

Keep the existing doc comment above the component. Delete the local `URL_WRITE_DEBOUNCE_MS` constant and the two hand-rolled refs, and replace the component body with:

```tsx
function FiltersSearch(
  props: Omit<
    React.ComponentProps<typeof SearchInput>,
    'value' | 'onValueChange' | 'mode' | 'onModeChange'
  >
) {
  const { filters } = useFiltersContext()
  const [text, setText] = useState(filters.state.query)
  const { markCommitted } = useDebouncedCommit(text, filters.setQuery)

  // An external change — back/forward, a removed chip, "Clear all" — has to
  // replace what is in the field. `markCommitted` first, so adopting it does
  // not immediately schedule a write of the value we just received.
  useEffect(() => {
    markCommitted(filters.state.query)
    setText(filters.state.query)
  }, [filters.state.query, markCommitted])

  return (
    <SearchInput
      value={text}
      onValueChange={setText}
      mode={filters.state.searchMode}
      onModeChange={filters.setSearchMode}
      {...props}
    />
  )
}
```

The explicit `lastPushed` comparison in the sync effect is gone because the guard moved into the hook: calling `markCommitted` with a value already committed is harmless, and `setText` with an unchanged string does not re-render.

- [ ] **Step 2: Update the imports**

Add `import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'` alongside the other `@/hooks` imports.

`useRef` may no longer be used by this file. Check before removing it from the `react` import:

Run: `grep -n "useRef" app/components/filters/filters.tsx`

- [ ] **Step 3: Verify types**

Run: `pnpm typecheck 2>&1 | grep "filters.tsx" || echo clean`

Expected: `clean`.

- [ ] **Step 4: Verify in the browser**

With the dev server already running on port 80, open the search page and type a multi-word query quickly. Expected: every character appears immediately and in order; the URL's `q` param updates once typing pauses. Then press browser Back — expected: the field's contents change to the previous query.

This is the regression the primitive exists for, and it cannot be asserted in the node test environment.

- [ ] **Step 5: Check the diff for unrelated reflow**

Run: `git diff app/components/filters/filters.tsx`

Revert any hunk the edit did not cause.

- [ ] **Step 6: Commit**

```bash
git add app/components/filters/filters.tsx
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
refactor(filters): drive the search field with useDebouncedCommit

Same behaviour, with the committed guard and the callback ref now coming
from the shared hook instead of two local refs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 4: Adopt in the move-to-folder dialog

**Files:**

- Modify: `app/components/core-components/move-to-folder-dialog.tsx:177-188`

**Interfaces:**

- Consumes: `useDebouncedCommit` from `@/hooks/useDebouncedCommit`.
- Produces: nothing new.

**Behaviour change to accept knowingly:** this site currently has no committed guard, so it re-issues the search whenever the effect re-runs with a value it has already searched for. After this change it will not. That is a strict improvement, but it *is* a change — verify the dialog still searches when expected in Step 3.

- [ ] **Step 1: Replace the debounced search effect**

Replace:

```tsx
useEffect(() => {
  const q = query.trim()
  if (!q) return
  const timer = setTimeout(() => {
    fetcherModeRef.current = 'search'
    folderFetcher.load(
      `/api/items?intent=search_folders&q=${encodeURIComponent(q)}`
    )
  }, 200)
  return () => clearTimeout(timer)
}, [query])
```

with:

```tsx
// The trimmed query is what gets committed, so leading or trailing
// whitespace does not count as a change and re-run the search.
useDebouncedCommit(query.trim(), (q) => {
  if (!q) return
  fetcherModeRef.current = 'search'
  folderFetcher.load(
    `/api/items?intent=search_folders&q=${encodeURIComponent(q)}`
  )
})
```

- [ ] **Step 2: Add the import**

Add `import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'` alongside the other `@/hooks` imports.

- [ ] **Step 3: Verify types**

Run: `pnpm typecheck 2>&1 | grep "move-to-folder-dialog" || echo clean`

Expected: `clean`.

- [ ] **Step 4: Verify in the browser**

Open the move-to-folder dialog, type a folder name, confirm results appear after the pause. Clear the field and retype the *same* name — results must still appear, proving the guard has not wedged the search.

- [ ] **Step 5: Commit**

```bash
git add app/components/core-components/move-to-folder-dialog.tsx
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
refactor(move-dialog): use useDebouncedCommit for folder search

Also stops re-issuing the same search when the effect re-runs with a
query it has already searched for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 5: Adopt in the upload thumbnail runner

**Files:**

- Modify: `app/components/upload/upload-thumbnail-runner.tsx:27` (constant) and `:119-129` (effect)

**Interfaces:**

- Consumes: `useDebouncedCommit` from `@/hooks/useDebouncedCommit`.
- Produces: nothing new.

- [ ] **Step 1: Replace the debounced revalidate effect**

Replace:

```tsx
useEffect(() => {
  if (createdCount === lastRevalidated.current) return
  const timer = setTimeout(() => {
    lastRevalidated.current = createdCount
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { reset: true },
    })
  }, REVALIDATE_DEBOUNCE_MS)
  return () => clearTimeout(timer)
}, [createdCount, navigate, location.pathname, location.search])
```

with:

```tsx
useDebouncedCommit(
  createdCount,
  () =>
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { reset: true },
    }),
  { delayMs: REVALIDATE_DEBOUNCE_MS },
)
```

Delete the `lastRevalidated` ref and its declaration — the hook's committed guard replaces it exactly. Confirm nothing else reads it:

Run: `grep -n "lastRevalidated" app/components/upload/upload-thumbnail-runner.tsx`

Expected: no matches after the edit.

Keep `const REVALIDATE_DEBOUNCE_MS = 700` at line 27; it is a real per-site value, not a default.

- [ ] **Step 2: Add the import**

Add `import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'` alongside the other `@/hooks` imports.

- [ ] **Step 3: Verify types**

Run: `pnpm typecheck 2>&1 | grep "upload-thumbnail-runner" || echo clean`

Expected: `clean`.

- [ ] **Step 4: Verify in the browser**

Upload several files at once. Expected: the list revalidates **once**, roughly 700 ms after the last item is created — not once per file.

- [ ] **Step 5: Commit**

```bash
git add app/components/upload/upload-thumbnail-runner.tsx
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
refactor(upload): use useDebouncedCommit for post-upload revalidate

The local lastRevalidated ref was the same already-committed guard the
hook now provides.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 6: Adopt the primitive in the design canvas viewport

**Files:**

- Modify: `app/components/ui/design-canvas.tsx` — the `saveT` ref (~line 273), the autosave inside `apply` (~lines 286-289), and the `flush` in the `useLayoutEffect` below it (~lines 292-296)

**Interfaces:**

- Consumes: `createDebouncer`, `Debouncer` from `@/utils/debounce`.
- Produces: nothing new.

This is the Tier A adopter: it is called from an imperative callback and needs a synchronous flush on teardown, so it uses the primitive directly rather than the hook.

- [ ] **Step 1: Replace the timer ref with a debouncer**

Replace:

```tsx
const saveT = useRef<ReturnType<typeof setTimeout>>(undefined)
```

with:

```tsx
const saves = useRef<Debouncer | null>(null)
if (saves.current === null) saves.current = createDebouncer()
```

- [ ] **Step 2: Replace the schedule inside `apply`**

Replace:

```tsx
clearTimeout(saveT.current)
saveT.current = setTimeout(() => {
  try {
    localStorage.setItem(tfKey, JSON.stringify(tf.current))
  } catch {}
}, 200)
```

with:

```tsx
saves.current?.call(() => {
  try {
    localStorage.setItem(tfKey, JSON.stringify(tf.current))
  } catch {}
}, VIEWPORT_SAVE_DEBOUNCE_MS)
```

and add near the other module-level constants in the file:

```tsx
/** Quiet period before a pan or zoom is written to localStorage. */
const VIEWPORT_SAVE_DEBOUNCE_MS = 200
```

- [ ] **Step 3: Replace the flush**

Replace:

```tsx
const flush = () => {
  clearTimeout(saveT.current)
  try {
    localStorage.setItem(tfKey, JSON.stringify(tf.current))
  } catch {}
}
```

with:

```tsx
// Only writes when a save is actually pending. The previous version wrote
// unconditionally, which on an untouched viewport rewrote the value it had
// just read back — same stored result, one less write.
const flush = () => saves.current?.flush()
```

- [ ] **Step 4: Add the import**

Add `import { createDebouncer, type Debouncer } from '@/utils/debounce'`.

- [ ] **Step 5: Verify types**

Run: `pnpm typecheck 2>&1 | grep "design-canvas" || echo clean`

Expected: `clean`.

- [ ] **Step 6: Verify in the browser**

Open a design canvas, pan and zoom, then reload. Expected: the viewport position is restored. Pan and navigate away immediately — expected: the position is still restored on return, proving flush-on-teardown works.

- [ ] **Step 7: Commit**

```bash
git add app/components/ui/design-canvas.tsx
```

Commit message — write it to a file and use `git commit -F <file>`:

```text
refactor(design-canvas): use the shared debouncer for viewport saves

Replaces a hand-rolled timer ref plus an unconditional flush. The flush
now writes only when a save is pending, which on an untouched viewport
skips rewriting the value it just loaded.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 1: Run the whole unit suite**

Run: `pnpm test`

Expected: **468 passing / 11 failing** — the 459 baseline plus Task 1's 9 new tests, with the same 11 pre-existing failures. Any *new* failure is a regression from this plan.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck 2>&1 | grep -c "error TS"`

Expected: ~202-204, matching the baseline. Then confirm none are in touched files:

Run: `pnpm typecheck 2>&1 | grep -E "debounce|useDebouncedCommit|filters.tsx|move-to-folder-dialog|upload-thumbnail-runner|design-canvas" | grep "error TS" || echo clean`

- [ ] **Step 3: Build**

Run: `pnpm build`

This is the only check for the dot-server plugin rule — dev never surfaces it. `app/utils/debounce.ts` and `app/hooks/useDebouncedCommit.ts` import nothing from `@/services/*`, so this should pass, but a new module entering the client graph is exactly the case that rule governs.

- [ ] **Step 4: Confirm nothing out of scope was touched**

Run: `git status --short`

Expected: only the seven files in the File Structure table. In particular `app/.client/monaco-outline.ts` and `app/hooks/useItemSearch.ts` must be untouched.
