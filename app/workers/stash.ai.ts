/// <reference types="@webgpu/types" />
import { pipeline, env, type SupportedTasks } from '@huggingface/transformers'
import {
  pipeline as pipelineNext8,
  env as envNext8,
  type SupportedTasks as SupportedTasksNext8,
} from '@huggingface/transformers'
import {
  extractAudioChunk,
  makeChunks,
  toChunk,
  parseTags,
} from './stash.worker.helpers'
import { transcribe } from '@/.client/stashly-ai'

// -------------------------
// Constants
// -------------------------

/** Languages supported by Whisper for transcription */
const SUPPORTED_LANGUAGES = new Set([
  'en',
  'zh',
  'de',
  'es',
  'ru',
  'ko',
  'fr',
  'ja',
  'pt',
  'tr',
  'pl',
  'ca',
  'nl',
  'ar',
  'sv',
  'it',
  'id',
  'hi',
  'fi',
  'vi',
  'he',
  'uk',
  'el',
  'ms',
  'cs',
  'ro',
  'da',
  'hu',
  'ta',
  'no',
  'th',
  'ur',
  'hr',
  'bg',
  'lt',
  'la',
  'mi',
  'ml',
  'cy',
  'sk',
  'te',
  'fa',
  'lv',
  'bn',
  'sr',
  'az',
  'sl',
  'kn',
  'et',
  'mk',
  'br',
  'eu',
  'is',
  'hy',
  'ne',
  'mn',
  'bs',
  'kk',
  'sq',
  'sw',
  'gl',
  'mr',
  'pa',
  'si',
  'km',
  'sn',
  'yo',
  'so',
  'af',
  'oc',
  'ka',
  'be',
  'tg',
  'sd',
  'gu',
  'am',
  'yi',
  'lo',
  'uz',
  'fo',
  'ht',
  'ps',
  'tk',
  'nn',
  'mt',
  'sa',
  'lb',
  'my',
  'bo',
  'tl',
  'mg',
  'as',
  'tt',
  'haw',
  'ln',
  'ha',
  'ba',
  'jw',
  'su',
])

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  ko: 'Korean',
  fr: 'French',
  ja: 'Japanese',
  pt: 'Portuguese',
  tr: 'Turkish',
  pl: 'Polish',
  ca: 'Catalan',
  nl: 'Dutch',
  ar: 'Arabic',
  sv: 'Swedish',
  it: 'Italian',
  id: 'Indonesian',
  hi: 'Hindi',
  fi: 'Finnish',
  vi: 'Vietnamese',
  he: 'Hebrew',
  uk: 'Ukrainian',
  el: 'Greek',
  ms: 'Malay',
  cs: 'Czech',
  ro: 'Romanian',
  da: 'Danish',
  hu: 'Hungarian',
  ta: 'Tamil',
  no: 'Norwegian',
  th: 'Thai',
  ur: 'Urdu',
  hr: 'Croatian',
  bg: 'Bulgarian',
  lt: 'Lithuanian',
  la: 'Latin',
  mi: 'Maori',
  ml: 'Malayalam',
  cy: 'Welsh',
  sk: 'Slovak',
  te: 'Telugu',
  fa: 'Persian',
  lv: 'Latvian',
  bn: 'Bengali',
  sr: 'Serbian',
  az: 'Azerbaijani',
  sl: 'Slovenian',
  kn: 'Kannada',
  et: 'Estonian',
  mk: 'Macedonian',
  br: 'Breton',
  eu: 'Basque',
  is: 'Icelandic',
  hy: 'Armenian',
  ne: 'Nepali',
  mn: 'Mongolian',
  bs: 'Bosnian',
  kk: 'Kazakh',
  sq: 'Albanian',
  sw: 'Swahili',
  gl: 'Galician',
  mr: 'Marathi',
  pa: 'Punjabi',
  si: 'Sinhala',
  km: 'Khmer',
  sn: 'Shona',
  yo: 'Yoruba',
  so: 'Somali',
  af: 'Afrikaans',
  oc: 'Occitan',
  ka: 'Georgian',
  be: 'Belarusian',
  tg: 'Tajik',
  sd: 'Sindhi',
  gu: 'Gujarati',
  am: 'Amharic',
  yi: 'Yiddish',
  lo: 'Lao',
  uz: 'Uzbek',
  fo: 'Faroese',
  ht: 'Haitian Creole',
  ps: 'Pashto',
  tk: 'Turkmen',
  nn: 'Norwegian Nynorsk',
  mt: 'Maltese',
  sa: 'Sanskrit',
  lb: 'Luxembourgish',
  my: 'Myanmar',
  bo: 'Tibetan',
  tl: 'Tagalog',
  mg: 'Malagasy',
  as: 'Assamese',
  tt: 'Tatar',
  haw: 'Hawaiian',
  ln: 'Lingala',
  ha: 'Hausa',
  ba: 'Bashkir',
  jw: 'Javanese',
  su: 'Sundanese',
}

/** Accept LID result above this confidence without retry */
const LID_HIGH_CONFIDENCE = 0.7
/** Minimum confidence to trust a detected language; fall back to 'en' below this */
const LID_MIN_CONFIDENCE = 0.6
/** Initial audio chunk duration (seconds) used for language detection */
const LID_SHORT_CHUNK_SEC = 8
/** Retry audio chunk duration (seconds) when initial confidence is low */
const LID_LONG_CHUNK_SEC = 15

// ============================================================
// Optimized prompts for tiny-aya-global (3.35B)
// ============================================================

/** System prompt for transcript correction */
const CORRECT_TRANSCRIPT_SYSTEM_PROMPT = (payload: {
  language: string
}): string =>
  [
    `Fix transcription errors in the text. The language is ${payload.language}.`,
    'Fix misheard words, spelling, punctuation, and grammar. Keep the same meaning. Keep all names exactly. Output only the corrected text.',
    '',
    'Example:',
    'Input: שעה טובה ומתוקה לכל המשפחה',
    'Output: שנה טובה ומתוקה לכל המשפחה',
    '',
    'Example:',
    'Input: אני גר בתל אביב כבר חמש שמונים',
    'Output: אני גר בתל אביב כבר חמש שנים',
  ].join('\n')

const SUMMARIZE_SYSTEM_PROMPT = (payload: { language: string }): string =>
  [
    'Describe what the text is about in 1-2 short sentences.',
    'Do NOT repeat or rephrase the text. Describe it from the outside.',
    `Write in ${payload.language}.`,
    '',
    'Example:',
    "Text: Welcome everyone to today's lecture on machine learning. We will cover neural networks and backpropagation.",
    'Output: An opening of a lecture introducing the topics of neural networks and backpropagation.',
    '',
    'Example:',
    'Text: דני, אני רוצה להגיד לך שאתה חבר מדהים. תודה שאתה תמיד שם בשבילי.',
    'Output: הבעת הערכה ותודה לדני על היותו חבר טוב ותומך.',
  ].join('\n')

/** System prompt for tag generation */
const GENERATE_TAGS_SYSTEM_PROMPT = (payload: { language: string }): string =>
  [
    `Generate 7-10 short tags (1-3 words each) from the text. Write tags in ${payload.language}.`,
    'Include: topics, names, places, holidays, content type (lecture/conversation/speech/story/etc), tone.',
    'Output ONLY a comma-separated list of tags.',
    '',
    'Example:',
    'Text: Hey Omar, happy new year! I love you so much. Keep being great at football and a good kid with great friends.',
    'Tags: new year greeting, Omar, football, love, encouragement, family, monologue, warm',
    '',
    'Example:',
    'Text: Today we will discuss how neural networks learn. Professor Smith from MIT will walk us through backpropagation and gradient descent.',
    'Tags: neural networks, backpropagation, gradient descent, Professor Smith, MIT, lecture, technical',
  ].join('\n')

/** Per-model dtype overrides; all other models default to 'fp16' */
const MODEL_DTYPE: Record<string, string | Record<string, string>> = {
  'Xenova/mms-lid-126': 'q4',
  'onnx-community/tiny-aya-global-ONNX': 'q4',
  'onnx-community/whisper-large-v3-turbo': 'fp16',
  'Xenova/vit-base-patch16-224': 'fp32',
  'onnx-community/Qwen3.5-2B-ONNX': {
    embed_tokens: 'q4f16',
    vision_encoder: 'q4f16',
    decoder_model_merged: 'q4f16',
  },
  'onnx-community/Phi-4-mini-instruct-ONNX': 'q4f16',
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
const DEBUG = true // flip to true for local WebGPU profiling
if (DEBUG) {
  env.backends.onnx!.webgpu!.profiling = {
    mode: 'default',
    ondata: (data) =>
      console.log(`WebGPU profiling: ${JSON.stringify(data, null, 2)}`),
  }
}
env.useBrowserCache = true
env.allowRemoteModels = true

envNext8.useBrowserCache = true
envNext8.allowRemoteModels = true
// -------------------------
// WebGPU Device Manager (generic fallback chain)
// -------------------------
// Works on any device: phones (no GPU), laptops (1 GPU),
// desktops (discrete + integrated), etc.
// Fallback order: high-performance GPU → low-power GPU → WASM
const WebGPUDeviceManager = {
  device: null as GPUDevice | null,
  adapters: [] as { adapter: GPUAdapter; name: string; preference?: string }[],
  currentAdapterIndex: 0,

  /** Build a dedup key from adapter info */
  adapterKey(adapter: GPUAdapter): string {
    const info = adapter.info
    return [
      info?.vendor ?? '',
      info?.architecture ?? '',
      info?.device ?? '',
      info?.description ?? '',
      String(!!info?.isFallbackAdapter),
      adapter.limits.maxBufferSize,
    ].join('|')
  },

  /** Build a display name from adapter info */
  adapterName(adapter: GPUAdapter): string {
    const info = adapter.info
    // Prefer description, fall back to vendor+arch, then 'unknown'
    return (
      info?.description ||
      [info?.vendor, info?.architecture].filter(Boolean).join(' ') ||
      'unknown'
    )
  },

  /**
   * Discover all available GPU adapters.
   * Uses the same multi-option strategy as webgpureport.org:
   * try several requestAdapter option sets and deduplicate by adapter info.
   * This actually finds discrete GPUs on Windows where a single
   * requestAdapter() call may only return the integrated one.
   */
  async discoverAdapters(): Promise<void> {
    if (this.adapters.length > 0) return // already discovered
    const seen = new Set<string>()

    try {
      const adapter = await navigator.gpu?.requestAdapter()
      if (!adapter) throw new Error('No adapter returned')

      const key = this.adapterKey(adapter)
      if (seen.has(key)) {
        console.warn(
          `Duplicate GPU adapter found and skipped: ${this.adapterName(adapter)}`
        )
        return
      }
      seen.add(key)

      // Skip software fallback adapters — too slow for AI inference
      if (adapter.info?.isFallbackAdapter) {
        throw new Error('Fallback adapter not allowed')
      }

      const name = this.adapterName(adapter)
      this.adapters.push({ adapter, name })
    } catch {
      /* adapter not available for this option set */
    }

    // Sort: largest maxBufferSize first (discrete GPUs >> integrated)
    this.adapters.sort(
      (a, b) => b.adapter.limits.maxBufferSize - a.adapter.limits.maxBufferSize
    )

    if (this.adapters.length === 0) {
      console.warn('No WebGPU adapters found — will use WASM')
    }
  },

  async init(): Promise<GPUDevice> {
    if (this.device) return this.device
    await this.discoverAdapters()

    if (this.adapters.length === 0) {
      throw new Error('No WebGPU adapters available')
    }

    const { adapter, name } = this.adapters[this.currentAdapterIndex]
    this.device = await adapter.requestDevice()

    this.device.lost.then(async (info) => {
      console.warn(`GPU device lost (${name}):`, info.message)
      this.device = null
      await PipelineManager.resetAllPipelines()
      try {
        await this.init() // try to reinitialize the same adapter
      } catch (e) {
        await this.switchToNextAdapter()
      }
    })

    return this.device
  },

  /** Try the next available GPU adapter. Returns null if none left. */
  async switchToNextAdapter(): Promise<GPUDevice | null> {
    this.device = null
    this.currentAdapterIndex++

    if (this.currentAdapterIndex >= this.adapters.length) {
      console.warn('No more GPU adapters to try')
      return null
    }

    const { adapter, name } = this.adapters[this.currentAdapterIndex]
    console.warn(`Switching to next GPU: ${name}`)

    try {
      this.device = await adapter.requestDevice()
      this.device.lost.then(async (info) => {
        console.warn(`GPU device lost (${name}):`, info.message)
        this.device = null
        await PipelineManager.resetAllPipelines()
      })
      console.warn(`Successfully switched to: ${name}`)
      return this.device
    } catch (e) {
      console.error(`Failed to init ${name}:`, e)
      return this.switchToNextAdapter() // try the next one
    }
  },

  /** Check if there are more adapters to try */
  hasMoreAdapters(): boolean {
    return this.currentAdapterIndex < this.adapters.length - 1
  },

  /** Check if WebGPU is available at all on this device */
  isAvailable(): boolean {
    return this.adapters.length > 0
  },
}

// -------------------------
// Pipeline Manager
// -------------------------
export class PipelineManager {
  static instances: Record<
    string,
    SupportedTasksNext8[keyof SupportedTasksNext8]
  > = {}

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

  static async getPipeline<T extends keyof SupportedTasksNext8>(
    task: T,
    model: string,
    progressCallback?: ProgressCallback
  ) {
    const key = `${task}-${model}`

    if (!this.instances[key]) {
      // Try WebGPU first, fall back to WASM if unavailable
      let device: 'webgpu' | 'wasm' = 'webgpu'
      try {
        await WebGPUDeviceManager.init()
        device = 'webgpu'
      } catch {
        console.warn('WebGPU not available, using WASM')
      }
      const dtype:
        | 'q4'
        | 'fp16'
        | 'fp32'
        | 'q4f16'
        | 'auto'
        | 'q8'
        | 'int8'
        | 'uint8'
        | 'bnb4'
        | Record<
            string,
            | 'q4'
            | 'fp16'
            | 'fp32'
            | 'q4f16'
            | 'auto'
            | 'q8'
            | 'int8'
            | 'uint8'
            | 'bnb4'
          >
        | undefined =
        device === 'webgpu'
          ? ((MODEL_DTYPE[model] as
              | 'q4'
              | 'fp16'
              | 'fp32'
              | 'q4f16'
              | 'auto'
              | 'q8'
              | 'int8'
              | 'uint8'
              | 'bnb4') ?? 'fp16')
          : 'auto'
      const opts = {
        device,
        dtype: 'q4f16' as const,
        progress_callback: progressCallback,
      }
      try {
        this.instances[key] = await pipelineNext8(task, model, opts)
      } catch (e) {
        console.warn(
          `Pipeline load failed for ${model}, resetting and retrying:`,
          e
        )
        await this.resetAllPipelines()
        this.instances[key] = await pipelineNext8(task, model, opts)
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
  if (Array.isArray(payload)) return (payload[0] as { generated_text?: string } | undefined)?.generated_text ?? ''
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const p = payload as { generated_text?: string; summary?: string }
    return p.generated_text ?? p.summary ?? ''
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
    'Xenova/mms-lid-126'
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

  await PipelineManager.disposePipeline(
    'audio-classification',
    'Xenova/mms-lid-126'
  )

  return { language, confidence }
}

// -------------------------
// Audio resampling
// -------------------------

const TARGET_SAMPLE_RATE = 16_000

function resampleAudio(
  audio: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return audio
  const ratio = fromRate / toRate
  const newLength = Math.round(audio.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, audio.length - 1)
    const frac = srcIdx - lo
    result[i] = audio[lo] * (1 - frac) + audio[hi] * frac
  }
  return result
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
    contentHint?: 'music' | 'speech' | 'auto'
  },
  onProgress: ProgressCallback,
  onPartialResult: PartialResultCallback
): Promise<string> {
  const resampled = resampleAudio(
    params.audio,
    params.sampleRate,
    TARGET_SAMPLE_RATE
  )
  const audio = resampled
  const sampleRate = TARGET_SAMPLE_RATE
  const { duration, language } = params
  const contentHint = params.contentHint ?? 'auto'

  // // Whisper prompt guides transcription style.
  // // - 'music': optimized for lyrics, ad-libs, slang
  // // - 'speech': no prompt, cleanest for lectures/greetings/conversations
  // // - 'auto': neutral prompt that doesn't bias either direction
  // const WHISPER_PROMPTS: Record<string, string | undefined> = {
  //   music:
  //     'The audio contains music with lyrics. Transcribe all sung words, ad-libs, slang, and repetitive phrases exactly as heard.',
  //   speech: undefined, // no prompt — Whisper is cleanest for speech without one
  //   auto: undefined, // no prompt by default — less hallucination risk
  // }
  // const whisperPrompt = WHISPER_PROMPTS[contentHint]

  // const asrPipe = await PipelineManager.getPipeline(
  //   'automatic-speech-recognition',
  //   'onnx-community/whisper-large-v3-turbo',
  //   onProgress
  // )

  const partialTexts: string[] = []
  const res = await transcribe({
    language: LANGUAGE_NAMES[params.language],
    audio: params.audio,
    progressCallback: onProgress,
  })

  console.log('Res: ', res)
  partialTexts.push(res)
  const transcriptionResult = normalizeTranscript(partialTexts)
  return transcriptionResult

  // const text = res
  // if (duration > 30) {
  //   // Use 60s audio chunks — Whisper internally splits each into 30s pieces
  //   // with 5s overlap (stride_length_s), handling word boundaries correctly.
  //   // This halves the number of GPU round-trips vs 30.5s chunks:
  //   // 19 min → ~19 chunks (vs ~38 with 30.5s chunks)
  //   const chunks = makeChunks(audio, sampleRate, 60, 0)

  //   console.log('Before enter the chunks loop.')
  //   for (const [index, chunk] of chunks.entries()) {
  //     // const chunkDuration = chunk.length /
  //     try {

  //       // if (DEBUG && res.chunks) {
  //       //   console.log(
  //       //     res.chunks
  //       //       .map((c) => `[${c.timestamp[0]} - ${c.timestamp[1]}]:${c.text}`)
  //       //       .join('\n')
  //       //   )
  //       // }
  //     } catch (err) {
  //       console.error(err)
  //     }
  //   }
  // } else {
  //   const res = await transcribe({
  //     language: LANGUAGE_NAMES[language],
  //     audio,
  //     progressCallback: onProgress,
  //   })

  //   partialTexts.push(res)

  //   // const res: ASRResult = await asrPipe(audio, {
  //   //   language,
  //   //   task: 'transcribe',
  //   //   return_whole_text: false,
  //   //   return_timestamps: true,
  //   //   return_language: true,
  //   //   batch_size: 16,
  //   //   ...(whisperPrompt ? { prompt: whisperPrompt } : {}),
  //   // })
  //   // if (!res.chunks)
  //   // if (res.chunks) {
  //   //   for (const { text, timestamp } of res.chunks) {
  //   //     partialTexts.push(text)
  //   //     onPartialResult('transcription', { text, timestamp })
  //   //   }
  //   // }
  // }

  // // await PipelineManager.disposePipeline(
  // //   'automatic-speech-recognition',
  // //   'onnx-community/whisper-large-v3-turbo'
  // // )

  // const transcriptionResult = normalizeTranscript(partialTexts)
  // return transcriptionResult
}
// export async function transcribeAudio(
//   params: {
//     audio: Float32Array
//     sampleRate: number
//     duration: number
//     language: string
//     contentHint?: 'music' | 'speech' | 'auto'
//   },
//   onProgress: ProgressCallback,
//   onPartialResult: PartialResultCallback
// ): Promise<string> {
//   const resampled = resampleAudio(params.audio, params.sampleRate, TARGET_SAMPLE_RATE)
//   const audio = resampled
//   const sampleRate = TARGET_SAMPLE_RATE
//   const { duration, language } = params
//   const contentHint = params.contentHint ?? 'auto'

//   // Whisper prompt guides transcription style.
//   // - 'music': optimized for lyrics, ad-libs, slang
//   // - 'speech': no prompt, cleanest for lectures/greetings/conversations
//   // - 'auto': neutral prompt that doesn't bias either direction
//   const WHISPER_PROMPTS: Record<string, string | undefined> = {
//     music:
//       'The audio contains music with lyrics. Transcribe all sung words, ad-libs, slang, and repetitive phrases exactly as heard.',
//     speech: undefined, // no prompt — Whisper is cleanest for speech without one
//     auto: undefined, // no prompt by default — less hallucination risk
//   }
//   const whisperPrompt = WHISPER_PROMPTS[contentHint]

//   const asrPipe = await PipelineManager.getPipeline(
//     'automatic-speech-recognition',
//     'onnx-community/whisper-large-v3-turbo',
//     onProgress
//   )

//   const partialTexts: string[] = []

//   if (duration > 30) {
//     // Use 60s audio chunks — Whisper internally splits each into 30s pieces
//     // with 5s overlap (stride_length_s), handling word boundaries correctly.
//     // This halves the number of GPU round-trips vs 30.5s chunks:
//     // 19 min → ~19 chunks (vs ~38 with 30.5s chunks)
//     const chunks = makeChunks(audio, sampleRate, 60, 0)

//     for (const [index, chunk] of chunks.entries()) {
//       const chunkDuration = chunk.length / sampleRate
//       const res: ASRResult = await asrPipe(chunk, {
//         language,
//         chunk_length_s: 30,
//         stride_length_s: 5,
//         return_whole_text: false,
//         return_timestamps: true,
//         batch_size: 16,
//         ...(whisperPrompt ? { prompt: whisperPrompt } : {}),
//       })
//       const text = res.text || ''
//       partialTexts.push(text)
//       onPartialResult('transcription', {
//         index,
//         text,
//         total: chunks.length,
//         progress: Math.round(((index + 1) / chunks.length) * 100),
//       })
//       if (DEBUG && res.chunks) {
//         console.log(
//           res.chunks
//             .map((c) => `[${c.timestamp[0]} - ${c.timestamp[1]}]:${c.text}`)
//             .join('\n')
//         )
//       }
//     }
//   } else {
//     const res: ASRResult = await asrPipe(audio, {
//       language,
//       task: 'transcribe',
//       return_whole_text: false,
//       return_timestamps: true,
//       return_language: true,
//       batch_size: 16,
//       ...(whisperPrompt ? { prompt: whisperPrompt } : {}),
//     })
//     if (!res.chunks) partialTexts.push(res.text)
//     if (res.chunks) {
//       for (const { text, timestamp } of res.chunks) {
//         partialTexts.push(text)
//         onPartialResult('transcription', { text, timestamp })
//       }
//     }
//   }

//   const transcriptionResult = normalizeTranscript(partialTexts)
//   await PipelineManager.disposePipeline(
//     'automatic-speech-recognition',
//     'onnx-community/whisper-large-v3-turbo'
//   )
//   return transcriptionResult
// }
// ============================================================
// Optimized inference settings + prompts for tiny-aya-global
// ============================================================

// -------------------------
// Summarization (Phi-4-mini-instruct)
// -------------------------

export async function summarizeText(
  params: { text: string; language: string },
  onProgress: ProgressCallback
): Promise<string> {
  // Replace in summarizeText:
  const pipe = await PipelineManager.getPipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX',
    onProgress
  )

  let messages: ChatMessage[] = []
  const summarizedChunks: string[] = []

  try {
    if (params.text && params.text.length > 1500) {
      // ^^^ Changed from 512 to 1500 — 512 chars splits mid-sentence in Hebrew.
      //     Phi-4-mini has 16k context, we can afford larger chunks.
      const chunks = toChunk(params.text, 1500)
      for (const [i, chunk] of chunks.entries()) {
        messages = [
          { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT(params) },
          // FIX: don't add "summarize this text in X:" — system prompt already says this
          { role: 'user', content: chunk },
        ]

        const prompt = pipe.tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        }) as string

        const output = await pipe(prompt, {
          max_new_tokens: 256,
          do_sample: false, // greedy — most reliable for this model
          repetition_penalty: 1.1,
          return_full_text: false,
        })
        summarizedChunks.push(serializeSummaryPayload(output[0]))
      }
    } else {
      messages = [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT(params) },
        // FIX: removed "summarize this text in X:" — redundant with system prompt
        //      and confuses the model by giving conflicting framing
        { role: 'user', content: params.text },
      ]
      const tokens = pipe.tokenizer.tokenize(params.text)
      const prompt = pipe.tokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      }) as string

      const output = await pipe(prompt, {
        max_new_tokens: 256,
        do_sample: false, // greedy — most reliable for this model
        repetition_penalty: 1.1,
        return_full_text: false,
      })
      summarizedChunks.push(serializeSummaryPayload(output[0]))
    }
    return summarizedChunks.join(' ')
  } finally {
    await (pipe as unknown as { dispose?: () => Promise<void> }).dispose?.()
  }
}

// -------------------------
// Grammar / typo correction (tiny-aya-global)
// -------------------------

export async function correctTranscript(
  params: { text: string; language: string },
  onProgress: ProgressCallback
): Promise<string> {
  await PipelineManager.resetAllPipelines()

  const systemPrompt = CORRECT_TRANSCRIPT_SYSTEM_PROMPT(params)
  const chunks =
    params.text.length > 600 ? toChunk(params.text, 600) : [params.text]
  const correctedChunks: string[] = []
  const inferenceOpts = (tokenCount: number) => ({
    max_new_tokens: Math.min(tokenCount + 20, 300),
    do_sample: false,
    return_full_text: false,
    repetition_penalty: 1.05,
  })

  const buildPrompt = (pipe: any, chunk: string) => {
    const msg: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: chunk },
    ]
    return pipe.tokenizer.apply_chat_template(msg, {
      tokenize: false,
      add_generation_prompt: true,
    }) as string
  }

  // ── Route chunk 1 ─────────────────────────────────────────────────────
  let startIndex = 0

  if (chunks.length > 0) {
    // Use secondary GPU for chunk 1 while primary cools
    try {
      const secondaryPipe = await pipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX',
        {
          device: 'webgpu' as const,
          dtype: (MODEL_DTYPE['onnx-community/tiny-aya-global-ONNX'] ??
            'fp16') as 'fp16',
          progress_callback: onProgress,
        }
      )
      try {
        const prompt = buildPrompt(secondaryPipe, chunks[0])
        const tokens = secondaryPipe.tokenizer.tokenize(chunks[0])
        const output = await secondaryPipe(prompt, inferenceOpts(tokens.length))
        correctedChunks.push(serializeSummaryPayload(output))
        startIndex = 1
      } finally {
        await secondaryPipe?.dispose?.()
      }
    } catch (e) {
      console.warn('Secondary GPU failed, will use primary with delay:', e)
    }
  }

  // If no secondary GPU handled chunk 1, brief delay then use primary
  if (startIndex === 0 && chunks.length > 0) {
    await new Promise((r) => setTimeout(r, 3000))
  }

  // ── All remaining chunks on primary GPU ───────────────────────────────
  if (startIndex < chunks.length) {
    WebGPUDeviceManager.currentAdapterIndex = 0
    WebGPUDeviceManager.device = null

    const primaryPipe = await PipelineManager.getPipeline(
      'text-generation',
      'onnx-community/tiny-aya-global-ONNX',
      onProgress
    )

    try {
      for (let i = startIndex; i < chunks.length; i++) {
        try {
          const prompt = buildPrompt(primaryPipe, chunks[i])
          const tokens = primaryPipe.tokenizer.tokenize(chunks[i])
          const output = await primaryPipe(prompt, inferenceOpts(tokens.length))
          correctedChunks.push(serializeSummaryPayload(output))
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e)
          if (!errMsg.includes('Device') || !errMsg.includes('lost')) throw e

          // GPU crashed on this chunk — WASM for THIS chunk only
          console.warn(
            `GPU crashed on chunk ${i + 1}, WASM for this chunk only`
          )
          await PipelineManager.resetAllPipelines()

          const wasmPipe = await pipeline(
            'text-generation',
            'onnx-community/tiny-aya-global-ONNX',
            {
              device: 'wasm' as const,
              dtype: 'q4' as const,
              progress_callback: onProgress,
            }
          )
          try {
            const prompt = buildPrompt(wasmPipe, chunks[i])
            const tokens = wasmPipe.tokenizer.tokenize(chunks[i])
            const output = await wasmPipe(prompt, inferenceOpts(tokens.length))
            correctedChunks.push(serializeSummaryPayload(output))
          } finally {
            await wasmPipe?.dispose?.()
          }

          // Try to recover GPU for next chunk
          WebGPUDeviceManager.currentAdapterIndex = 0
          WebGPUDeviceManager.device = null
          try {
            await WebGPUDeviceManager.init()
          } catch {
            /* GPU may stay dead */
          }
        }
      }
    } finally {
      await PipelineManager.disposePipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX'
      )
    }
  }

  return correctedChunks.join(' ')
}

// -------------------------
// Tag generation (tiny-aya-global)
// -------------------------

export async function generateTagsFromText(
  params: { text: string; language: string },
  onProgress: ProgressCallback
): Promise<string[]> {
  await PipelineManager.resetAllPipelines()

  const pipe = await PipelineManager.getPipeline(
    'text-generation',
    'onnx-community/tiny-aya-global-ONNX',
    onProgress
  )

  const { text } = params
  const inputText =
    text.length <= 1500 // FIX: was 1000, give model more context
      ? text
      : text.slice(0, 800) + ' [...] ' + text.slice(-400) // FIX: was 600+400

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
