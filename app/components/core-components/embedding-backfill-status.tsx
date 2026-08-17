/**
 * Live status for the client-side embedding backfill.
 *
 * The runner is deliberately quiet — idle-scheduled, once per tab, silent on
 * failure — which is right until it stops working. Then a drive sits at "0
 * embedded" with nothing to distinguish "never started" from "no WebGPU" from
 * "downloading a 100MB model right now". This panel makes that distinction
 * visible and gives the user the one action that matters: run it again.
 *
 * @see app/hooks/useEmbeddingBackfill.ts
 */
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InfoIcon, LoaderIcon } from '@/components/icons'
import {
  useEmbeddingBackfillState,
  useRetryEmbeddingBackfill,
} from '@/hooks/useEmbeddingBackfill'
import { hasWebGpu, type BackfillPhase } from '@/utils/embedding-backfill'
import { cn } from '@/utils/styles'

/** One line per phase, written to answer "what is it doing right now". */
const PHASE_COPY: Record<BackfillPhase, string> = {
  idle: 'Not started yet this session.',
  scheduled: 'Queued — waiting for the browser to go idle.',
  fetching: 'Looking for passages that still need embedding…',
  embedding:
    'Embedding passages. The first run downloads the model (~100MB), so this can take a while.',
  saving: 'Saving vectors…',
  done: 'Finished for this session.',
  skipped: 'Skipped.',
  failed: 'Stopped with an error.',
}

const ACTIVE_PHASES: ReadonlySet<BackfillPhase> = new Set([
  'scheduled',
  'fetching',
  'embedding',
  'saving',
])

/**
 * Phases during which "Run now" stays pressable.
 *
 * `scheduled` is deliberately not treated as busy here even though it spins the
 * icon: nothing is running yet, and it is the one phase a stalled runner can
 * get stuck in. Disabling the button there removes the only way out.
 */
const BUSY_PHASES: ReadonlySet<BackfillPhase> = new Set([
  'fetching',
  'embedding',
  'saving',
])

function phaseTone(phase: BackfillPhase): string {
  if (phase === 'failed') return 'text-destructive'
  if (phase === 'done') return 'text-muted-foreground'
  return 'text-foreground'
}

export interface EmbeddingBackfillStatusProps {
  /** Chunks still lacking a vector, from `getSearchIndexStats`. */
  pendingChunks: number
  /** Chunks already embedded, from `getSearchIndexStats`. */
  indexedChunks: number
  className?: string
}

export function EmbeddingBackfillStatus({
  pendingChunks,
  indexedChunks,
  className,
}: EmbeddingBackfillStatusProps) {
  const state = useEmbeddingBackfillState()
  const retry = useRetryEmbeddingBackfill()
  const webgpu = hasWebGpu()
  const active = ACTIVE_PHASES.has(state.phase)
  const busy = BUSY_PHASES.has(state.phase)

  const total = pendingChunks + indexedChunks
  const percent = total > 0 ? Math.round((indexedChunks / total) * 100) : 0

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-input bg-card p-3 font-stashly text-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <LoaderIcon className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <InfoIcon className="size-5 shrink-0 text-muted-foreground" />
        )}
        <span className={cn('uppercase', phaseTone(state.phase))}>
          {state.phase}
        </span>
        <span className="text-muted-foreground">
          {PHASE_COPY[state.phase]}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* The single most useful diagnostic: without WebGPU the runner
              throws on its first inference no matter how often it retries. */}
          <Badge
            variant="outline"
            className={cn('gap-1', !webgpu && 'text-destructive')}
          >
            WebGPU {webgpu ? 'available' : 'unavailable'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="font-stashly"
            onClick={retry}
            disabled={busy || pendingChunks === 0}
          >
            {busy ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span className="tabular-nums">
          {indexedChunks.toLocaleString()} of {total.toLocaleString()} passages
          embedded ({percent}%)
        </span>
        {state.embedded > 0 && (
          <span className="tabular-nums">
            {state.embedded.toLocaleString()} this session
          </span>
        )}
        {state.batches > 0 && (
          <span className="tabular-nums">
            {state.batches} batch{state.batches === 1 ? '' : 'es'}
          </span>
        )}
        {state.phase === 'embedding' && state.batchSize > 0 && (
          <span className="tabular-nums">
            {state.batchSize} in flight
          </span>
        )}
      </div>

      {/* Coverage bar — the thing the user actually wants to watch move. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Passages embedded"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {state.reason && (
        <p className="text-muted-foreground text-pretty">{state.reason}</p>
      )}
      {state.error && (
        <p className="text-destructive text-pretty break-words">
          {state.error}
        </p>
      )}
      {!webgpu && (
        <p className="text-muted-foreground text-pretty">
          Embeddings are generated in the browser on WebGPU. Without it this
          backlog can’t be processed here — keyword search is unaffected.
        </p>
      )}
    </div>
  )
}
