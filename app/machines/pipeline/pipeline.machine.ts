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
    detectLanguage: detectLanguageActor,
    transcribe: transcribeActor,
    summarize: summarizeActor,
    correctTranscript: correctTranscriptActor,
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

    assignLanguage: assign(({ event }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      return { detectedLanguage: { language: event.language, confidence: event.confidence } }
    }),

    assignTranscript: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.TRANSCRIPTION')
      return {
        pendingTranscript: event.text,
        transcriptProgress: null,
        progress: null,
        loadingPhases: [],
      }
    }),

    assignSummary: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.SUMMARIZATION')
      return { summary: event.text, progress: null, loadingPhases: [] }
    }),

    assignCorrectedTranscript: assign(({ context, event }) => {
      assertEvent(event, 'WORKER.RESULT.CORRECTION')
      return {
        transcript: context.pendingTranscript ?? '',
        correctedTranscript: event.correctedTranscript,
        pendingTranscript: null,
        progress: null,
        loadingPhases: [],
      }
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwC4ENYAsC0AHAlrmADb4B2YAxAMICCActQKIAyA2gAwC6iouA9rHwp8-MrxAAPRADYATABoQAT0QBGAOwAOAHQcAzHLXGAnBy1G5JrQF8bS1BhwEipCpQDqAeQBKAaSYfHUCfX04eJBABIRExCWkEeSVVBDV9Dg0dDQBWfTUZLUKNKxMAFjsHdCw8QhJyKm9-QJ0ABVCAcR8mAGVu8Ilo4VFxSIT8mUy5Av15NS1stXNk9TkKkEdqlzr3RoCg7oAVWgOAVT7uAcEhuNH1CdKdUpls3OLtJ7l9ZdTSmce53ImApqKYaDRrDbOWpuMA6ADGmDAcIA1uQoAB9TBoABOEAA7jiqBAxLDyAA3fjI2FY3EE7FgbAIpHI-qRQaxEagBJyQE6LQcX7ZDTpbIcEzfQxqPkyUoaEzCjgLeWrezrKpQ1z1eGIlFozE4-GEyhgbHY-jYnS4YhoFAAM3NAFsdDTDfTGTqWRc2VcOfFEDz9CY+QL9EKRWLvqU1NkdNkrDJ9NpFaVsvIIeqapqKDp8BBiFRaCcACIASS86JOLRYXloRdZfB9wz9CDk8zkejknwFMny+i+KkQhgeGhBGg45kDQuy6acme2sIgYBQSJEZAx1rXAFc0DBPL49joWAx2idaO0mOii0wDkxqDe616GzEm7cW22O12nr3+ykQUCsrk+SFFoxQmGUM6bNCWqLsucKruuaBbjuDT7s0IRhI+USNjcXL+kCHA6CCSoyOYnYFN8ixinoIFyvyJh9ukJgQRq846Cg2KIbAcLYvgABGaJ7k0QRdN0JwsAcOgHD4DDdNQPgli0BxlvQ9ZYc+OFSIOeQ6ECJjZFoekTBkEzfKmMZyBkagfFGekcDIzFzjCbEcWQXE8fxa6CQeLS0D4Sm0Cw6IiWJByqeyL64QgI6PGKQqWAmGjPOKA4IKUWgyDoViduYpRGPIBQOVsTnsZx3F8QJuxoT4oQ+GF2GcppCB9lKun6YZY6JRoFEcGoQZ6VovUinpwr6IVUHZvSaAQMolCFqW5aVtWtZ1epDVjL8+iEXkvUCjyGSpqZ2QPH2MgyPK-IWek5SqpCjlapN02UKJACyz2+SWABaTArdca3qNG7aFKKZkzD2iWmdGhF6bkhT0WkUZjVmsIPTNTAABpSbQd7ogEACajRFucERPr9zaLCYUpGE8wFEfG3wTJtSbaHG+gpimo03RmRX3WAU0zee9CBMcF5HO0ROXKtZMbVtpi7aKOQyN8YK6GUzzzCO+0TIjrGwJuDoOji+AAF4Vahwk9CFOgvW98kfccyk-b6r7yptibFHRQrAslKRRrouQ9QUYoU889mc7O3PZrr+uGybnmVUE6G1Zh4UaQkLs6G7raxYlA3e4ORjSrKLuKr1xTa05cLmvScF6sukgoF5zTBeJOjUL4XR3g7yf1c26eZx7Oe9aZzyZZZ1m9aKoeVOH42wmA9ccTXa7olSyh4uaECwI35uiS36OY9jeME+L3qS87woZ2CWfDV7SufFkJifI-+knb15davPJVLxiq-r7iW-x2CNVDCxM1Kk3Pq7K+A9b4pRAhlIi8tTo8gMu-bMMAKAcXguidAUAAFmx0M3CSAshY3nRKLE+JMnaRSsn2GWO1crywOilAo7ZWwgissHbQWgObT0gkjHQ6CTQ2lrjuPBQkgE1UdhFRqFkeQ6BlJ2AacgwQjiBPTawhEzr6G4b1MwVlpxhz4axE0ZpsSUBEteKRqd-S8n5IKBUoo84IHSuZF4xgphAlZqdVBc9TTmlmsWMsFYqw1gfKAlOf0Wy2JDGGRUEYUrGDjDpCyaVWZmDyAY1UZB+CLngJEW6EcwAS3AdQ0o3wzDyOeLlXKEwZQJh8dqZkeoXR0iKafEpMiLIxk0FTK+5h5YSlZgBKM2gJiiiKA03M+ZilUJkRoJ4egxxAgsNkeichZQSjShnAUR1WzpEDKdKeaoZ78JgiuPUG4oDbhgDM6RCQ8ilAeM8SePIAzWGyN1OyAFVmjN+AmI5BTZ7OVKu5NEtzrGJEUClfSmRhpCkftGVZuQGko3BZEtIIJCK0SOnZfkY4oUpH0roWi9FZSrLFL8BpUcDY8VjlANFzYzotXSp8IccZNBlJSqzJ5AN0jKMKL7AFXMgWV1NOc5edcUAMtfPlHSMpzATHmWoYeMZEy5FBI-HkQoGmf0Xlg3+G88mULubIdZGd5Q5A4Os4oCYfyyDHFkEMMw0qpisg0wRmCRG4OldQt4mV8IWRInMEiitmEaL7ArRMpQ4byh1X47EPrOmFEeMoslcxFgJg+bAsCWQOUGFHOYeYdg7BAA */
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
          target: 'correcting_text',
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

    correcting_text: {
      invoke: {
        id: 'correct-transcript',
        src: 'correctTranscript',
        input: ({ context }) => ({
          text: context.pendingTranscript ?? '',
          language: context.detectedLanguage?.language ?? 'en',
        }),
      },
      on: {
        'WORKER.RESULT.CORRECTION': {
          target: 'ready',
          actions: 'assignCorrectedTranscript',
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
