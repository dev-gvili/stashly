/// <reference types="@webgpu/types" />
import { createActor } from 'xstate'
import { pipelineMachine } from '../machines/pipeline/pipeline.machine'
import type { WorkerSnapshot } from '../types/machine.types'

// ── Boot the pipeline machine ────────────────────────────────────────────────

const actor = createActor(pipelineMachine)

// ── Throttled postMessage to avoid flooding the main thread ──────────────────
// Progress events fire hundreds of times/sec during model downloads.
// Without throttling, each triggers a React re-render, blocking the main thread
// and causing "[Violation] 'wheel' input event delayed" warnings.
let pendingMsg: WorkerSnapshot | null = null
let rafScheduled = false
let lastStateValue: string | null = null

function flushToMain() {
  rafScheduled = false
  if (pendingMsg) {
    self.postMessage(pendingMsg)
    pendingMsg = null
  }
}

// Serialize state after every transition and post to the main thread.
// pendingAudio is intentionally excluded — it holds a large Float32Array
// that the main thread never needs.
actor.subscribe((snapshot) => {
  const { value, context } = snapshot
  const msg: WorkerSnapshot = {
    value: value as string,
    context: {
      executionProvider: context.executionProvider,
      gpuInfo: context.gpuInfo,
      fileInfo: context.fileInfo,
      modelName: context.modelName,
      loadingPhases: context.loadingPhases,
      progress: context.progress,
      detectedLanguage: context.detectedLanguage,
      audioDuration: context.audioDuration,
      transcriptProgress: context.transcriptProgress,
      transcript: context.transcript,
      correctedTranscript: context.correctedTranscript,
      // pendingTranscript intentionally excluded — private staging field
      summary: context.summary,
      keywords: context.keywords,
      generatedTags: context.generatedTags,
      error: context.error,
    },
  }

  // State changes (idle → transcribing, etc.) are sent immediately.
  // Progress-only updates are batched and sent at most once per frame (~16ms).
  const stateChanged = value !== lastStateValue
  lastStateValue = value as string

  if (stateChanged) {
    pendingMsg = null
    self.postMessage(msg)
  } else {
    pendingMsg = msg
    if (!rafScheduled) {
      rafScheduled = true
      setTimeout(flushToMain, 16)
    }
  }
})

// Set onmessage BEFORE actor.start() to avoid dropping events sent immediately
// after the worker is created.
self.onmessage = (e: MessageEvent) => {
  actor.send(e.data)
}

actor.start()
