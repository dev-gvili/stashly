/// <reference types="@webgpu/types" />
import { pipeline, env, type SupportedTasks } from '@huggingface/transformers'
import {
  extractAudioChunk,
  makeChunks,
  toChunk,
  parseTags,
} from './stash.worker.helpers'

// -------------------------
// Constants
// -------------------------

/** Languages supported by Whisper for transcription */
const SUPPORTED_LANGUAGES = new Set([
  'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca',
  'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms',
  'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la',
  'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn',
  'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw',
  'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be',
  'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn',
  'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha',
  'ba', 'jw', 'su',
])

/** Accept LID result above this confidence without retry */
const LID_HIGH_CONFIDENCE = 0.7
/** Minimum confidence to trust a detected language; fall back to 'en' below this */
const LID_MIN_CONFIDENCE = 0.6
/** Initial audio chunk duration (seconds) used for language detection */
const LID_SHORT_CHUNK_SEC = 8
/** Retry audio chunk duration (seconds) when initial confidence is low */
const LID_LONG_CHUNK_SEC = 15

/** System prompt for tag generation */
const GENERATE_TAGS_SYSTEM_PROMPT = (payload: { language: string }): string =>
  [
    'You are a precise tagging assistant. Analyze the provided text and generate 7–10 short tags (1–3 words each) in the same language as the input.',
    '',
    'Cover all of the following categories that appear in the text:',
    '- TOPICS: the main subjects, themes, and concepts discussed.',
    '- ENTITIES: every named person (use their full name or role), location, organization, brand, product, artwork, or event explicitly mentioned.',
    '- HOLIDAYS & CELEBRATIONS: if the content relates to any holiday, festival, or cultural celebration from any country or religion, include the holiday name and 1–2 associated thematic tags (e.g., "Christmas", "gift giving", "Eid al-Fitr", "family gathering").',
    '- SPEAKER / SUBJECT GENDER: if the text clearly indicates the speaker or primary subject is male or female.',
    '- CONTENT FORMAT: add one tag for the type of content — choose from: conversation, interview, lecture, monologue, story, news, review, speech, tutorial, lyric, podcast, movie, documentary, vlog or similar.',
    '- TONE & EMOTION: if a strong tone or emotion is evident (e.g., humorous, emotional, motivational, critical), include one tone tag.',
    '',
    'STRICT RULES:',
    '1. Extract ONLY what is explicitly present or unambiguously implied by the text. Do not invent or assume entities.',
    '2. Output ONLY a comma-separated list of tags — no numbering, no bullets, no preamble, no explanation.',
    '3. Example output: machine learning, neural networks, Yann LeCun, Montreal, conference talk, technical',
    `4. Write in the same language as the input text. The input text language is ${payload.language}.`,
  ].join('\n')

/** System prompt used for all summarization requests */
const SUMMARIZE_SYSTEM_PROMPT = (payload: { language: string }): string =>
  [
    'You are a professional summarization assistant.',
    'Your sole task is to produce a faithful, grounded summary of the text provided by the user.',
    ' ',
    'STRICT RULES — follow exactly:',
    '1. Use ONLY information explicitly present in the source text. Never infer, extrapolate, or add details not stated.',
    '2. If a fact is ambiguous or unclear, omit it. Do not guess.',
    '3. Preserve all proper nouns (names, places, organizations, products, etc...) exactly as they appear in the source.',
    `4. Write in the same language as the input text. The input text language is ${payload.language}.`,
    '5. Format: at most 2 sections, each with at most 2 bullet points. For very short input (under 3 sentences), write a single sentence instead.',
    '6. Output ONLY the summary — no preamble, no commentary, no meta-text such as "Here is a summary:".',
  ].join('\n')

/** Per-model dtype overrides; all other models default to 'fp16' */
const MODEL_DTYPE: Record<string, string | Record<string, string>> = {
  'onnx-community/tiny-aya-global-ONNX': 'q4',
  'onnx-community/whisper-large-v3-turbo': 'fp16',
  'LiquidAI/LFM2.5-VL-1.6B-ONNX': { decoder: 'q4', embedImages: 'q4' },
}

// -------------------------
// Public callback types
// -------------------------

export type ProgressData = { status?: string; progress?: number; file?: string }
export type ProgressCallback = (data: ProgressData) => void
export type PartialResultCallback = (task: string, payload: unknown) => void

// -------------------------
// Internal types
// -------------------------

interface LanguageDetectionResult {
  label: string
  score: number
}

interface ASRResult {
  text: string
  chunks?: { text: string; timestamp: [number, number] }[]
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// -------------------------
// Environment configuration
// -------------------------
const DEBUG = false // flip to true for local WebGPU profiling
if (DEBUG) {
  env.backends.onnx!.webgpu!.profiling = {
    mode: 'default',
    ondata: (data) =>
      console.log(`WebGPU profiling: ${JSON.stringify(data, null, 2)}`),
  }
}
env.useBrowserCache = true
env.allowRemoteModels = true

// -------------------------
// WebGPU Device Manager
// -------------------------
const WebGPUDeviceManager = {
  adapter: null as GPUAdapter | null,
  device: null as GPUDevice | null,
  listenersAttached: false,

  async init(): Promise<GPUDevice> {
    if (this.device) return this.device

    this.adapter = await navigator.gpu.requestAdapter()
    if (!this.adapter) {
      throw new Error('WebGPU adapter not available')
    }

    this.device = await this.adapter.requestDevice()
    console.log('WebGPU adapter and device initialized', this.adapter, this.device)

    if (!this.listenersAttached) {
      this.listenersAttached = true

      this.device.lost.then(async (info) => {
        console.warn('WebGPU device lost:', info.message)

        this.adapter = await navigator.gpu.requestAdapter()
        if (!this.adapter) {
          throw new Error('WebGPU adapter not available after device loss')
        }
        this.device = await this.adapter.requestDevice()

        console.warn('WebGPU device restored')

        await PipelineManager.resetAllPipelines()
      })
    }

    return this.device
  },
}

// -------------------------
// Pipeline Manager
// -------------------------
export class PipelineManager {
  static instances: Record<string, SupportedTasks[keyof SupportedTasks]> = {}

  static async resetAllPipelines(): Promise<void> {
    console.warn('Resetting all pipelines due to device loss')
    for (const key in this.instances) {
      try {
        await this.instances[key].dispose?.()
      } catch (e) {
        console.warn(
          `Error disposing pipeline during reset ${key}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    this.instances = {}
  }

  static async getPipeline<T extends keyof SupportedTasks>(
    task: T,
    model: string,
    progressCallback?: ProgressCallback
  ) {
    const key = `${task}-${model}`

    if (!this.instances[key]) {
      await WebGPUDeviceManager.init()
      try {
        this.instances[key] = await pipeline(task, model, {
          device: 'webgpu',
          dtype: (MODEL_DTYPE[model] ?? 'fp16') as any,
          progress_callback: progressCallback,
        })
      } catch (e) {
        console.error(`Pipeline loading error for ${model}:`, e)
        throw e
      }
    }

    return this.instances[key] as SupportedTasks[T]
  }

  static async disposePipeline(task: string, model: string): Promise<void> {
    const key = `${task}-${model}`
    if (this.instances[key]) {
      try {
        await this.instances[key].dispose?.()
      } catch (e) {
        console.warn('Error disposing pipeline', key, e)
      }
      delete this.instances[key]
    }
  }
}

// -------------------------
// Pure helpers (exported for testing)
// -------------------------

/**
 * Joins transcript partial texts with ', ' and trims outer whitespace.
 */
export function normalizeTranscript(parts: string[]): string {
  return parts.join(', ').trim()
}

/**
 * Extracts a plain string from the varied shapes that an LLM summary pipeline
 * may return: array, plain string, or object with a generated_text field.
 */
export function serializeSummaryPayload(payload: unknown): string {
  if (Array.isArray(payload)) return (payload[0] as any)?.generated_text ?? ''
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const p = payload as any
    return p.generated_text ?? p.summary ?? p.summary_text ?? ''
  }
  return ''
}

// -------------------------
// Language detection
// -------------------------

/**
 * Detects the spoken language in an audio buffer using the MMS-LID model.
 * Retries with a longer audio chunk when initial confidence is low.
 *
 * @param audio - Full audio buffer sampled at 16 kHz
 * @returns ISO-639-1 language code and detection confidence (0–1)
 */
export async function detectLanguage(
  audio: Float32Array
): Promise<{ language: string; confidence: number }> {
  const LID_SAMPLE_RATE = 16000

  const pipe = await PipelineManager.getPipeline(
    'audio-classification',
    'Xenova/mms-lid-256'
  )

  let audioChunk = extractAudioChunk({
    audio,
    startSeconds: 0,
    durationSeconds: LID_SHORT_CHUNK_SEC,
    sampleRate: LID_SAMPLE_RATE,
  })

  let lidResult: LanguageDetectionResult[] = await pipe(audioChunk, {
    top_k: 1,
  })
  let confidence = lidResult[0]?.score ?? 0

  if (confidence < LID_HIGH_CONFIDENCE) {
    console.warn(
      `Low confidence language detected: ${(confidence * 100).toFixed(2)}%, retrying with longer chunk`
    )

    audioChunk = extractAudioChunk({
      audio,
      startSeconds: 0,
      durationSeconds: LID_LONG_CHUNK_SEC,
      sampleRate: LID_SAMPLE_RATE,
    })

    lidResult = await pipe(audioChunk, { top_k: 1 })
    confidence = lidResult[0]?.score ?? 0
  }

  let language = 'en'
  const rawLabel = lidResult[0]?.label ?? ''
  if (rawLabel.length >= 2 && confidence >= LID_MIN_CONFIDENCE) {
    const candidate = rawLabel.slice(0, 2).toLowerCase()
    if (SUPPORTED_LANGUAGES.has(candidate)) {
      language = candidate
    } else {
      console.warn(`Unsupported language detected: ${candidate}`)
    }
  }

  await PipelineManager.disposePipeline('audio-classification', 'Xenova/mms-lid-256')

  return { language, confidence }
}

// -------------------------
// Transcription
// -------------------------

/**
 * Transcribes audio to text using Whisper.
 * Streams partial results via onPartialResult as each chunk completes.
 *
 * @returns The complete joined transcript string
 */
export async function transcribeAudio(
  params: {
    audio: Float32Array
    sampleRate: number
    duration: number
    language: string
  },
  onProgress: ProgressCallback,
  onPartialResult: PartialResultCallback
): Promise<string> {
  const { audio, sampleRate, duration, language } = params

  console.log('Attempting to load whisper-large-v3-turbo from Hugging Face...')

  const asrPipe = await PipelineManager.getPipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-large-v3-turbo',
    onProgress
  )

  console.log('✓ onnx-community/whisper-large-v3-turbo')
  const partialTexts: string[] = []

  if (duration > 30) {
    const chunks = makeChunks(audio, sampleRate, 60, 0)

    for (const [index, chunk] of chunks.entries()) {
      const res: ASRResult = await asrPipe(chunk, {
        language,
        chunk_length_s: chunk.length / sampleRate,
        task: 'transcribe',
        return_whole_text: false,
        return_timestamps: true,
        return_language: true,
        batch_size: 16,
      })
      const text = res.text || ''
      partialTexts.push(text)
      onPartialResult('transcription', { index, text })
      console.log(`Processed chunk ${index + 1} of ${chunks.length}`)
    }
  } else {
    const res: ASRResult = await asrPipe(audio, {
      language,
      task: 'transcribe',
      return_whole_text: false,
      return_timestamps: true,
      return_language: true,
      batch_size: 16,
    })
    console.log(res)
    if (!res.chunks) partialTexts.push(res.text)
    if (res.chunks) {
      for (const { text, timestamp } of res.chunks) {
        partialTexts.push(text)
        console.log(`[${timestamp[0]} - ${timestamp[1]}]:${text}`)
        onPartialResult('transcription', { text, timestamp })
      }
    }
  }

  const transcriptionResult = normalizeTranscript(partialTexts)
  console.log('Transcription completed')
  await PipelineManager.disposePipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-large-v3-turbo'
  )
  return transcriptionResult
}

// -------------------------
// Summarization
// -------------------------

/**
 * Summarizes text using the tiny-aya LLM.
 *
 * @returns The summary string
 */
export async function summarizeText(
  params: { text: string; language: string },
  onProgress: ProgressCallback
): Promise<string> {
  console.log('Loading summarization model...')

  const pipe = await PipelineManager.getPipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX',
    onProgress
  )

  console.log('Loaded summarization model')

  let messages: ChatMessage[] = []
  const summarizedChunks: string[] = []

  if (params.text && params.text.length > 512) {
    const chunks = toChunk(params.text, 512)
    console.log(`Text too long, splitting into ${chunks.length} chunks`)

    for (const [i, chunk] of chunks.entries()) {
      messages = [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT(params) },
        { role: 'user', content: chunk },
      ]

      const prompt = pipe.tokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      }) as string

      console.log(`Generating summary for chunk ${i + 1} of ${chunks.length}`)

      const output = await pipe(prompt, {
        max_new_tokens: 128,
        temperature: 0.7,
        return_full_text: false,
      })
      summarizedChunks.push(serializeSummaryPayload(output[0]))
    }
  } else {
    messages = [
      { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT(params) },
      { role: 'user', content: params.text },
    ]

    const prompt = pipe.tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
    }) as string

    const output = await pipe(prompt, {
      return_full_text: false,
      max_new_tokens: 128,
      renormalize_logits: true,
    })

    summarizedChunks.push(serializeSummaryPayload(output[0]))
  }

  await PipelineManager.disposePipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX'
  )

  return summarizedChunks.join(' ')
}

// -------------------------
// Keyword extraction
// -------------------------

/**
 * Extracts the top-10 keywords from text using semantic similarity.
 *
 * @returns Array of keyword strings
 */
export async function extractKeywordsFromText(
  text: string,
  onProgress: ProgressCallback
): Promise<string[]> {
  const model = await PipelineManager.getPipeline(
    'feature-extraction',
    'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    onProgress
  )

  const docVec = await model(text, { pooling: 'mean', normalize: true })

  const freq = new Map<string, number>()
  for (const w of text.match(/[\u0590-\u05FFa-zA-Z\u00C0-\u024F]{4,}/g) ?? []) {
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const candidates = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 256)
    .map(([w]) => w)

  const wordVecs = await model(candidates, { pooling: 'mean', normalize: true })

  const docData = docVec.data as Float32Array
  const wordData = wordVecs.data as Float32Array
  const dim = docData.length

  const keywords = candidates
    .map((word, i) => {
      const start = i * dim
      let score = 0
      for (let j = 0; j < dim; j++) score += wordData[start + j] * docData[j]
      return { word, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return keywords.map((kw) => kw.word)
}

// -------------------------
// Tag generation
// -------------------------

/**
 * Generates 7–10 descriptive tags for the given text using the tiny-aya LLM.
 *
 * @returns Array of tag strings
 */
export async function generateTagsFromText(
  params: { text: string; language: string },
  onProgress: ProgressCallback
): Promise<string[]> {
  console.log('Loading tag generation model...')
  await PipelineManager.resetAllPipelines()

  const pipe = await PipelineManager.getPipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX',
    onProgress
  )

  console.log('Generating tags...')

  const { text } = params
  const inputText =
    text.length <= 1024
      ? text
      : text.slice(0, 600) + ' [...] ' + text.slice(-400)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: GENERATE_TAGS_SYSTEM_PROMPT({ language: params.language }),
    },
    { role: 'user', content: inputText },
  ]

  const prompt = pipe.tokenizer.apply_chat_template(messages, {
    tokenize: false,
    add_generation_prompt: true,
  }) as string

  const output = await pipe(prompt, {
    max_new_tokens: 100,
    do_sample: false,
    repetition_penalty: 1.1,
    return_full_text: false,
  })

  const tags = parseTags(output[0].generated_text)

  await PipelineManager.disposePipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX'
  )

  return tags
}
