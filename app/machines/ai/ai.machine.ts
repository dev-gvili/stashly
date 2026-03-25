
import { assertEvent, assign, fromPromise, setup, log, and } from 'xstate'
import { z } from 'zod'
import { parsePresignedUrl } from '../../utils/parsers'
import type { TranscribeOptions } from '../../.server/ai.utils'
import { presignedUrl } from '@/schemas/machine.schemas'
import { toCategory } from '../../utils/converters'

// ============================================================================
// IMAGE CAPTION SUB-MACHINE
// ============================================================================
interface ImageCaptionContext {
  url: string
  caption: string | null
  error: string | null
}

type ImageCaptionEvent =
  | { type: 'START'; url: string }
  | { type: 'PROCESS' }
  | { type: 'SUCCESS'; caption: string }
  | { type: 'FAIL'; error: string }
  | { type: 'RESET' }

const caption = fromPromise<{ caption: string }, { url: string }>(
  async ({ input }) => {
    let formData = new FormData()
    formData.append('intent', 'caption-image')
    // Get the presigned URL of the corrent loaded item ( if item category is image ).
    formData.append('url', input.url)
    // Call the captioning API
    let response = await fetch('/api/ai/caption', {
      method: 'POST',
      body: formData,
    })
    // Parse the response, expecting a JSON with { description: string }
    let data = (await response.json()) as { caption: string }
    return data
  }
)

const summarize = fromPromise<{ summary: string }, { content: string }>(
  async ({ input }) => {
    let formData = new FormData()
    formData.append('intent', 'summarize-text')
    formData.append('text', input.content)
    // Call the summarization API
    let response = await fetch('/api/ai/summarize', {
      method: 'POST',
      body: formData,
    })
    let data = (await response.json()) as { summary: string }
    return data
  }
)

const processAudio = fromPromise<
  { transcription: string; summary: string },
  { url: string }
>(async ({ input }) => {
  let formData = new FormData()
  formData.append('intent', 'process-audio')
  formData.append('url', input.url)
  formData.append('stream', 'false')
  // Call the audio processing API
  let response = await fetch('/api/ai/transcribe', {
    method: 'POST',
    body: formData,
  })
  let data = (await response.json()) as {
    transcription: string
    summary: string
  }
  return data
})

export const imageCaptionMachine = setup({
  types: {
    context: {} as ImageCaptionContext,
    events: {} as ImageCaptionEvent,
  },
  actors: {
    caption,
  },
  actions: {
    setUrl: assign(({ event }) => {
      assertEvent(event, 'START')
      return { url: event.url }
    }),
    setCaption: (_, params: { caption: string }) => ({
      caption: params.caption,
    }),
    setError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    reset: ({ context }) => {
      context.caption = null
      context.error = null
    },
  },
  guards: {
    hasValidUrl: ({ event }) => {
      if (event.type === 'START') {
        return parsePresignedUrl(event.url).success
      }
      return false
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsC2BDGBaAxugDgC7ID2AdgHTIQA2YAxAMoAqAggErMDaADALqJQ+ErGTFygkAA9EAVgAcARgoAWAExqeAZhUB2LboCc8rQBoQAT0SL9FebIBsanXs2HFa3QF8v5tJjBcAnFKfAAnEhw4UTIoeghyMCoyADcSAGsk-2w8IlJQiKjYGKgEZFTI9BDePhrJYVEQyRkEBy15Ch4bXR5DXoclRQdzKwQlCi0HB10VHgdZY08dHz8MHOD8inDI6PK4sDCIsK2aKoAzEjDUKjXA3JCtwt3Ysoq8av46pBAGsXzm6w8eQdRxqWRdRRaYzzYaWayOCi6TTyLp9KG6RSGBwrEDZO4bcgUHAkVD4OiESD0L5CER-CTfFpaNQqTqKHiyDTyWZM2Q2EaIJm6CiGDmyWaGPQzAayHF4oJ5QkHI5U-j1WlNBnWRR6VQeHgqeaKbXTfkIHTKHQ8DHA+RqDx6Hy+EBkEgQOCSOX3f7fX4a0AtLCw0aBzo8MPhiNhrSyGVOz0EyjUOhqxre-2IFSKDoOGy2rGKMUKIMC7QUNSGaN6DlZiWGWW3eUPbZFEopulkAEIIxqOwF21IgtOSamyGGToKFRihwqLRDEX1gKNzbE0nkyBtv3SDNqU1qeRjuYGoHs7SYq0L9YKyhKy4btNbhD2nuo6NM+RTMPFs08HuTvfRjk2l5R0vCAA */
  id: 'image-caption',
  initial: 'idle',
  context: {
    url: '',
    caption: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          guard: 'hasValidUrl',
          target: 'processing',
          actions: 'setUrl',
        },
      },
    },
    processing: {
      entry: 'reset',
      invoke: {
        src: 'caption',
        input: ({ context }) => ({
          url: context.url,
        }),
        onDone: {
          target: 'completed',
          actions: {
            type: 'setCaption',
            params: ({ event }) => ({ caption: event.output.caption }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'setError',
            params: ({ event }) => ({ error: event.error as string }),
          },
        },
      },
      description: 'Processing image for caption generation.',
    },
    completed: {
      always: {
        target: 'idle',
      },
      description: 'Image caption generated successfully',
    },
    error: {
      always: {
        target: 'idle',
      },
      description: 'An error occurred during image caption generation',
    },
  },
})

// ============================================================================
// TRANSCRIPTION SUB-MACHINE (with streaming support)
// ============================================================================

// ================== Transcription Schema ============== //

let whisperModels = z.enum([
  'small',
  'tiny',
  'tiny.en',
  'tiny-q5_1',
  'tiny.en-q5_1',
  'tiny-q8_0',
  'base',
  'base.en',
  'base-q5_1',
  'base.en-q5_1',
  'base-q8_0',
  'small.en',
  'small.en-tdrz',
  'small-q5_1',
  'small.en-q5_1',
  'small-q8_0',
  'medium',
  'medium.en',
  'medium-q5_0',
  'medium.en-q5_0',
  'medium-q8_0',
  'large-v1',
  'large-v2',
  'large-v2-q5_0',
  'large-v2-q8_0',
  'large-v3',
  'large-v3-q5_0',
  'large-v3-turbo',
  'large-v3-turbo-q5_0',
  'large-v3-turbo-q8_0',
])

/**
 * Zod schema for transcription options.
 * Validates URL ( s3 presigned url ), model choice, queue, language, and streaming flag.
 */
let transcribeOptions = z.object({
  url: presignedUrl,
  model: whisperModels.optional().default('large-v3-turbo'),
  queue: z.number().int().min(1).max(5).optional().default(3),
  language: z.string().optional().default('auto'),
  stream: z.boolean().optional().default(false),
})

/**
 * Zod schema for transcription machine context.
 * Includes transcription text and error message.
 */
let transcriptionContextSchema = transcribeOptions.extend({
  transcription: z.string().default(''),
  error: z.string().nullable(),
})

/**
 * Zod schema for transcription machine events.
 * Defines events for starting, receiving chunks, completing, failing, and resetting.
 */
let transcriptionEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START'),
    url: presignedUrl,
    stream: z.boolean().optional(),
    model: whisperModels.optional(),
    language: z.string().optional(),
    queue: z.number().int().min(1).max(5).optional(),
    file: z.file()
  }),
  z.object({
    type: z.literal('CHUNK'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('COMPLETE'),
    transcription: z.string(),
  }),
  z.object({
    type: z.literal('FAIL'),
    error: z.string(),
  }),
  z.object({
    type: z.literal('RESET'),
  }),
])

// ============= Transcription Machine Types ============ //

/**
 * Zod inferred types for transcription machine context.
 */
export type TranscriptionContext = z.infer<typeof transcriptionContextSchema>
/**
 * Zod inferred types for transcription machine events.
 */
export type TranscriptionEvent = z.infer<typeof transcriptionEventSchema>
/**
 *  Zod inferred types for transcription machine input options.
 */
export type TranscriberOptions = z.infer<typeof transcribeOptions>

// =============== Machine Implementation =============== //

/**
 * XState actor to handle transcription API calls.
 * Sends transcription request and returns the transcription result.
 * @param input - The transcription options @see {@link TranscriberOptions}
 * @returns {Promise<{ transcription: string }>} The transcription result.
 */
let transcribe = fromPromise<{ transcription: string }, TranscriberOptions>(
  async ({ input }) => {
    let formData = new FormData()
    formData.append('intent', 'transcribe-file')
    let options = transcribeOptions.parse(input)
    formData.append('url', options.url)
    formData.append('model', options.model)
    formData.append('queue', options.queue.toString())
    formData.append('language', options.language)
    formData.append('stream', options.stream.toString())
    // Call the transcription API
    let response = await fetch('/api/ai/transcribe', {
      method: 'POST',
      body: formData,
    })

    let data = (await response.json()) as { transcription: string }
    return data
  }
)

export const transcriptionMachine = setup({
  types: {
    context: {} as TranscriptionContext,
    events: {} as TranscriptionEvent,
  },
  actors: {
    transcribe,
  },
  actions: {
    setOptions: assign(({ event }) => {
      assertEvent(event, 'START')
      return {
        url: event.url,
        stream: event.stream ?? false,
        model: event.model ?? 'base.en',
        language: event.language ?? 'auto',
        queue: event.queue ?? 3,
      }
    }),
    appendChunk: ({ context, event }, params: { text: string }) => {
      if (event.type === 'CHUNK') {
        context.transcription += event.text
      }
    },
    saveTranscription: (_, params: { transcription: string }) => ({
      transcription: params.transcription,
    }),
    saveError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    clearContext: assign(() => ({
      url: '',
      transcription: '',
      stream: false,
      model: 'base',
      language: 'auto',
      queue: 3,
      error: null,
    })),
  },
  guards: {
    hasValidUrl: ({ event }) => {
      assertEvent(event, 'START')
      return parsePresignedUrl(event.url).success
    },
    hasValidModel: ({ event }) => {
      assertEvent(event, 'START')
      return whisperModels.safeParse(event.model).success
    },
    hasValidFileType: ({ event }) => {
      assertEvent(event, 'START')
      let category = toCategory(event.file)
      return category === 'audio' || category === 'video'
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcBOBDAdrAxqglgA7L4D2mAdPhADZgDEAygCoCCASswNoAMAuolCFSsfCXKCQAD0QBWAIzyKADgAsCgOwAmLT3kblGgGyyANCACeiHaopHFG1VoDMzw6p7KAvl-NosuATEZJT+2Hj4AEb4mFD0AMIAEgCqAHIA0rwCSCDCouKYkjIIGvLKFC7KAJxG6s6OCkbmVghaqhoUqrU8RjpVLjyqhj5+GOFBBRRhgVExcfEA8gCyAAoAMgCizBtZknliIUWI7hTyQ8o8sqqqVc6XzYhO5fL2xhoaPM6ynsYjINMRYLkKZjGbRWL0ABirAAkmtdjl9gUjghZDUKGjnDdnLprsorg8EDieKc9MpKvUTC9VH8ARMQhQcKQALaEOjISBMNicBFCEQHCQ5YonM7KC5XbH3SyIO5GCg9d5aeS6K6eZxGWmgwGTJms9mc9gbRhbXm5fnIoWIW5KeRorQXHiOIwXZyE5RKdVGD626r22RuTUBbUMsCoVCkVBcjjcfh7c2HS0IfRynSyZ1VW6yspNaUILrOChY521WSGeSO+SB8ZESah8ORw3GmPZPn5BOgYrJipaNPVTM9bNuuVVLpVMVooxVWQGWQ+XwgTCkCBwSR0mvts1twUdxAAWhzLX38p4J9PZ9PGirMyBlGodDjW8KibcHXsI-JWmd2lLhPLVQoU6KM6OKuFOYpXsGwJruCUAPgKT47iUPYVGmbjyGOU5DBohJYh0mFnPUVTKravzzmuN6MiybJgByEBwRaiHlviGJOGi7xqDUYo4dcKgaG4yhYs4ZyqMqEH0sCdYRvRG7FE4v66CoSpomKWJVIMaZzl4QA */
  id: 'transcription',
  initial: 'idle',
  context: {
    file: new File([], 'unknown', { type: 'unknown' }),
    url: '',
    transcription: '',
    stream: false,
    model: 'large-v3-turbo',
    language: 'auto',
    queue: 10,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'transcribing',
          actions: 'setOptions',
          guard: and([
            'hasValidUrl', // Check if the URL is a valid s3 presigned url.
            'hasValidModel', // Check if the model is a valid whisper model. 
            'hasValidFileType', // Check if the file is audio or video file.
          ]),
        },
      },
    },
    transcribing: {
      invoke: {
        id: '@ai.transcribe-file',
        src: 'transcribe',
        input: ({ context }) => ({
          ...context,
        }),
        onDone: {
          target: 'completed',
          actions: {
            type: 'saveTranscription',
            params: ({ event }) => ({
              transcription: event.output.transcription,
            }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'saveError',
            params: ({ event }) => ({ error: event.error as string }),
          },
        },
      },
      description: 'Transcribing audio/video file from the provided URL.',
    },
    completed: {
      always: {
        target: 'idle',
      },
      description: 'Transcription completed successfully',
    },
    error: {
      always: {
        target: 'idle',
      },
      description: 'An error occurred during transcription',
    },
  },
})

// ============================================================================
// CHAT SUB-MACHINE
// ============================================================================
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatContext {
  messages: ChatMessage[]
  currentPrompt: string | null
  currentResponse: string
  error: string | null
}

type ChatEvent =
  | { type: 'SEND'; prompt: string }
  | { type: 'CHUNK'; text: string }
  | { type: 'COMPLETE'; response: string }
  | { type: 'FAIL'; error: string }
  | { type: 'RESET' }

export const chatMachine = setup({
  types: {
    context: {} as ChatContext,
    events: {} as ChatEvent,
  },
  actions: {
    setPrompt: ({ context, event }) => {
      if (event.type === 'SEND') {
        context.currentPrompt = event.prompt
        context.currentResponse = ''
        context.error = null
        // Add user message to history
        context.messages.push({
          role: 'user',
          content: event.prompt,
        })
      }
    },
    appendChunk: ({ context, event }) => {
      if (event.type === 'CHUNK') {
        context.currentResponse += event.text
      }
    },
    finalizeResponse: ({ context, event }) => {
      if (event.type === 'COMPLETE') {
        context.currentResponse = event.response
        // Add assistant message to history
        context.messages.push({
          role: 'assistant',
          content: event.response,
        })
        context.error = null
      }
    },
    setError: ({ context, event }) => {
      if (event.type === 'FAIL') {
        context.error = event.error
      }
    },
    clearContext: ({ context }) => {
      context.messages = []
      context.currentPrompt = null
      context.currentResponse = ''
      context.error = null
    },
  },
  guards: {
    hasValidPrompt: ({ event }) => {
      if (event.type === 'SEND') {
        return event.prompt.trim().length > 0
      }
      return false
    },
  },
}).createMachine({
  id: 'chat',
  initial: 'idle',
  context: {
    messages: [],
    currentPrompt: null,
    currentResponse: '',
    error: null,
  },
  states: {
    idle: {
      on: {
        SEND: {
          target: 'responding',
          actions: 'setPrompt',
          guard: 'hasValidPrompt',
        },
      },
    },
    responding: {
      on: {
        CHUNK: {
          actions: 'appendChunk',
        },
        COMPLETE: {
          target: 'completed',
          actions: 'finalizeResponse',
        },
        FAIL: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    completed: {
      on: {
        SEND: {
          target: 'responding',
          actions: 'setPrompt',
          guard: 'hasValidPrompt',
        },
        RESET: {
          target: 'idle',
          actions: 'clearContext',
        },
      },
    },
    error: {
      on: {
        SEND: {
          target: 'responding',
          actions: 'setPrompt',
          guard: 'hasValidPrompt',
        },
        RESET: {
          target: 'idle',
          actions: 'clearContext',
        },
      },
    },
  },
})

// ============================================================================
// EMBEDDING/FEATURE EXTRACTION SUB-MACHINE
// ============================================================================
interface EmbeddingContext {
  content: string | null
  embedding: number[] | null
  error: string | null
}

type EmbeddingEvent = { type: 'START'; content: string } | { type: 'RESET' }

export const embeddingMachine = setup({
  types: {
    context: {} as EmbeddingContext,
    events: {} as EmbeddingEvent,
  },
  actions: {
    setContent: assign(({ event }) => {
      assertEvent(event, 'START')
      return {
        content: event.content,
      }
    }),
    setEmbedding: (_, params: { embedding: number[] }) => ({
      embedding: params.embedding,
    }),
    setError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    clearContext: ({ context }) => {
      context.content = null
      context.embedding = null
      context.error = null
    },
  },
  guards: {
    hasValidContent: ({ event }) => {
      assertEvent(event, 'START')
      return event.content.trim().length > 0
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5RgLYCNIQJYDsoDosIAbMAYgGUAVAQQCUqBtABgF1FQAHAe1iwBcs3HBxAAPRAFZJAFnwBmZpICcANlUAmSRpkBGABzKANCACeifQHZ8kg-NXLp+-asuSAvu5OoMEbHnwAY24UTlJ+SDIWdiQQHj5BYVEJBHlJfQVdZnl9eSydVRkZSxNzBA1ma1VmGQ15Ott9DVzVT290TFwCMAAnHu4eqLZReIEhEViUtIy87Nz8mULi0sQsuWddWSbdZS1m5U8vEBxuCDhRH068Ed4xpMnEAFpVFYRntvAOvy7CEjAbhLjZKIIoZGQtZS7XLTF5mVZZGzKSx6GTMZi6eR5eSWD6Xb4BTj9QJwPjXWKjRITUApSz6XQ2aQ6RZqSQ5GSvXQIlTI3So9GY3m4r7+AjBULhSAAu5U8RSeT4OrFfTMdSyVT6VGwsp2fCOZWWAy7eSLeRC3wi-C9fo9KWU4EIWqvOkKtLG7HKZUq3Q4w5AA */
  id: 'embedding',
  initial: 'idle',
  context: {
    content: null,
    embedding: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'processing',
          actions: 'setContent',
          guard: 'hasValidContent',
        },
      },
    },
    processing: {
      // Implementation of embedding extraction would go here
    },
    completed: {
      always: {
        target: 'idle',
      },
      description: 'Embedding extraction completed successfully',
    },
    error: {
      always: {
        target: 'idle',
      },
      description: 'An error occurred during embedding extraction',
    },
  },
})

// ============================================================================
// SUMMARIZATION SUB-MACHINE
// ============================================================================

export const summarizeContextSchema = z.object({
  text: z.string().nullable(),
  summary: z.string().nullable(),
  error: z.string().nullable(),
})

export const summarizeEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START'),
    text: z.string().min(1, 'Text cannot be empty.'),
  }),
  z.object({
    type: z.literal('RESET'),
  }),
])

type SummarizeContext = z.infer<typeof summarizeContextSchema>
type SummarizeEvent = z.infer<typeof summarizeEventSchema>

export const summarizeMachine = setup({
  types: {
    context: {} as SummarizeContext,
    events: {} as SummarizeEvent,
  },
  actors: {
    summarize,
  },
  actions: {
    setText: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text }
    }),
    setSummary: (_, params: { summary: string }) => ({
      summary: params.summary,
    }),
    setError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    clearError: ({ context }) => {
      context.error = null
    },
    resetContext: ({ context }) => {
      context.text = null
      context.summary = null
      context.error = null
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwK4Fs0EMBOBLAXmAHS4QA2YAxAMoAqAggEq0DaADALqKgAOA9rFwAXXHwB23EAA9EANgCcAFiIBmNgHY2AJlnqtADn2yArIoA0IAJ6IAjHqL7Fu2SePrjK+SpUBfHxdQMHAJiHmw+AGM4QTEoSghxYlwxADc+AGtiAAFMXCJArDxCAFohMCkhdi4kEH5BEXFJGQQFZTVNHT1DE3MrRH0bIi0VDy02RS0tRRsZ4z8A9EKQojDI6OS4sGxw7BWyTCEAMz5sNCIcvILgkrKKqsk64VEJGuabLWN5IjZ9NhVFUw-WRaPQWawIGzGYxEdTeYbyAbyJTDWTzEBXIrECJ8NA8ChlCCUe41R4NF6gZreFRERQqOzaRQadT6Yw2MGIFRaQY2OH6ZmKCayf5ojHLLY7ImcB4CJ6NV62TzKdxsYwGcbqfm9cHeL7K0y0-VseRzNFiPgQOCSUWEaX1Z5NRDFWTshDFaFIj2ez16EWLa5JchgW2y8nSRATdQ0iY2AHaT7yd4utU0+QuYyOJwA3z+dF+zErcJRWAxKDBskOhDyD6qKZ0zQqtRsvoQlSR2R8uyKBF02RsEy+oL57G4-GQMv2+UICZJ-Rab5UxTMtgxkxKAdLQhEcUncdyim2RSGGG9+SaNNIlUutRsIgmPvjOk2WTvPx+IA */
  id: 'summarize',
  initial: 'idle',
  context: {
    text: null,
    summary: null,
    error: null,
  },
  states: {
    idle: {
      entry: 'resetContext', // Ensure context is reset when entering idle state
      on: {
        START: {
          target: 'processing',
          actions: 'setText',
        },
      },
      description: 'Waiting for text input to summarize.',
    },
    processing: {
      invoke: {
        id: '@ai.summarize-text',
        src: 'summarize',
        input: ({ context }) => ({
          text: context.text,
        }),
        onDone: {
          target: 'completed',
          actions: {
            type: 'setSummary',
            params: ({ event }) => ({ summary: event.output.summary }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'setError',
            params: ({ event }) => ({ error: event.error as string }),
          },
        },
      },
      description: 'Processing text for summarization.',
    },
    completed: {
      always: {
        target: 'idle', // Automatically transition back to idle after completion
      },
      description: 'Summarization completed successfully.',
    },
    error: {
      always: {
        target: 'idle', // Automatically transition back to idle after error
      },
      description: 'An error occurred during summarization.',
    },
  },
})

// ============================================================================
// MAIN AI ORCHESTRATOR MACHINE
// ============================================================================
// Define types for the AI state machine based on API intents
interface AiContext {
  intent: string | null
  input: any // Flexible for different inputs (url, content, prompt, etc.)
  output: any | null // Flexible for different outputs (caption, transcription, etc.)
  error: string | null
}

type AiEvent =
  | { type: 'START'; intent: string; input: any }
  | { type: 'PROCESS' }
  | { type: 'SUCCESS'; output: any }
  | { type: 'FAIL'; error: string }
  | { type: 'RESET' }

export const aiMachine = setup({
  types: {
    context: {} as AiContext,
    events: {} as AiEvent,
  },
  actions: {
    setIntentAndInput: ({ context, event }) => {
      if (event.type === 'START') {
        context.intent = event.intent
        context.input = event.input
        context.output = null
        context.error = null
      }
    },
    setOutput: ({ context, event }) => {
      if (event.type === 'SUCCESS') {
        context.output = event.output
        context.error = null
      }
    },
    setError: ({ context, event }) => {
      if (event.type === 'FAIL') {
        context.error = event.error
        context.output = null
      }
    },
    clearContext: ({ context }) => {
      context.intent = null
      context.input = null
      context.output = null
      context.error = null
    },
  },
  guards: {
    isValidIntent: ({ event }) => {
      if (event.type === 'START') {
        const validIntents = [
          'caption-image',
          'extract-features',
          'translate-text',
          'suggest-items',
          'summarize-text',
          'transcribe-file',
          'chat',
        ]
        return validIntents.includes(event.intent)
      }
      return false
    },
  },
}).createMachine({
  id: 'ai',
  initial: 'idle',
  context: {
    intent: null,
    input: null,
    output: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'requesting',
          actions: 'setIntentAndInput',
          guard: 'isValidIntent',
        },
      },
    },
    requesting: {
      on: {
        PROCESS: 'processing',
        FAIL: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    processing: {
      on: {
        SUCCESS: {
          target: 'completed',
          actions: 'setOutput',
        },
        FAIL: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    completed: {
      on: {
        START: {
          target: 'requesting',
          actions: ['clearContext', 'setIntentAndInput'],
          guard: 'isValidIntent',
        },
        RESET: {
          target: 'idle',
          actions: 'clearContext',
        },
      },
    },
    error: {
      on: {
        START: {
          target: 'requesting',
          actions: ['clearContext', 'setIntentAndInput'],
          guard: 'isValidIntent',
        },
        RESET: {
          target: 'idle',
          actions: 'clearContext',
        },
      },
    },
  },
})
