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
  if (name.includes('paraphrase-multilingual'))
    return 'paraphrase-multilingual-MiniLM-L12-v2'
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
  if (status === 'extract-keywords')
    return 'paraphrase-multilingual-MiniLM-L12-v2'
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
    input: {} as
      | { audio: Float32Array; sampleRate: number; duration: number }
      | undefined,
    output: {} as { language: string; confidence: number },
  },
  actors: { detectLanguage: detectLanguageActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return {
        audio: event.audio,
        sampleRate: event.sampleRate,
        duration: event.duration,
      }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      return { language: event.language, confidence: event.confidence }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event),
  },
  guards: {
    hasInput: ({ context }) => context.audio !== null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBsCGA7KBXVMC0EYALmAMZECWA9ugHQUTJgDEAygCoCCASuwNoAGALqJQAByqwKlGqJAAPRAEYAbCtoAmDQFYV2pQBYBAdgMqDATgA0IAJ6INx47WNqAzBoG7PADgE+VAF9AmzRMHHxCEnJqOgYmZkERJBAJKRl0OUUEVXUtXX0jU3NrOwcPTQMAt0sfHyV6gODQjGxcMAJiMgzaKO6KTGYAdQB5bgBpAFFuWgAZTgA5AHEAVU4lyYB9ABFJ9kmAYX3tpLk06VisxG0KgQslHTqBNxULNyUbexyfN1olC20xh8QK0GgMBWaIDCbUiXRiNF6cMog1GE2mtAACtwRktuJNWKxTilzhkrgh3hpNIClMYAa5tPcPmUcq5aD5dE5VDo9No6pDoREOn14XRhcioMMxlMZhxOOwVoThGdJBdZClsh5fi9jNowW4fAYzAY3G5Poh6rQXipjFoDDpPOY3PzWoLOtEemKBhLUdLaNNsdwieIVaT1ddbvdHn4Xm8mV9HD5aCp2T9jAItK99M7wu03f0EQAzVAUJgQRJK4khy5hhCmASWgQGHUCAS5FQCFRmhCG7RU-xuJxeCy07TBEIgdBUQjwFIC3OetXB9LV0DZPCd5nr2gtne7vfGbMwoVI2L0RhgZXLxcKRB2rtuZ6aNOWExKbQmV5Bcdz2Hu0+ezBL1VTIaw0CwLFoCwNHeO5rS5YFjC7RxnBqZNfA0FQlC8AxD1dBdRRoC9KyvEDV3NGpIIeRtDR8MDoyQxtIO0bQzGMQwDQsdNcPnE9C2LUsgNDMiEB+AxKM8Q0qjo54u2NXs3n0XVwQeSSx0CIA */
  id: 'language-detection',
  context: ({ input }) => ({
    audio: input?.audio ?? null,
    sampleRate: input?.sampleRate ?? 0,
    duration: input?.duration ?? 0,
    language: null,
    confidence: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({
    language: context.language!,
    confidence: context.confidence!,
  }),
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
        'WORKER.ERROR': {
          target: 'failed',
          actions: ['forwardToParent', 'clearInput'],
        },
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
  | {
      type: 'START'
      audio: Float32Array
      sampleRate: number
      duration: number
      language: string
    }
  | { type: 'WORKER.RESULT.TRANSCRIPTION'; text: string }
  | { type: 'WORKER.PARTIAL_RESULT'; task: string; payload: unknown }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const transcriptionMachine = setup({
  types: {
    context: {} as TranscriptionContext,
    events: {} as TranscriptionEvent,
    input: {} as
      | {
          audio: Float32Array
          sampleRate: number
          duration: number
          language: string
        }
      | undefined,
    output: {} as { text: string },
  },
  actors: { transcribe: transcribeActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return {
        audio: event.audio,
        sampleRate: event.sampleRate,
        duration: event.duration,
        language: event.language,
      }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.TRANSCRIPTION')
      return { text: event.text }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event),
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
        'WORKER.RESULT.TRANSCRIPTION': {
          target: 'done',
          actions: 'assignResult',
        },
        'WORKER.PARTIAL_RESULT': { actions: 'forwardToParent' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': {
          target: 'failed',
          actions: ['forwardToParent', 'clearInput'],
        },
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
  retries: number
  useWasm: boolean
}

type TextCorrectionEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.CORRECTION'; correctedTranscript: string }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string; deviceLost?: boolean }

const MAX_CORRECTION_RETRIES = 2

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
    incrementRetries: assign(({ context }) => ({
      retries: context.retries + 1,
    })),
    enableWasmFallback: assign({ useWasm: true }),
    fallbackToOriginal: assign(({ context }) => ({
      correctedTranscript: context.text ?? '',
    })),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
    canRetry: ({ context }) => context.retries < MAX_CORRECTION_RETRIES,
    isDeviceLost: ({ event }) =>
      (event as TextCorrectionEvent & { deviceLost?: boolean }).deviceLost === true,
  },
}).createMachine({
  id: 'text-correction',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    correctedTranscript: null,
    retries: 0,
    useWasm: false,
  }),
  initial: 'idle',
  output: ({ context }) => ({
    correctedTranscript: context.correctedTranscript!,
  }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'correcting' },
      on: { START: { target: 'correcting', actions: 'setInput' } },
    },

    correcting: {
      invoke: {
        src: 'correctTranscript',
        input: ({ context }) => ({
          text: context.text!,
          language: context.language,
          useWasm: context.useWasm,
        }),
      },
      on: {
        'WORKER.RESULT.CORRECTION': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': [
          // GPU device lost → switch to WASM and retry
          {
            guard: 'isDeviceLost',
            target: 'waiting_to_retry',
            actions: ['incrementRetries', 'enableWasmFallback', 'forwardToParent'],
          },
          // Other error, retries remaining → retry on same device
          {
            guard: 'canRetry',
            target: 'waiting_to_retry',
            actions: ['incrementRetries', 'forwardToParent'],
          },
          // Out of retries → use original text
          {
            target: 'done',
            actions: ['fallbackToOriginal', 'forwardToParent'],
          },
        ],
      },
    },

    // Brief delay before retrying — gives GPU time to recover
    waiting_to_retry: {
      after: {
        500: 'correcting',
      },
    },

    done: { type: 'final' },
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
    forwardToParent: sendParent(({ event }) => event),
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
        input: ({ context }) => ({
          text: context.text!,
          language: context.language,
        }),
      },
      on: {
        'WORKER.RESULT.SUMMARIZATION': {
          target: 'done',
          actions: 'assignResult',
        },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': {
          target: 'failed',
          actions: ['forwardToParent', 'clearInput'],
        },
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
    forwardToParent: sendParent(({ event }) => event),
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
        'WORKER.RESULT.EXTRACT_KEYWORDS': {
          target: 'done',
          actions: 'assignResult',
        },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': {
          target: 'failed',
          actions: ['forwardToParent', 'clearInput'],
        },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})

function getWebGLGpuName(): string | null {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl2')
    if (!gl) return null
    const ext = (gl as WebGLRenderingContext).getExtension(
      'WEBGL_debug_renderer_info'
    )
    if (!ext) return null // If the extension is not available, return null
    const renderer = (gl as WebGLRenderingContext).getParameter(
      ext.UNMASKED_RENDERER_WEBGL
    ) as string

    if (renderer.startsWith('ANGLE (')) {
      const inner = renderer.slice(7, -1)
      const parts = inner.split(', ')
      if (parts.length >= 2) {
        return parts[1]
          .replace(/\s+Direct3D\S*.*$/, '')
          .replace(/^ANGLE Metal Renderer:\s*/, '')
          .trim()
      }
    }

    return renderer
      .replace(/\/PCIe.*$/, '')
      .replace(/\/SSE.*$/, '')
      .trim()
  } catch {
    return null
  }
}
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
    forwardToParent: sendParent(({ event }) => event),
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
        input: ({ context }) => ({
          text: context.text!,
          language: context.language,
        }),
      },
      on: {
        'WORKER.RESULT.GENERATE_TAGS': {
          target: 'done',
          actions: 'assignResult',
        },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': {
          target: 'failed',
          actions: ['forwardToParent', 'clearInput'],
        },
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
      const output = (event as unknown as { output: { executionProvider: 'webgpu' | 'wasm'; gpuInfo: string | null } }).output as {
        executionProvider: 'webgpu' | 'wasm'
        gpuInfo: string | null
      }
      let gpuInfo = output.gpuInfo ?? getWebGLGpuName()
      console.debug('Detected hardware info:', {
        executionProvider: output.executionProvider,
        gpuInfo,
      })
      return { executionProvider: output.executionProvider, gpuInfo }
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
          contentHint: event.contentHint,
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
      const data = event.data as {
        status?: string
        progress?: number
        file?: string
      } | null
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
        return {
          progress: null,
          loadingPhases: [],
          ...(name ? { modelName: name } : {}),
        }
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwC4ENYAsC0AHAlrmADb4B2YAxAMICCActQKIAyA2gAwC6iouA9rHwp8-MrxAAPRAFYA7ABoQAT0QA2OQBYAdACYAjPoDMc4wA5dR+XIC+Npagw4CRUhUoB1APIAlANJMPtqBPr6cPEggAkIiYhLSCPJKqgj6HGZG2hwAnJoyRrocpjJq2UZ2DuhYeIQk5FTe-oHaAAqhAOI+TADK3eES0cKi4pEJ2Rz62kaaBboyuppmMunJiPq6FSCO1S517o0BQd0AKrTHAKp93AOCQ3GjiONm2jKaHEbZWnK6Ztn6aqtUgZnvo5FYODIzDNNHJPptts5am4wNoAMaYMCogDW5CgAH1MGgAE4QADuxKoEDEKPIADd+FiUYSSeSiWBsOjMVj+pFBrERqAEvI1NpspDFmp9BYPh9AWYpVlNG88kqIYY1PCqojXPU0RjsbiCcSyRTKGAiUT+ETtLhiGgUAAzK0AW20zJNbI5+u5115t358VkchFYqhZkl0rK2UBf0mcnSfzUpWy2STG3sWy1NR1FG0+AgxCotHOABEAJJePHnFosLy0Es8vj+4aBhBlXRZJZaGTrfKmGN5bQaV4ZJPjKWaTVObN7FEQMAoTEiMj4u0rgCuaBglCpubpDLnC6X2DXUE3MEbUWb90Fa0WciyRg4eV0ci0HEKihUaw4ameml0SVf3lZYZGyKcdiRXUUCJNAyFgVEiXwAAjXEd2pPMyHpRltBguCEKQ5CwEvPkWweVJ5h0T5dFjdZ0g+TRAVBZ53kKeVxzMUcIO1WdcNg+DEJQtCDmaFpaB8Y4y1oFg8S6bpzhYY4SOvAUpDWUoZG0MwwTSDRQ1TGMNFFH5JRKGEPjFbiZ2RbQ2TQCBlEoYty0rata3rZSYjI282wKTt5DyXsTH0OVNGyLI0mMGRotfNJbAzBFrN1OyHMoeSAFl0vEssAC0mE8u5VLGPz0gCns5mCwFNH0HQPzKTjYV0-IrN2GyUscpgAA1jh8WhqGOPEAgATUaEsrgiJsvJvNTfI7UruyC-tv0SeRtHjSFAOisE1B+FqoNzdrKHaJh6ECM4mDxU52nGm4pqKx4Sq7QKKqWlJYWeFMllKZ9IQ0Mw9pzFFYHXZ1nWJfAAC80N3GksIPbRgdB8GIeI31JsK1tPk0qExSMX5XkWHtAQKDgpjUQK5Hyf40gyAHeNRK02VRZd8UXSQUHQvc4ZwhmLWPPCBKQ3AUAKgNyOFUVxXDKVLCjQF8kyEw-i0KU0nkOmbLAdnYOZw1GWUUkrQgWBOdh7CUS1vDmewfXDZJWBRe8mao1FOijDUZ9OJhKrycVHIYs+J5QQ13UYAoWCWbxdAoBNmHMPN7Qw-Ne12Wjh20avO7MdWrRchmZZk2yXRAXWqYjHdz45HDarphD3NzUtIlKDkpglIz0jpqFYNJbDCNZdlZbQzWwoOByHG0nLuuLYtK0nNLCsqxrOsG3blTWwl0MJRlmVo2WmnwuWEC31i759DsDMyH4ed4EiRLWvqW6MfI3eUnGIc1HyRZ1SfSmp71LlDTulZGAR+YsfILAfAUHaeRyY1STNVOU3wtI-CsKOcmNE-75kLKAp2CQzATG0MYGYnwTCQjAsXQepQ9AaB+EUD27tJwJSzPfXM85Fy6xXHiU854QF+izuRQw+RCF4z-GFMCSxphMV-A+HIHw1AmHkfGeKlRpwsJRALAiQkVw4M7upcM2hNDyPyCUWECxchSKoWBORCiTBFD-u1HR90ED4MmEQj4YJKZLCLvLaKBilEFChO4naf9EZgyQlDbRfCn4+UEZkCE6RkzzFhDMYmb4DEWGMW+UeVdGEqMgoDNEjMlyGjZigRxrZLCaVeJ-GYHtLBVyMPLf4hDIQZGlB7Qw4EmGqP2hbbWaAOH4ltkbG+6MwEzViVkQ+iTXy5EacteYrjWl40sB09MeSeI2SThHEpW5RmZ2iRM-QQj4nhhTEkuZJcdoGJ7JCIoCweylD-g3K05TyIfFJhIz8RQFYIL3rpIc4YCiJhosc8+NggA */
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
            detectedLanguage: {
              language: event.output.language,
              confidence: event.output.confidence,
            },
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
          contentHint: context.pendingAudio?.contentHint,
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
        input: ({ context }) => ({
          text: context.summary || context.transcript,
        }),
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
