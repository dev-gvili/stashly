import { setup, assign, enqueueActions, sendTo, assertEvent } from 'xstate'
import type { ActorRefFrom } from 'xstate'
import type { PipelineContext, PipelineEvents } from '@/types/machine.types'
import { workerBridgeActor, detectHardwareActor } from './pipeline.actors'

// Helper: derive model name from a progress file path
function modelNameFromFile(file: string): string | null {
  const name = file.split('/').pop() ?? ''
  if (name.includes('mms-lid')) return 'mms-lid-256'
  if (name.includes('whisper-large')) return 'whisper-large-v3-turbo'
  if (name.includes('tiny-aya')) return 'tiny-aya-global-ONNX'
  if (name.includes('paraphrase-multilingual')) return 'paraphrase-multilingual-MiniLM-L12-v2'
  return null
}

// Helper: derive loading phase label from a progress file path
function phaseFromFile(file: string): string | null {
  const name = file.split('/').pop() ?? ''
  if (name.includes('mms-lid')) return 'Language Model'
  if (name.includes('whisper-large')) return 'Speech Recognition'
  if (name.includes('tiny-aya')) return 'Language Model'
  if (name.includes('paraphrase-multilingual')) return 'Keyword Model'
  return null
}

// Helper: derive model name from a status string
function modelNameFromStatus(status: string): string | null {
  if (status === 'detecting-language') return 'mms-lid-256'
  if (status === 'transcribing') return 'whisper-large-v3-turbo'
  if (status === 'summarizing') return 'tiny-aya-global-ONNX'
  if (status === 'extract-keywords') return 'paraphrase-multilingual-MiniLM-L12-v2'
  if (status === 'generating-tags') return 'tiny-aya-global-ONNX'
  return null
}

// Helper: format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const pipelineMachine = setup({
  types: {
    context: {} as PipelineContext,
    events: {} as PipelineEvents,
  },
  actors: {
    workerBridge: workerBridgeActor,
    detectHardware: detectHardwareActor,
  },
  actions: {
    // Spawn the persistent worker bridge — stored in context.workerRef
    spawnWorkerBridge: enqueueActions(({ enqueue }) => {
      enqueue.assign(({ spawn }) => ({
        workerRef: spawn('workerBridge', { id: 'stash-worker-bridge' }),
      }))
    }),

    assignHardwareInfo: assign(({ event }) => {
      const output = (event as any).output as { executionProvider: 'webgpu' | 'wasm'; gpuInfo: string | null }
      return { executionProvider: output.executionProvider, gpuInfo: output.gpuInfo }
    }),

    assignFileAndSendDetectLanguage: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'AUDIO_UPLOAD')
      enqueue.assign({
        fileInfo: {
          name: event.file.name,
          type: event.file.type,
          size: formatFileSize(event.file.size),
          duration: event.duration,
        },
        pendingAudio: {
          audio: event.audio,
          sampleRate: event.sampleRate,
          duration: event.duration,
        },
        // Reset prior outputs
        transcript: '',
        summary: '',
        keywords: [],
        generatedTags: [],
        detectedLanguage: null,
        transcriptProgress: null,
        progress: null,
        loadingPhases: [],
        modelName: null,
        error: null,
      })
      enqueue.sendTo(({ context: ctx }) => ctx.workerRef!, {
        type: 'SEND_TO_WORKER',
        message: {
          type: 'detect-language',
          payload: {
            audio: event.audio,
            sampleRate: event.sampleRate,
          },
        },
      })
    }),

    assignLanguageAndSendTranscribe: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      enqueue.assign({
        detectedLanguage: { language: event.language, confidence: event.confidence },
      })
      const pending = context.pendingAudio!
      enqueue.sendTo(({ context: ctx }) => ctx.workerRef!, {
        type: 'SEND_TO_WORKER',
        message: {
          type: 'transcribe',
          payload: {
            audio: pending.audio,
            sampleRate: pending.sampleRate,
            duration: pending.duration,
            language: event.language,
          },
        },
      })
    }),

    assignTranscript: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.TRANSCRIPTION')
      return {
        transcript: event.text,
        transcriptProgress: null,
        progress: null,
        loadingPhases: [],
      }
    }),

    assignSummary: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.SUMMARIZATION')
      return { summary: event.text, progress: null, loadingPhases: [] }
    }),

    assignKeywords: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.EXTRACT_KEYWORDS')
      return { keywords: event.keywords, progress: null, loadingPhases: [] }
    }),

    assignTags: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.GENERATE_TAGS')
      return { generatedTags: event.tags, progress: null, loadingPhases: [] }
    }),

    updateProgress: assign(({ context, event }) => {
      assertEvent(event, 'WORKER.PROGRESS')
      const data = event.data as { status?: string; progress?: number; file?: string } | null
      if (!data || data.status !== 'progress' || data.file === undefined) {
        return { progress: null, loadingPhases: [] }
      }
      const file = data.file
      const pct = data.progress ?? 0
      const updatedProgress = { ...(context.progress ?? {}), [file]: pct }
      const phase = phaseFromFile(file)
      const updatedPhases =
        phase && !context.loadingPhases.includes(phase)
          ? [...context.loadingPhases, phase]
          : context.loadingPhases
      const name = modelNameFromFile(file)
      return {
        progress: updatedProgress,
        loadingPhases: updatedPhases,
        ...(name ? { modelName: name } : {}),
      }
    }),

    updateModelName: assign(({ event }) => {
      assertEvent(event, 'WORKER.STATUS')
      const name = modelNameFromStatus(event.status)
      if (event.status === 'ready') {
        return { progress: null, loadingPhases: [], ...(name ? { modelName: name } : {}) }
      }
      return name ? { modelName: name } : {}
    }),

    assignError: assign(({ event }) => {
      assertEvent(event, 'WORKER.ERROR')
      return { error: event.message }
    }),

    assignAudioDuration: assign(({ event }) => {
      assertEvent(event, 'WORKER.AUDIO_DURATION')
      return { audioDuration: event.seconds }
    }),

    assignTranscriptProgress: assign(({ event }) => {
      assertEvent(event, 'WORKER.PARTIAL_RESULT')
      return { transcriptProgress: event.payload }
    }),

    sendSummarize: sendTo(
      ({ context }) => context.workerRef!,
      ({ context, event }) => ({
        type: 'SEND_TO_WORKER' as const,
        message: {
          type: 'summarize' as const,
          payload: {
            text: (event as { type: 'SUMMARIZE'; text: string }).text,
            language: context.detectedLanguage?.language ?? 'en',
          },
        },
      })
    ),

    sendGenerateTags: sendTo(
      ({ context }) => context.workerRef!,
      ({ context }) => ({
        type: 'SEND_TO_WORKER' as const,
        message: {
          type: 'generate-tags' as const,
          payload: {
            text: context.summary || context.transcript,
            language: context.detectedLanguage?.language ?? 'en',
          },
        },
      })
    ),

    clearPendingAudio: assign({ pendingAudio: null }),

    clearError: assign({ error: null }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwC4ENYAsC0AHAlrmADb4B2YAxAMICCActQKIAyA2gAwC6iouA9rHwp8-MrxAAPRADYA7ABoQAT0QBGAMwc5AOgCcMgKx7DavWoBMcjgA4bAX3tLUGHASKkKlAOoB5AEoA0kz+OiH+AZw8SCACQiJiEtII8kqqCHoALBY6MmocMjYcmWqZHBpyjs7oWHiEJORUfkEhOgAKEQDi-kwAyr1REnHCouIxyTIGOoZyBmV6WRqGpmnqmRU6szYyFXIyMpl6Gg5OIC617g1ezcGhvQAqtPcAqgPcQ4IjieOI1hqbexsZhsRzkhlSKnUFiqZxqbnqniaAVuOlozwAIgBJXwAfXRz38T2x9EGMWGCTGoAmkx0BS0hg4xgZNj2qwQakMGkyOkyBw4HCycjKBxh53hHkaOgAxpgwFKANbkKA4zBoABOEAA7uqqBAxGAdOQAG78eUG1Ua7VqsDYGVy+WkvifClJRAzDg6NRyMGZTJ7Qw2CyBtn5TKGXIg+RGTKBtQ7UVwuoSijS2UKpUq9VanWUMBqtX8NU6XDENAoABmhYAtjoLdnrba0w73mTnaNXQh3Z7vYZff7A8HIey47pNMcORZ5BY9DZMgnXEmrgb8BBiFQ0Vjcc82ixfLR0Y7Ym3vlT1Bxp-oNKUCrzlgcbCG42odEHOft+XJSst5xcEZKIGAKByiIZDKqWoEAK5oDAPjIq0LAMJ0zy0J0TB4kw9xMNQmEHi2TrxO2PzssUz68lyegcGYQoLJkbLWDY0yThYfpWHo04Cj+4pLjoKBqmgZCwFKar4AARkqsEtKEPS9M8LD3Do9yEvQvTUP4mJtPcxKHuShGnp21jdj6fpGAOFhsuC3KTEseTZMsBScYuiI8XxAlCaJ4k3K0bS0P4mm0CwOLSbJ9zacelJSIgGhcrSVj5LYLJZL2bIyMxOgshYGh6NYhjMeUagOZcTnWmgEDKJQG7Yji267vuoUESeEXEReRzXgcRgWQ+Q7HDkGUaBYvZGOesxzqcYqOZKxWlZQMkALIzT5mIAFpMHVXzhckch9Z6+QpWUxjTkGbK8gx55AiCn6zEsegFX+KaTWVTAABqKbQ2E4sEACazTom80T4WtHaFCdpRZEG+xzLRQ5eidfXaGGJgWP1Mg3cmBr3ZQqH0CETxoY8nS-R89XrWezVXsKt4dWyr7TPIdjTtk1hHCj3GwBBVZVuq+AAF4eXBUl9MFOizfNamLUSvgknhR5Ex2XZekZ-ZBmZXWfjoGgpWdlHlCZzNOWAki8WgUogcqZrKJqhYQLAEkokFclhM9hJvZ930E62MtEXLPZ9iZStU0KuRZb6OxDSYlSjYmhWSjAFB8SbOLoFA1uefzMn25j2OYTieNu-9LpEfkpOtRT94hnY+jnqYlhLJo5jh9UC5RymeYFmqlDSRhq353pXsK77g7pFkegxesxSzjeeS65KLeFuVGKVdVe64X90sA57Bny72xkBn7Q42DlasBkcV5RdoyMwmQ-AAfAMRjU3YCE2velmGyFG5EYFReto7qMlPKZ2umUCmZLQ6kft3RqzFwy9k5DA-eSwgSPlMNMIocZsh+hyvvP+y5VwP3dk-RqFEGIzn5PvAUcgmKdXSGoNQs40remhgGah2ssE6AAkBY2GZwJQCgjAMBulGpjm5AKFKfVjjRmYmyFk-wZCV0-IyHamCI6N1ugaQ2rlhJiVAnwhqyRjjcmMocAMZRvRWEUEOchMhpi7EKGCBYm1oRKN-KjHQ91tHEwyLYfQRRbAMiyhQtkmVuQmDIoyWcoj66wmUc41m7NOY8y0Xg8BujvT6HMNkI4aCKKMiOtsWkmVPzUJnHkIELD9aGw4UAs2FsNQ3zzvw3Rk5A5xndGYcESxIbpHYi+WwBhvQ2C5HIEpjiuJORjnmMsGZE61NXkk9QUUhEGAyhlbYvYJFdXKNMYaxRshRTrqU-MhY3EdgqNyUweQa62SsDIV++xunMTYjOWYJh8qOHsEAA */
  id: 'stash-pipeline',
  context: {
    workerRef: undefined,
    executionProvider: 'unknown',
    gpuInfo: null,
    fileInfo: null,
    pendingAudio: null,
    modelName: null,
    loadingPhases: [],
    progress: null,
    detectedLanguage: null,
    audioDuration: 0,
    transcriptProgress: null,
    transcript: '',
    summary: '',
    keywords: [],
    generatedTags: [],
    error: null,
  },
  initial: 'checking_hardware',

  // Global handlers: apply from any state
  on: {
    CANCEL: {
      target: '.idle',
      actions: 'clearPendingAudio',
    },
    'WORKER.ERROR': {
      target: '.error',
      actions: 'assignError',
    },
    'WORKER.PROGRESS': {
      actions: 'updateProgress',
    },
    'WORKER.STATUS': {
      actions: 'updateModelName',
    },
    'WORKER.AUDIO_DURATION': {
      actions: 'assignAudioDuration',
    },
  },

  states: {
    checking_hardware: {
      invoke: {
        id: 'hardware-check',
        src: 'detectHardware',
        onDone: {
          target: 'idle',
          actions: ['assignHardwareInfo', 'spawnWorkerBridge'],
        },
        onError: {
          target: 'idle',
          actions: 'spawnWorkerBridge',
        },
      },
    },

    idle: {
      on: {
        AUDIO_UPLOAD: {
          target: 'detecting_language',
          actions: 'assignFileAndSendDetectLanguage',
        },
      },
    },

    detecting_language: {
      on: {
        'WORKER.LANGUAGE_DETECTED': {
          target: 'transcribing',
          actions: 'assignLanguageAndSendTranscribe',
        },
      },
    },

    transcribing: {
      on: {
        'WORKER.RESULT.TRANSCRIPTION': {
          target: 'ready',
          actions: 'assignTranscript',
        },
        'WORKER.PARTIAL_RESULT': {
          actions: 'assignTranscriptProgress',
        },
      },
    },

    ready: {
      on: {
        // Re-upload starts a fresh pipeline run
        AUDIO_UPLOAD: {
          target: 'detecting_language',
          actions: 'assignFileAndSendDetectLanguage',
        },
        SUMMARIZE: {
          target: 'summarizing',
          actions: 'sendSummarize',
        },
        GENERATE_TAGS: {
          target: 'generating_tags',
          actions: 'sendGenerateTags',
        },
      },
    },

    summarizing: {
      on: {
        'WORKER.RESULT.SUMMARIZATION': {
          target: 'ready',
          actions: 'assignSummary',
        },
      },
    },

    generating_tags: {
      on: {
        'WORKER.RESULT.GENERATE_TAGS': {
          target: 'ready',
          actions: 'assignTags',
        },
      },
    },

    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'clearError',
        },
        AUDIO_UPLOAD: {
          target: 'detecting_language',
          actions: 'assignFileAndSendDetectLanguage',
        },
      },
    },
  },
})

export type PipelineMachine = typeof pipelineMachine
export type PipelineMachineActor = ActorRefFrom<PipelineMachine>
