/**
 * Client-side reporting for optional pipeline stages that got skipped.
 *
 * The thumbnail stages and the metadata/embedding chain each sit behind a
 * `catch` that returns quietly, so the app keeps working on a browser without
 * WebGPU. The cost of that choice was total blindness: the failure happens on
 * the user's machine, the catch swallows it, and the server logs stay clean.
 * A browser update breaking WebGPU would show up only as users quietly not
 * getting features they were paying for.
 *
 * This sends one counter increment per occurrence — no stack traces, no item
 * ids, no filenames, and nothing that blocks the main thread.
 */
import type { DegradedReason, DegradedStage } from '@/schemas/api.schemas'

/** Capability-level reasons: the whole session is degraded, not one file. */
const CAPABILITY_REASONS: ReadonlySet<DegradedReason> = new Set([
  'webgpu_unavailable',
  'model_load_failed',
])

/**
 * Reported reasons that indicate this browser can't run enhanced features at
 * all. Read by the UI notice; per-file failures deliberately don't set it.
 */
let capabilityDegraded = false

/** Deduplicates within a page load — one bad file type can fire per item. */
const reported = new Set<string>()

const listeners = new Set<() => void>()

export function isCapabilityDegraded(): boolean {
  return capabilityDegraded
}

/**
 * Subscribes to capability-level degradation. Shaped for
 * `useSyncExternalStore`, so the notice can render off a plain module flag
 * without a provider or a polling loop.
 */
export function subscribeCapabilityDegraded(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Test seam. */
export function resetDegradedReports() {
  capabilityDegraded = false
  reported.clear()
}

/**
 * Classifies a thrown value into one of the closed reason codes.
 *
 * Kept coarse on purpose: the reason becomes a Prometheus label, so it has to
 * be a small fixed vocabulary rather than an error message.
 */
export function classifyDegradation(error: unknown): DegradedReason {
  if (typeof navigator !== 'undefined' && !('gpu' in navigator)) {
    return 'webgpu_unavailable'
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('webgpu') || lower.includes('adapter') || lower.includes('gpu')) {
    return 'webgpu_unavailable'
  }
  if (lower.includes('model') || lower.includes('onnx') || lower.includes('load')) {
    return 'model_load_failed'
  }
  if (lower.includes('render') || lower.includes('canvas') || lower.includes('pdf')) {
    return 'render_failed'
  }
  if (lower.includes('unsupported') || lower.includes('mime')) {
    return 'unsupported_input'
  }
  return 'unknown'
}

/**
 * Fire-and-forget report that `stage` was skipped.
 *
 * Uses `sendBeacon` so the report survives the user navigating away mid-run —
 * exactly the case that produced the gap in the first place — and never
 * competes with rendering. Returns whether a report was actually queued, so
 * callers and tests can assert on deduplication.
 *
 * @example
 * catch (err) {
 *   reportDegraded('thumbnail_stage3', classifyDegradation(err))
 * }
 */
export function reportDegraded(stage: DegradedStage, reason: DegradedReason): boolean {
  if (CAPABILITY_REASONS.has(reason) && !capabilityDegraded) {
    capabilityDegraded = true
    for (const listener of listeners) listener()
  }

  const key = `${stage}|${reason}`
  if (reported.has(key)) return false
  reported.add(key)

  if (typeof navigator === 'undefined') return false

  const fd = new FormData()
  fd.append('stage', stage)
  fd.append('reason', reason)

  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/metrics', fd)
      return true
    }
    void fetch('/api/metrics', { method: 'POST', body: fd, keepalive: true }).catch(
      () => null
    )
    return true
  } catch {
    // Telemetry must never become a second failure on an already-degraded
    // client. Swallow and move on.
    return false
  }
}
