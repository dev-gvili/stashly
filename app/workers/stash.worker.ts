/// <reference types="@webgpu/types" />
import {
  pipeline,
  env,
  type SupportedTasks,
} from '@huggingface/transformers'


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

/** System prompt used for all summarization requests */
const SUMMARIZE_SYSTEM_PROMPT =
  'You are an expert summarization AI. Summarize the following text. Use the language of the input text. Be concise and focus on the main points. Use bullet points (2 bullets max per section) for clarity. Use up to 2 section max. Include all person names and details in the summary. If the text is very short, provide a single-sentence summary. If the text is a list of items, summarize each item concisely. If the text is a conversation, summarize the key topics and outcomes. USE THE SAME LANGUAGE AS THE INPUT TEXT. Do not output anything else other than the summary, If the text is in a language other than English, summarize in that language.'

/** Per-model dtype overrides; all other models default to 'fp16' */
const MODEL_DTYPE: Record<string, string | Record<string, string>> = {
  'onnx-community/tiny-aya-global-ONNX': 'q4',
  'LiquidAI/LFM2.5-VL-1.6B-ONNX': { decoder: 'q4', embedImages: 'q4' },
}

// -------------------------
// Type Definitions
// -------------------------

/** Worker message types */
type WorkerMessageType =
  | 'transcribe'
  | 'summarize'
  | 'classify'
  | 'caption'
  | 'extract-keywords'
  | 'status'
  | 'progress'
  | 'debug'
  | 'error'
  | 'result'
  | 'language-detected'
  | 'partial-result'
  | 'audio-duration'

/** Message sent from main thread to worker */
type WorkerMessage =
  | { type: 'transcribe'; payload: { audio: Float32Array; sampleRate: number; duration: number } }
  | { type: 'summarize'; payload: { text: string } }
  | { type: 'classify'; payload: { text: string } }
  | { type: 'extract-keywords'; payload: { text: string } }

/** Message sent from worker to main thread */
interface WorkerResponse {
  type: WorkerMessageType
  task?: string
  payload?: unknown
}

/** Pipeline options for model loading */
interface PipelineOptions {
  device: string | GPUDevice
  dtype: 'q4' | 'q4f16' | 'q8' | 'fp16' | 'fp32' | 'auto'
  progress_callback?: (progress: ProgressData) => void
}

/** Progress callback data */
interface ProgressData {
  status?: string
  progress?: number
}

/** Extraction chunk parameters */
interface ExtractAudioChunkParams {
  audio: Float32Array
  startSeconds: number
  durationSeconds: number
  sampleRate?: number
}

/** Language detection result */
interface LanguageDetectionResult {
  label: string
  score: number
}

/** Caption result */
interface CaptionResult {
  caption: string
}

/** ASR result from Whisper */
interface ASRResult {
  text: string
}

/** Text classification result */
interface ClassificationResult {
  label: string
  score: number
}

/** Chat message for text generation */
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
      self.postMessage({
        type: 'debug',
        payload: `WebGPU profiling: ${JSON.stringify(data, null, 2)}`,
      }),
  }
}
env.allowLocalModels = false
env.useBrowserCache = true // Enable browser cache for faster model re-loads
env.allowRemoteModels = true
// env.backends!.onnx!.wasm!.proxy = true

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
    console.log(
      'WebGPU adapter and device initialized',
      this.adapter,
      this.device
    )

    if (!this.listenersAttached) {
      this.listenersAttached = true

      this.device.lost.then(async (info) => {
        console.warn('WebGPU device lost:', info.message)

        // Recreate adapter + device
        this.adapter = await navigator.gpu.requestAdapter()
        if (!this.adapter) {
          throw new Error('WebGPU adapter not available after device loss')
        }
        this.device = await this.adapter.requestDevice()

        console.warn('WebGPU device restored')

        // Reset pipelines so they rebuild with the new device
        PipelineManager.resetAllPipelines()
      })
    }

    return this.device
  },
}

// -------------------------
// Pipeline Manager
// -------------------------
class PipelineManager {
  static instances: Record<string, any> = {}

  static resetAllPipelines(): void {
    console.warn('Resetting all pipelines due to device loss')
    for (const key in this.instances) {
      try {
        this.instances[key].dispose?.()
      } catch (e) {
        console.warn('Error disposing pipeline during reset', key, e)
      }
    }
    this.instances = {}
  }

  static async getPipeline<T extends keyof SupportedTasks>(
    task: T,
    model: string,
    progressCallback?: (data: ProgressData) => void
  ) {
    const key = `${task}-${model}`

    if (!this.instances[key]) {
      await WebGPUDeviceManager.init()
      try {
        this.instances[key] = await pipeline(task, model, {
          device: 'webgpu',
          dtype: (MODEL_DTYPE[model] ?? 'fp16') as any,
          progress_callback: progressCallback,
          session_options: {
            extra: {
              optimization: {
                enable_gelu_approximation: 1,
              },
            },
          },
        })
      } catch (error) {
        self.postMessage({
          type: 'debug',
          payload: `Pipeline loading error for ${model}: ${error instanceof Error ? error.message : String(error)}`,
        } as WorkerResponse)
        throw error
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
// Worker message handler
// -------------------------
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data
  try {
    if (type === 'transcribe') {
      const { audio: audioInput, sampleRate, duration } = payload

      self.postMessage({
        type: 'audio-duration',
        payload: Math.round(duration),
      } as WorkerResponse)
      // -------------------------
      // 1. LANGUAGE DETECTION (LID)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'detecting-language',
      } as WorkerResponse)

      const LID_SAMPLE_RATE = 16000

      let languageDetectionPipe = await PipelineManager.getPipeline(
        'audio-classification',
        'Xenova/mms-lid-256',
        (data) => {
          self.postMessage({
            type: 'progress',
            payload: data,
          } as WorkerResponse)
        }
      )

      let audioChunk = extractAudioChunk({
        audio: audioInput,
        startSeconds: 0,
        durationSeconds: LID_SHORT_CHUNK_SEC,
        sampleRate: LID_SAMPLE_RATE,
      })

      let languageDetectionResult: LanguageDetectionResult[] =
        await languageDetectionPipe(audioChunk, { top_k: 1 })

      let detectedLanguage = 'en'
      let confidence = 0

      if (languageDetectionResult && languageDetectionResult.length > 0) {
        let { label, score } = languageDetectionResult[0]
        confidence = score ?? 0

        if (confidence < LID_HIGH_CONFIDENCE) {
          self.postMessage({
            type: 'debug',
            payload:
              'Low confidence language detected: ' +
              (confidence * 100).toFixed(2) +
              '%, retrying with longer chunk',
          } as WorkerResponse)

          audioChunk = extractAudioChunk({
            audio: audioInput,
            startSeconds: 0,
            durationSeconds: LID_LONG_CHUNK_SEC,
            sampleRate: LID_SAMPLE_RATE,
          })

          languageDetectionResult = await languageDetectionPipe(audioChunk, {
            top_k: 1,
          })
          if (languageDetectionResult && languageDetectionResult.length > 0) {
            ;({ label, score } = languageDetectionResult[0])
            confidence = score ?? 0
          }
        }

        if (languageDetectionResult && languageDetectionResult.length > 0) {
          const rawLabel = languageDetectionResult[0].label || ''
          if (rawLabel.length >= 2 && confidence >= LID_MIN_CONFIDENCE) {
            const potentialLanguage = rawLabel.slice(0, 2).toLowerCase()
            // Only use the detected language if it's in our supported list
            if (SUPPORTED_LANGUAGES.has(potentialLanguage)) {
              detectedLanguage = potentialLanguage
            } else {
              self.postMessage({
                type: 'debug',
                payload: 'Unsupported language detected: ' + potentialLanguage,
              } as WorkerResponse)
              detectedLanguage = 'en' // Fallback to English if unsupported
            }
          } else {
            detectedLanguage = 'en'
          }
        }
      }

      self.postMessage({
        type: 'language-detected',
        payload: {
          language: detectedLanguage,
          confidence,
        },
      } as WorkerResponse)

      // dispose LID pipeline to free resources for transcription
      await PipelineManager.disposePipeline(
        'audio-classification',
        'Xenova/mms-lid-256'
      )

      // -------------------------
      // 2. TRANSCRIPTION (WHISPER)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'transcribing',
      } as WorkerResponse)

      let asrPipe
      let modelPath = ''

      // Try primary model first
      try {
        self.postMessage({
          type: 'debug',
          payload:
            'Attempting to load whisper-large-v3-turbo from Hugging Face...',
        } as WorkerResponse)

        asrPipe = await PipelineManager.getPipeline(
          'automatic-speech-recognition',
          'onnx-community/whisper-large-v3-turbo',
          (data) =>
            self.postMessage({
              type: 'progress',
              payload: data,
            } as WorkerResponse)
        )
        modelPath = 'onnx-community/whisper-large-v3-turbo'

        self.postMessage({
          type: 'debug',
          payload: '✓ Successfully loaded whisper-large-v3-turbo',
        } as WorkerResponse)
      } catch (error) {
        self.postMessage({
          type: 'debug',
          payload: `✗ Failed to load whisper-large-v3-turbo. Error: ${error instanceof Error ? error.message : String(error)}. Trying Xenova/whisper-small...`,
        } as WorkerResponse)

        try {
          asrPipe = await PipelineManager.getPipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-small',
            (data) =>
              self.postMessage({
                type: 'progress',
                payload: data,
              } as WorkerResponse)
          )
          modelPath = 'Xenova/whisper-small'

          self.postMessage({
            type: 'debug',
            payload: '✓ Successfully loaded Xenova/whisper-small',
          } as WorkerResponse)
        } catch (secondError) {
          self.postMessage({
            type: 'debug',
            payload: `✗ Failed to load Xenova/whisper-small. Error: ${secondError instanceof Error ? secondError.message : String(secondError)}. Trying Xenova/whisper-tiny...`,
          } as WorkerResponse)

          asrPipe = await PipelineManager.getPipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-tiny',
            (data) =>
              self.postMessage({
                type: 'progress',
                payload: data,
              } as WorkerResponse)
          )
          modelPath = 'Xenova/whisper-tiny'

          self.postMessage({
            type: 'debug',
            payload: '✓ Successfully loaded Xenova/whisper-tiny',
          } as WorkerResponse)
        }
      }

      self.postMessage({
        type: 'debug',
        payload: `Starting transcription with ${modelPath}...`,
      } as WorkerResponse)

      const chunks = makeChunks(audioInput, sampleRate, 30, 0)

      let index = 0
      const partialTexts: string[] = []

      for (const chunk of chunks) {
        const res: ASRResult = await asrPipe(chunk, {
          language: detectedLanguage,
          // force_full_sequences: true,
          remove_invalid_values: true,
          chunk_length_s: 30, // slightly shorter than chunk size to account for stride and avoid cutting off words
          stride_length_s: 3, // overlap to help with continuity and avoid cutting off words
          task: 'transcribe',
          return_timestamps: true,
          return_whole_text: false,
        })

        const text = res.text || ''
        partialTexts.push(text)

        self.postMessage({
          type: 'partial-result',
          task: 'transcription',
          payload: { index, text },
        } as WorkerResponse)

        index++
        self.postMessage({
          type: 'debug',
          payload: `Processing chunk ${index} of ${chunks.length}`,
        } as WorkerResponse)
      }

      // join partial results with proper spacing and punctuation
      const transcriptionResult = partialTexts.join('. ').trim()

      self.postMessage({
        type: 'debug',
        payload: 'Transcription completed',
      } as WorkerResponse)

      // send final transcription result to main thread
      self.postMessage({
        type: 'result',
        task: 'transcription',
        payload: transcriptionResult,
      } as WorkerResponse)

      // dispose ASR pipeline to free resources for summarization
      await PipelineManager.disposePipeline('automatic-speech-recognition', modelPath)
    } else if (type === 'summarize') {
      // -------------------------
      // 3. SUMMARIZATION (onnx-community/tiny-aya-global-ONNX)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'summarizing',
      } as WorkerResponse)
      self.postMessage({
        type: 'debug',
        payload: 'Loading summarization model...',
      } as WorkerResponse)
      PipelineManager.resetAllPipelines()

      const pipe = await PipelineManager.getPipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX',
        (data) =>
          self.postMessage({
            type: 'progress',
            payload: data,
          } as WorkerResponse)
      )

      self.postMessage({
        type: 'debug',
        payload: 'Loaded summarization model',
      } as WorkerResponse)
      self.postMessage({
        type: 'debug',
        payload: 'Preparing prompt for summarization...',
      } as WorkerResponse)

      let messages: ChatMessage[] = []
      let chunks: string[] = []
      let summarizedChunks: string[] = []

      if (payload.text && payload.text.length > 512) {
        chunks = toChunk(payload.text, 512)
        self.postMessage({
          type: 'debug',
          payload: `Text too long, splitting into ${chunks.length} chunks`,
        })

        for (const [i, chunk] of chunks.entries()) {
          messages = [
            {
              role: 'system',
              content: SUMMARIZE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: chunk,
            },
          ]

          self.postMessage({
            type: 'debug',
            payload: 'Applying chat template...',
          } as WorkerResponse)

          const prompt = pipe.tokenizer.apply_chat_template(messages, {
            tokenize: false,
            add_generation_prompt: true,
          }) as string

          self.postMessage({
            type: 'debug',
            payload: `Generating summary for chunk ${i + 1} of ${chunks.length}`,
          } as WorkerResponse)

          const output = await pipe(prompt, {
            max_new_tokens: 128,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            repetition_penalty: 1.1,
            return_full_text: false, // Only return the newly generated tokens
          })
          summarizedChunks.push(output[0].generated_text)
          console.log('Summarization output', output[0].generated_text)
        }
        // generate final summarization from all the summarized chunks

        self.postMessage({
          type: 'debug',
          payload: 'Generating final summary...',
        } as WorkerResponse)

        messages = [
          { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
          { role: 'user',   content: summarizedChunks.join(' ') },
        ]

        const finalPrompt = pipe.tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        }) as string

        const finalOutput = await pipe(finalPrompt, {
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
          repetition_penalty: 1.1,
          return_full_text: false, // Only return the newly generated tokens
        })
        summarizedChunks = [finalOutput[0].generated_text]
        self.postMessage({
          type: 'debug',
          payload: 'Final summary generated',
        } as WorkerResponse)
      } else {
        messages = [
          { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
          { role: 'user',   content: payload.text },
        ]

        self.postMessage({
          type: 'debug',
          payload: 'Applying chat template...',
        } as WorkerResponse)

        const prompt = pipe.tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        }) as string

        self.postMessage({
          type: 'debug',
          payload: 'Generating summary...',
        } as WorkerResponse)

        const output = await pipe(prompt, {
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
          repetition_penalty: 1.1,
          return_full_text: false, // Only return the newly generated tokens
        })

        console.log('Summarization output', output)
        summarizedChunks.push(output[0].generated_text)
        // send final summarization result to main thread
      }
      // send final summarization result to main thread
      self.postMessage({
        type: 'result',
        task: 'summarization',
        payload: { generated_text: summarizedChunks.join(' ') },
      } as WorkerResponse)
      // dispose summarization pipeline to free resources
      await PipelineManager.disposePipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX'
      )
    } else if (type === 'caption') {
      // -------------------------
      // 5. IMAGE CAPTIONING (BLIP-2 or LFM2.5-VL-1.6B-ONNX)
      // -------------------------
      // self.postMessage({
      //   type: 'status',
      //   payload: 'captioning',
      // } as WorkerResponse)

      // currently not supported
      self.postMessage({
        type: 'debug',
        payload: `Not supported yet: ${type}`,
      } as WorkerResponse)
    } else if (type === 'extract-keywords') {
      try {
        self.postMessage({ type: 'status', payload: 'extract-keywords' })
        const model = await PipelineManager.getPipeline(
          'text-classification',
          'Xenova/xlm-roberta-base',
          // 'Xenova/bert-base-multilingual-cased',
          (data) =>
            self.postMessage({
              type: 'progress',
              payload: data,
            } as WorkerResponse)
        )

        // Run Entity Recognition
        const results = await model(payload.text!)
        console.log('Entity Recognition Results:', results)
        // Post-process: Reassemble sub-tokens into full words
        // BERT uses '##' to indicate a sub-token that belongs to the previous token.
        const processedKeywords: string[] = []
        let currentWord = ''

        results.forEach((r: any) => {
          if (r.score > 0.4) {
            // Slightly lower threshold to capture Hebrew parts accurately
            const wordPart = r.word

            if (wordPart.startsWith('##')) {
              // Append sub-token to the current word
              currentWord += wordPart.replace('##', '')
            } else {
              // New word started; save the previous one if it exists
              if (currentWord.length > 2) {
                processedKeywords.push(currentWord)
              }
              currentWord = wordPart
            }
          }
        })

        // Push the final word
        if (currentWord.length > 2) {
          processedKeywords.push(currentWord)
        }

        // Return unique keywords
        const finalKeywords = Array.from(new Set(processedKeywords))
        console.log('Final Keywords:', finalKeywords)

        self.postMessage({
          type: 'result',
          task: 'extract-keywords',
          payload: { keywords: finalKeywords },
        } as WorkerResponse)
      } catch (err: any) {
        self.postMessage({ type: 'error', payload: err.message })
      }
    } else {
      self.postMessage({
        type: 'debug',
        payload: `Unknown task type: ${type}`,
      } as WorkerResponse)
    }
  } catch (error) {
    console.error('Worker error:', error)
    self.postMessage({
      type: 'debug',
      payload: `Error: ${error instanceof Error ? error.message : String(error)}`,
    } as WorkerResponse)
    if (error instanceof Error) {
      self.postMessage({
        type: 'error',
        payload: error.message,
      } as WorkerResponse)
    }
  }
})

// -------------------------
// Helper functions
// -------------------------

/**
 * Extracts a chunk of audio data from a larger audio buffer
 * @param audio - The full audio buffer
 * @param startSeconds - Start time in seconds
 * @param durationSeconds - Duration of chunk in seconds
 * @param sampleRate - Sample rate in Hz (default: 16000)
 * @returns Audio chunk as Float32Array
 */
function extractAudioChunk({
  audio,
  startSeconds,
  durationSeconds,
  sampleRate = 16000,
}: ExtractAudioChunkParams): Float32Array {
  const startSample = Math.floor(startSeconds * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSeconds + durationSeconds) * sampleRate),
    audio.length
  )

  if (startSample >= audio.length || startSample >= endSample) {
    return new Float32Array(0)
  }

  return audio.slice(startSample, endSample)
}

/**
 * Splits audio into chunks of specified duration with optional stride
 * @param audio - The full audio buffer
 * @param sampleRate - Sample rate in Hz
 * @param chunkSec - Chunk duration in seconds
 * @param strideSec - Stride/overlap in seconds (default: 0)
 * @returns Array of audio chunks
 */
function makeChunks(
  audio: Float32Array,
  sampleRate: number,
  chunkSec: number,
  strideSec: number = 0
): Float32Array[] {
  const chunkSize = Math.floor(chunkSec * sampleRate)
  const strideSize = Math.floor(strideSec * sampleRate)
  const chunks: Float32Array[] = []

  for (let start = 0; start < audio.length; start += chunkSize - strideSize) {
    const end = Math.min(start + chunkSize, audio.length)
    chunks.push(audio.slice(start, end))
    if (end === audio.length) break
  }

  return chunks
}


function toChunk(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks
}
