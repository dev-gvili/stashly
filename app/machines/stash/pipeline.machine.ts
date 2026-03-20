import { setup, assign, assertEvent } from 'xstate'
import type { ActorRefFrom } from 'xstate'
import type { PipelineContext, PipelineEvents } from '@/types/machine.types'
import {
  detectHardwareActor,
  detectLanguageActor,
  transcribeActor,
  summarizeActor,
  extractKeywordsActor,
  generateTagsActor,
} from './pipeline.actors'

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
    detectHardware: detectHardwareActor,
    detectLanguage: detectLanguageActor,
    transcribe: transcribeActor,
    summarize: summarizeActor,
    extractKeywords: extractKeywordsActor,
    generateTags: generateTagsActor,
  },
  actions: {
    assignHardwareInfo: assign(({ event }) => {
      const output = (event as any).output as { executionProvider: 'webgpu' | 'wasm'; gpuInfo: string | null }
      return { executionProvider: output.executionProvider, gpuInfo: output.gpuInfo }
    }),

    assignFileAndAudio: assign(({ event }) => {
      assertEvent(event, 'AUDIO_UPLOAD')
      return {
        fileInfo: {
          name: event.fileName,
          type: event.fileType,
          size: formatFileSize(event.fileSize),
          duration: event.duration,
        },
        pendingAudio: {
          audio: event.audio,
          sampleRate: event.sampleRate,
          duration: event.duration,
        },
        audioDuration: event.duration,
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
      }
    }),

    assignLanguage: assign(({ event }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      return { detectedLanguage: { language: event.language, confidence: event.confidence } }
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

    assignTranscriptProgress: assign(({ event }) => {
      assertEvent(event, 'WORKER.PARTIAL_RESULT')
      return { transcriptProgress: event.payload }
    }),

    clearPendingAudio: assign({ pendingAudio: null }),
    clearError: assign({ error: null }),
  },
}).createMachine({
  id: 'stash-pipeline',
  context: {
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
  },

  states: {
    checking_hardware: {
      invoke: {
        id: 'hardware-check',
        src: 'detectHardware',
        onDone: {
          target: 'idle',
          actions: 'assignHardwareInfo',
        },
        onError: {
          target: 'idle',
        },
      },
    },

    idle: {
      on: {
        AUDIO_UPLOAD: {
          target: 'detecting_language',
          actions: 'assignFileAndAudio',
        },
      },
    },

    detecting_language: {
      invoke: {
        id: 'detect-language',
        src: 'detectLanguage',
        input: ({ context }) => ({
          audio: context.pendingAudio!.audio,
          sampleRate: context.pendingAudio!.sampleRate,
          duration: context.pendingAudio!.duration,
        }),
      },
      on: {
        'WORKER.LANGUAGE_DETECTED': {
          target: 'transcribing',
          actions: 'assignLanguage',
        },
        'WORKER.ERROR': {
          target: 'error',
          actions: 'assignError',
        },
      },
    },

    transcribing: {
      invoke: {
        id: 'transcribe',
        src: 'transcribe',
        input: ({ context }) => ({
          audio: context.pendingAudio!.audio,
          sampleRate: context.pendingAudio!.sampleRate,
          duration: context.pendingAudio!.duration,
          language: context.detectedLanguage?.language ?? 'en',
        }),
      },
      on: {
        'WORKER.RESULT.TRANSCRIPTION': {
          target: 'ready',
          actions: 'assignTranscript',
        },
        'WORKER.PARTIAL_RESULT': {
          actions: 'assignTranscriptProgress',
        },
        'WORKER.ERROR': {
          target: 'error',
          actions: 'assignError',
        },
      },
    },

    ready: {
      on: {
        AUDIO_UPLOAD: {
          target: 'detecting_language',
          actions: 'assignFileAndAudio',
        },
        SUMMARIZE: {
          target: 'summarizing',
        },
        EXTRACT_KEYWORDS: {
          target: 'extracting_keywords',
        },
        GENERATE_TAGS: {
          target: 'generating_tags',
        },
      },
    },

    summarizing: {
      invoke: {
        id: 'summarize',
        src: 'summarize',
        input: ({ context }) => ({
          text: context.transcript,
          language: context.detectedLanguage?.language ?? 'en',
        }),
      },
      on: {
        'WORKER.RESULT.SUMMARIZATION': {
          target: 'ready',
          actions: 'assignSummary',
        },
        'WORKER.ERROR': {
          target: 'error',
          actions: 'assignError',
        },
      },
    },

    extracting_keywords: {
      invoke: {
        id: 'extract-keywords',
        src: 'extractKeywords',
        input: ({ context }) => ({ text: context.summary || context.transcript }),
      },
      on: {
        'WORKER.RESULT.EXTRACT_KEYWORDS': {
          target: 'ready',
          actions: 'assignKeywords',
        },
        'WORKER.ERROR': {
          target: 'error',
          actions: 'assignError',
        },
      },
    },

    generating_tags: {
      invoke: {
        id: 'generate-tags',
        src: 'generateTags',
        input: ({ context }) => ({
          text: context.summary || context.transcript,
          language: context.detectedLanguage?.language ?? 'en',
        }),
      },
      on: {
        'WORKER.RESULT.GENERATE_TAGS': {
          target: 'ready',
          actions: 'assignTags',
        },
        'WORKER.ERROR': {
          target: 'error',
          actions: 'assignError',
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
          actions: 'assignFileAndAudio',
        },
      },
    },
  },
})

export type PipelineMachine = typeof pipelineMachine
export type PipelineMachineActor = ActorRefFrom<PipelineMachine>
