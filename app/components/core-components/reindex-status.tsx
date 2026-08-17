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
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InfoIcon, LoaderIcon, RefreshIcon } from '@/components/icons'
import { cn } from '@/utils/styles'

/** Matches the server's per-request cap so the UI can't ask for more. */
const BATCH_SIZE = 10

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
      const res = await fetch('/api/items?intent=reindex_candidates&limit=50', {
        signal,
      })
      if (!res.ok) return
      const body = (await res.json()) as { candidates: ReindexCandidate[] }
      setCandidates(body.candidates)
    } catch {
      // A failed probe is not worth surfacing — the panel simply stays hidden.
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const start = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('intent', 'reindex_text')
      fd.append('limit', String(BATCH_SIZE))

      const res = await fetch('/api/items', { method: 'POST', body: fd })
      const body = (await res.json()) as ReindexRun & {
        success?: boolean
        error?: string
      }
      if (!res.ok || body.success === false) {
        throw new Error(body.error ?? `Re-index failed: ${res.status}`)
      }
      setRun(body)
      await load()
      onComplete?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-index failed')
    } finally {
      setRunning(false)
    }
  }, [load, onComplete])

  // Nothing stale and nothing just rebuilt — a healthy drive shows no panel.
  if (!candidates?.length && !run) return null

  const pending = candidates?.length ?? 0
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
            ? `${pending} document${pending === 1 ? '' : 's'} can’t be searched by content yet.`
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
                className="gap-1 tabular-nums"
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
                Rebuild {Math.min(pending, BATCH_SIZE) || ''}
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
