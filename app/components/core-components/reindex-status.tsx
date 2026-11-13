/**
 * Trigger and status for the server-side text re-index.
 *
 * Text extraction runs in the browser at upload time, which leaves two
 * permanent holes nothing else can fill: a document uploaded before that
 * pipeline shipped was never extracted, and one extracted by an older parser
 * keeps whatever that version produced. The embedding backfill can't help —
 * it only fills in vectors for passages that already exist.
 *
 * This panel is the only way to notice either. It stays hidden when there is
 * nothing to rebuild, so a healthy drive never sees it.
 *
 * @see app/.server/search-actions.ts → `reindexTextItems`
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InfoIcon, LoaderIcon, RefreshIcon } from '@/components/icons'
import { cn } from '@/utils/styles'

/**
 * Documents per request.
 *
 * The server rebuilds these six at a time (`REINDEX_CONCURRENCY`) and each one
 * costs a ranged S3 read (~223 ms measured), so 25 is roughly a one-second
 * request — big enough that the round trip isn't the dominant cost, small
 * enough to keep a response well inside any proxy timeout.
 */
const BATCH_SIZE = 25

/**
 * Runaway guard on the drain loop, not a policy — 100 passes is 2,500
 * documents. The loop's real exit is an empty queue.
 */
const MAX_PASSES = 100

/**
 * How many candidates the panel lists.
 *
 * It is a *sample*, not a census: the real backlog reached 452 while this
 * returned 50, and the panel said "50 documents can't be searched by content
 * yet". A saturated probe is reported as "at least" rather than as a count, so
 * the number on screen is never smaller than the truth.
 */
const PROBE_LIMIT = 50

type ReindexReason = 'missing' | 'truncated' | 'unstructured' | 'outdated'

/** Badge wording per reason — each is a different failure, not a severity. */
const REASON_LABEL: Record<ReindexReason, string> = {
  missing: 'never indexed',
  truncated: 'incomplete',
  unstructured: 'no page or section',
  outdated: 'passages out of date',
}

interface ReindexCandidate {
  id: string
  name: string
  reason: ReindexReason
  indexedChars: number
  fileBytes: number
}

interface ReindexRun {
  done: { itemId: string; name: string; chars: number; chunks: number }[]
  failed: { itemId: string; name: string; error: string }[]
  remaining: number
}

export interface ReindexStatusProps {
  className?: string
  /** Called after a batch lands, so the page can re-read index coverage. */
  onComplete?: () => void
}

export function ReindexStatus({ className, onComplete }: ReindexStatusProps) {
  const [candidates, setCandidates] = useState<ReindexCandidate[] | null>(null)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<ReindexRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(
        `/api/items?intent=reindex_candidates&limit=${PROBE_LIMIT}`,
        { signal }
      )
      if (!res.ok) return
      const body = (await res.json()) as { candidates: ReindexCandidate[] }
      setCandidates(body.candidates)
    } catch {
      // A failed probe is not worth surfacing — the panel simply stays hidden.
    }
  }, [])

  /** Cancels an in-flight drain when the panel unmounts. */
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // A drain now spans many requests, so leaving the page has to stop it rather
  // than let it keep firing against a route nobody is watching.
  useEffect(() => () => abortRef.current?.abort(), [])

  /**
   * Rebuild until the queue is empty, not until one batch is done.
   *
   * One request per click was the single biggest cost in the whole indexing
   * story: a 477-document backlog at ten per press is 48 presses, each waiting
   * on a human. The work itself is server-side and takes about a second a
   * batch. Progress is published after every pass, so the panel counts up
   * rather than sitting on a spinner.
   */
  const start = useCallback(async () => {
    setRunning(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    const done: ReindexRun['done'] = []
    const failed: ReindexRun['failed'] = []
    let lastRemaining = Number.POSITIVE_INFINITY

    try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const fd = new FormData()
        fd.append('intent', 'reindex_text')
        fd.append('limit', String(BATCH_SIZE))

        const res = await fetch('/api/items', {
          method: 'POST',
          body: fd,
          signal: controller.signal,
        })
        const body = (await res.json()) as ReindexRun & {
          success?: boolean
          error?: string
        }
        if (!res.ok || body.success === false) {
          throw new Error(body.error ?? `Re-index failed: ${res.status}`)
        }

        done.push(...body.done)
        failed.push(...body.failed)
        setRun({ done: [...done], failed: [...failed], remaining: body.remaining })

        // A pass that rebuilt nothing means every candidate left is failing.
        // They stay in the queue by definition, so looping again would repeat
        // the same failures until MAX_PASSES — an infinite spinner in practice.
        if (body.remaining === 0 || body.done.length === 0) break

        // Rebuilding successfully is not the same as making progress. A
        // candidate predicate a repair cannot satisfy re-queues the document it
        // just fixed, and the loop reports thousands of rebuilds against a
        // queue that never moves — which is exactly what a too-strict staleness
        // check did here. The server-side predicate is fixed, but a queue that
        // stops shrinking is the symptom of a whole *class* of such bugs, so
        // stop rather than spin and let the count on screen show it.
        if (body.remaining >= lastRemaining) break
        lastRemaining = body.remaining
      }
      await load(controller.signal)
      onComplete?.()
    } catch (e) {
      if (controller.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Re-index failed')
    } finally {
      setRunning(false)
    }
  }, [load, onComplete])

  // Nothing stale and nothing just rebuilt — a healthy drive shows no panel.
  if (!candidates?.length && !run) return null

  const pending = candidates?.length ?? 0
  // A full probe means there are at least this many, not exactly this many.
  // The last run's `remaining` is a real count, so prefer it when we have one.
  const saturated = pending >= PROBE_LIMIT
  const known = run?.remaining && run.remaining > pending ? run.remaining : null
  const byReason = (reason: ReindexReason) =>
    candidates?.filter((c) => c.reason === reason).length ?? 0

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-input bg-card p-3 font-stashly text-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <LoaderIcon className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <InfoIcon className="size-5 shrink-0 text-muted-foreground" />
        )}
        <span className="uppercase">Search index</span>
        <span className="text-muted-foreground text-pretty">
          {pending > 0
            ? `${known ?? pending}${saturated && !known ? '+' : ''} document${(known ?? pending) === 1 ? '' : 's'} can’t be searched by content yet.`
            : 'Every text document is indexed.'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {(
            ['missing', 'truncated', 'unstructured', 'outdated'] as const
          ).map((reason) => {
            const count = byReason(reason)
            if (count === 0) return null
            return (
              <Badge
                key={reason}
                variant="outline"
                className="tabular-nums"
              >
                {count} {REASON_LABEL[reason]}
              </Badge>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            className="font-stashly"
            onClick={start}
            disabled={running || pending === 0}
          >
            {running ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Rebuilding…
              </>
            ) : (
              <>
                <RefreshIcon className="size-4" />
                Rebuild {saturated && !known ? 'all' : (known ?? pending) || ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Why a document is here matters: "never indexed" is a coverage gap,
          "incomplete" means an older parser wrote a fraction of the body. */}
      {pending > 0 && !running && (
        <ul className="flex flex-col gap-0.5 text-muted-foreground">
          {candidates?.slice(0, 4).map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 truncate">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-xs tabular-nums opacity-70">
                {c.reason === 'missing'
                  ? 'no content indexed'
                  : c.reason === 'unstructured'
                    ? 'indexed without line breaks'
                    : c.reason === 'outdated'
                      ? 'passages older than the body'
                      : `${c.indexedChars} of ~${c.fileBytes} chars`}
              </span>
            </li>
          ))}
          {pending > 4 && (
            <li className="text-xs opacity-70">and {pending - 4} more</li>
          )}
        </ul>
      )}

      {run && (
        <p className="text-muted-foreground text-pretty">
          Rebuilt {run.done.length} document{run.done.length === 1 ? '' : 's'} (
          {run.done.reduce((sum, d) => sum + d.chunks, 0)} passages).
          {run.remaining > 0 && ` ${run.remaining} still queued.`}
          {run.done.length > 0 &&
            ' New passages need embedding before semantic search can use them.'}
        </p>
      )}

      {run?.failed.length ? (
        <p className="text-destructive text-pretty wrap-break-word">
          {run.failed.length} failed: {run.failed[0].name} —{' '}
          {run.failed[0].error}
        </p>
      ) : null}

      {error && (
        <p className="text-destructive text-pretty wrap-break-word">{error}</p>
      )}
    </div>
  )
}
