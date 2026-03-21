import { setup, assign, assertEvent, sendParent } from 'xstate'
import type { ActorRefFrom } from 'xstate'
import type { PipelineContext, PipelineEvents } from '@/types/machine.types'
import {
  detectHardwareActor,
  detectLanguageActor,
  transcribeActor,
  summarizeActor,
  correctTranscriptActor,
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
  if (status === 'correcting-text') return 'tiny-aya-global-ONNX'
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

// ============================================================================
// LANGUAGE DETECTION MACHINE
// ============================================================================

interface LanguageDetectionContext {
  audio: Float32Array | null
  sampleRate: number
  duration: number
  language: string | null
  confidence: number | null
}

type LanguageDetectionEvent =
  | { type: 'START'; audio: Float32Array; sampleRate: number; duration: number }
  | { type: 'WORKER.LANGUAGE_DETECTED'; language: string; confidence: number }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const languageDetectionMachine = setup({
  types: {
    context: {} as LanguageDetectionContext,
    events: {} as LanguageDetectionEvent,
    input: {} as { audio: Float32Array; sampleRate: number; duration: number } | undefined,
    output: {} as { language: string; confidence: number },
  },
  actors: { detectLanguage: detectLanguageActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { audio: event.audio, sampleRate: event.sampleRate, duration: event.duration }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      return { language: event.language, confidence: event.confidence }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.audio !== null,
  },
}).createMachine({
  id: 'language-detection',
  context: ({ input }) => ({
    audio: input?.audio ?? null,
    sampleRate: input?.sampleRate ?? 0,
    duration: input?.duration ?? 0,
    language: null,
    confidence: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ language: context.language!, confidence: context.confidence! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'detecting' },
      on: { START: { target: 'detecting', actions: 'setInput' } },
    },
    detecting: {
      invoke: {
        src: 'detectLanguage',
        input: ({ context }) => ({
          audio: context.audio!,
          sampleRate: context.sampleRate,
          duration: context.duration,
        }),
      },
      on: {
        'WORKER.LANGUAGE_DETECTED': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

// ============================================================================
// TRANSCRIPTION MACHINE
// ============================================================================

interface TranscriptionContext {
  audio: Float32Array | null
  sampleRate: number
  duration: number
  language: string
  text: string | null
}

type TranscriptionEvent =
  | { type: 'START'; audio: Float32Array; sampleRate: number; duration: number; language: string }
  | { type: 'WORKER.RESULT.TRANSCRIPTION'; text: string }
  | { type: 'WORKER.PARTIAL_RESULT'; task: string; payload: unknown }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const transcriptionMachine = setup({
  types: {
    context: {} as TranscriptionContext,
    events: {} as TranscriptionEvent,
    input: {} as { audio: Float32Array; sampleRate: number; duration: number; language: string } | undefined,
    output: {} as { text: string },
  },
  actors: { transcribe: transcribeActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { audio: event.audio, sampleRate: event.sampleRate, duration: event.duration, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.TRANSCRIPTION')
      return { text: event.text }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.audio !== null,
  },
}).createMachine({
  id: 'transcription',
  context: ({ input }) => ({
    audio: input?.audio ?? null,
    sampleRate: input?.sampleRate ?? 0,
    duration: input?.duration ?? 0,
    language: input?.language ?? 'en',
    text: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ text: context.text! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'transcribing' },
      on: { START: { target: 'transcribing', actions: 'setInput' } },
    },
    transcribing: {
      invoke: {
        src: 'transcribe',
        input: ({ context }) => ({
          audio: context.audio!,
          sampleRate: context.sampleRate,
          duration: context.duration,
          language: context.language,
        }),
      },
      on: {
        'WORKER.RESULT.TRANSCRIPTION': { target: 'done', actions: 'assignResult' },
        'WORKER.PARTIAL_RESULT': { actions: 'forwardToParent' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

// ============================================================================
// TEXT CORRECTION MACHINE
// ============================================================================

interface TextCorrectionContext {
  text: string | null
  language: string
  correctedTranscript: string | null
}

type TextCorrectionEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.CORRECTION'; correctedTranscript: string }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const textCorrectionMachine = setup({
  types: {
    context: {} as TextCorrectionContext,
    events: {} as TextCorrectionEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { correctedTranscript: string },
  },
  actors: { correctTranscript: correctTranscriptActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.CORRECTION')
      return { correctedTranscript: event.correctedTranscript }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'text-correction',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    correctedTranscript: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ correctedTranscript: context.correctedTranscript! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'correcting' },
      on: { START: { target: 'correcting', actions: 'setInput' } },
    },
    correcting: {
      invoke: {
        src: 'correctTranscript',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.CORRECTION': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

// ============================================================================
// SUMMARIZATION MACHINE
// ============================================================================

interface SummarizationContext {
  text: string | null
  language: string
  summary: string | null
}

type SummarizationEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.SUMMARIZATION'; text: string }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const summarizationMachine = setup({
  types: {
    context: {} as SummarizationContext,
    events: {} as SummarizationEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { summary: string },
  },
  actors: { summarize: summarizeActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.SUMMARIZATION')
      return { summary: event.text }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'summarization',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    summary: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ summary: context.summary! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'summarizing' },
      on: { START: { target: 'summarizing', actions: 'setInput' } },
    },
    summarizing: {
      invoke: {
        src: 'summarize',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.SUMMARIZATION': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

// ============================================================================
// KEYWORD EXTRACTION MACHINE
// ============================================================================

interface KeywordExtractionContext {
  text: string | null
  keywords: string[] | null
}

type KeywordExtractionEvent =
  | { type: 'START'; text: string }
  | { type: 'WORKER.RESULT.EXTRACT_KEYWORDS'; keywords: string[] }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const keywordExtractionMachine = setup({
  types: {
    context: {} as KeywordExtractionContext,
    events: {} as KeywordExtractionEvent,
    input: {} as { text: string } | undefined,
    output: {} as { keywords: string[] },
  },
  actors: { extractKeywords: extractKeywordsActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.EXTRACT_KEYWORDS')
      return { keywords: event.keywords }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'keyword-extraction',
  context: ({ input }) => ({
    text: input?.text ?? null,
    keywords: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ keywords: context.keywords! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'extracting' },
      on: { START: { target: 'extracting', actions: 'setInput' } },
    },
    extracting: {
      invoke: {
        src: 'extractKeywords',
        input: ({ context }) => ({ text: context.text! }),
      },
      on: {
        'WORKER.RESULT.EXTRACT_KEYWORDS': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

// ============================================================================
// TAG GENERATION MACHINE
// ============================================================================

interface TagGenerationContext {
  text: string | null
  language: string
  tags: string[] | null
}

type TagGenerationEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.GENERATE_TAGS'; tags: string[] }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const tagGenerationMachine = setup({
  types: {
    context: {} as TagGenerationContext,
    events: {} as TagGenerationEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { tags: string[] },
  },
  actors: { generateTags: generateTagsActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.GENERATE_TAGS')
      return { tags: event.tags }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'tag-generation',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    tags: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ tags: context.tags! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'generating' },
      on: { START: { target: 'generating', actions: 'setInput' } },
    },
    generating: {
      invoke: {
        src: 'generateTags',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.GENERATE_TAGS': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

export const pipelineMachine = setup({
  types: {
    context: {} as PipelineContext,
    events: {} as PipelineEvents,
  },
  actors: {
    detectHardware: detectHardwareActor,
    detectLanguage: languageDetectionMachine,
    transcribe: transcriptionMachine,
    correctTranscript: textCorrectionMachine,
    summarize: summarizationMachine,
    extractKeywords: keywordExtractionMachine,
    generateTags: tagGenerationMachine,
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
        pendingTranscript: null,
        transcript: '',
        correctedTranscript: '',
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
    pendingTranscript: null,
    transcript: '',
    correctedTranscript: '',
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
        onDone: {
          target: 'transcribing',
          actions: assign(({ event }) => ({
            detectedLanguage: { language: event.output.language, confidence: event.output.confidence },
          })),
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
        onDone: {
          target: 'correcting_text',
          actions: assign(({ event }) => ({
            pendingTranscript: event.output.text,
            transcriptProgress: null,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
      on: {
        'WORKER.PARTIAL_RESULT': { actions: 'assignTranscriptProgress' },
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
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            summary: event.output.summary,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },

    correcting_text: {
      invoke: {
        id: 'correct-transcript',
        src: 'correctTranscript',
        input: ({ context }) => ({
          text: context.pendingTranscript ?? '',
          language: context.detectedLanguage?.language ?? 'en',
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ context, event }) => ({
            transcript: context.pendingTranscript ?? '',
            correctedTranscript: event.output.correctedTranscript,
            pendingTranscript: null,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },

    extracting_keywords: {
      invoke: {
        id: 'extract-keywords',
        src: 'extractKeywords',
        input: ({ context }) => ({ text: context.summary || context.transcript }),
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            keywords: event.output.keywords,
            progress: null,
            loadingPhases: [],
          })),
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
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            generatedTags: event.output.tags,
            progress: null,
            loadingPhases: [],
          })),
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
