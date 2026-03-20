/// <reference types="@webgpu/types" />
import { createActor } from 'xstate'
import { pipelineMachine } from '../machines/stash/pipeline.machine'
import type { WorkerSnapshot } from '../types/machine.types'

// ── Boot the pipeline machine ────────────────────────────────────────────────

const actor = createActor(pipelineMachine)

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
      summary: context.summary,
      keywords: context.keywords,
      generatedTags: context.generatedTags,
      error: context.error,
    },
  }
  self.postMessage(msg)
})

// Set onmessage BEFORE actor.start() to avoid dropping events sent immediately
// after the worker is created.
self.onmessage = (e: MessageEvent) => {
  actor.send(e.data)
}

actor.start()
