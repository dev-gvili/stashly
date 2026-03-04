/// <reference types="@webgpu/types" />
import {
  pipeline,
  env,
  type TaskType,
  load_image,
  type SupportedTasks,
  AutoModelForImageTextToText,
  AutoProcessor,
  Lfm2MoeForCausalLM,
  AutoModel,
  Lfm2ForCausalLM,
} from '@huggingface/transformers'

// -------------------------
// Type Definitions
// -------------------------

/** Worker message types */
type WorkerMessageType =
  | 'transcribe'
  | 'summarize'
  | 'classify'
  | 'caption'
  | 'caption-'
  | 'status'
  | 'progress'
  | 'debug'
  | 'error'
  | 'result'
  | 'language-detected'
  | 'partial-result'
  | 'audio-duration'

/** Message sent from main thread to worker */
interface WorkerMessage {
  type: 'transcribe' | 'summarize' | 'classify' | 'caption'
  payload: {
    audio: Float32Array
    sampleRate: number
    duration: number
    text?: string
    uri?: string
  }
}

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

/** Multi-modal chat message for image-to-text tasks */
interface MultiModalChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; image?: any; text?: string }>
}

// -------------------------
// Environment configuration
// -------------------------
env.backends.onnx!.webgpu!.profiling = {
  mode: 'default',
  ondata: (data) =>
    self.postMessage({
      type: 'debug',
      payload: `WebGPU profiling: ${JSON.stringify(data, null, 2)}`,
    }),
}
env.allowLocalModels = false
env.useBrowserCache = true // Disable browser cache to prevent corrupted model downloads
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
          dtype:
            model === 'onnx-community/tiny-aya-global-ONNX'
              ? 'q4'
              : model === 'LiquidAI/LFM2.5-VL-1.6B-ONNX'
                ? {
                    decoder: 'q4',
                    embedImages: 'q4',
                  }
                : 'fp16',
          progress_callback: progressCallback,
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

// Ensure device is initialized early
await WebGPUDeviceManager.init()

// -------------------------
// Worker message handler
// -------------------------
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data
  const audioInput = payload.audio
  const sampleRate = payload.sampleRate
  const duration = payload.duration

  self.postMessage({
    type: 'audio-duration',
    payload: Math.round(duration),
  } as WorkerResponse)
  try {
    if (type === 'transcribe') {
      // -------------------------
      // 1. LANGUAGE DETECTION (LID)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'detecting-language',
      } as WorkerResponse)

      const LID_SAMPLE_RATE = 16000
      const LID_DURATION_SEC = 8

      let languageDetectionPipe = await PipelineManager.getPipeline(
        'audio-classification',
        'Xenova/mms-lid-256',
        (data) =>
          self.postMessage({
            type: 'progress',
            payload: data,
          } as WorkerResponse)
      )

      let audioChunk = extractAudioChunk({
        audio: audioInput,
        startSeconds: 0,
        durationSeconds: LID_DURATION_SEC,
        sampleRate: LID_SAMPLE_RATE,
      })

      let languageDetectionResult: LanguageDetectionResult[] =
        await languageDetectionPipe(audioChunk, { top_k: 1 })

      let detectedLanguage = 'en'
      let confidence = 0
      let supportedLanguages = [
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
      ]

      if (languageDetectionResult && languageDetectionResult.length > 0) {
        let { label, score } = languageDetectionResult[0]
        confidence = score ?? 0

        if (confidence < 0.7) {
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
            durationSeconds: 15,
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
          if (rawLabel.length >= 2 && confidence >= 0.6) {
            const potentialLanguage = rawLabel.slice(0, 2).toLowerCase()
            // Only use the detected language if it's in our supported list
            if (supportedLanguages.includes(potentialLanguage)) {
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
      let modelUsed = ''

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
        modelUsed = 'whisper-large-v3-turbo'

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
          modelUsed = 'whisper-small'

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
          modelUsed = 'whisper-tiny'

          self.postMessage({
            type: 'debug',
            payload: '✓ Successfully loaded Xenova/whisper-tiny',
          } as WorkerResponse)
        }
      }

      self.postMessage({
        type: 'debug',
        payload: `Starting transcription with ${modelUsed}...`,
      } as WorkerResponse)
      const chunks = makeChunks(audioInput, sampleRate, 18, 0)

      let index = 0
      const partialTexts: string[] = []

      for (const chunk of chunks) {
        const res: ASRResult = await asrPipe(chunk, {
          language: detectedLanguage,
          // force_full_sequences: true,
          remove_invalid_values: true,
          chunk_length_s: 18, // slightly shorter than chunk size to account for stride and avoid cutting off words
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
      await PipelineManager.disposePipeline(
        'automatic-speech-recognition',
        modelUsed.startsWith('onnx')
          ? 'onnx-community/whisper-large-v3-turbo'
          : `Xenova/${modelUsed}`
      )
    } else if (type === 'summarize') {
      // -------------------------
      // 3. SUMMARIZATION (Phi-4-mini-instruct-ONNX-GQA)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'summarizing',
      } as WorkerResponse)
      self.postMessage({
        type: 'debug',
        payload: 'Loading summarization model...',
      } as WorkerResponse)
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
      // 3. Construct a chat-templated prompt
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are an expert summarization AI. Summarize the following text. Use the language of the input text. Be concise and focus on the main points. Use bullet points (2-3 bullets max per section) for clarity. Include all person names and details in the summary. If the text is very short, provide a single-sentence summary. If the text is a list of items, summarize each item concisely. If the text is a conversation, summarize the key topics and outcomes. USE THE SAME LANGUAGE AS THE INPUT TEXT. Do not output anything else other than the summary, If the text is in a language other than English, summarize in that language.',
        },
        {
          role: 'user',
          content: payload.text || '',
        },
      ]

      // console.log('Constructed messages for summarization:', messages);

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
      // send final summarization result to main thread
      self.postMessage({
        type: 'result',
        task: 'summarization',
        payload: output,
      } as WorkerResponse)

      // dispose summarization pipeline to free resources for text generation
      await PipelineManager.disposePipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX'
      )
    } else if (type === 'classify') {
      // -------------------------
      // 4. SENTIMENT ANALYSIS (DISTILBERT-SST-2)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'classifying',
      } as WorkerResponse)

      // This is a small, efficient model fine-tuned for sentiment analysis on the SST-2 dataset. It's quantized to 4-bit for fast inference on WebGPU, making it suitable for client-side sentiment classification tasks.
      const pipe = await PipelineManager.getPipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX',
        (data) =>
          self.postMessage({
            type: 'progress',
            payload: data,
          } as WorkerResponse)
      )

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: `Describe the tone of the following text. ${payload.text}
`,
        },
      ]

      // console.log('Constructed messages for summarization:', messages);

      self.postMessage({
        type: 'debug',
        payload: 'Applying chat template...',
      } as WorkerResponse)
      const prompt = pipe.tokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      }) as string

      // we classify the sentiment of the input text (could be transcript or user input)
      const output = await pipe(prompt, {
        return_full_text: false,
      })

      console.log('Classification output', output)
      // send final sentiment classification result to main thread
      self.postMessage({
        type: 'result',
        task: 'classification',
        payload: output,
      } as WorkerResponse)

      // dispose classification pipeline to free resources for text classification
      await PipelineManager.disposePipeline(
        'text-generation',
        'onnx-community/tiny-aya-global-ONNX'
      )
    } else if (type === 'caption') {
      // -------------------------
      // 5. IMAGE CAPTIONING (BLIP-2 or LFM2.5-VL-1.6B-ONNX)
      // -------------------------
      self.postMessage({
        type: 'status',
        payload: 'captioning',
      } as WorkerResponse)

      // ONNX Runtime path for LiquidAI/LFM2.5-VL-1.6B-ONNX (WebGPU)
      // Only runs if payload.model === 'LiquidAI/LFM2.5-VL-1.6B-ONNX' (add this to your message payload as needed)
      if (payload.model === 'LiquidAI/LFM2.5-VL-1.6B-ONNX') {
        try {
          const { runLFM25VL16B_ONNX } = await import('./onnx-lfm2-vl-16b')
          // Convert image to ort.Tensor as required by your ONNX model
          // (You may need to adapt this conversion for your model's input signature)
          const image = load_image(payload.uri || '')
          // TODO: Convert image to ort.Tensor (see onnx-lfm2-vl-16b.ts for expected input)
          // Example: const imageTensor = ...
          // For now, just pass image as-is (replace with actual tensor conversion)
          const imageTensor = image
          const prompt = 'describe the image in detail.'
          const result = await runLFM25VL16B_ONNX(imageTensor, prompt)
          self.postMessage({
            type: 'result',
            task: 'captioning',
            payload: result,
          } as WorkerResponse)
        } catch (err) {
          self.postMessage({
            type: 'debug',
            payload: `ONNX Runtime error: ${err instanceof Error ? err.message : String(err)}`,
          } as WorkerResponse)
        }
        return
      }

      // Default: transformers.js pipeline (existing logic)
      let model_id = 'onnx-community/LFM2-VL-450M-ONNX'
      const pipe = await PipelineManager.getPipeline(
        'image-to-text',
        'onnx-community/LFM2-VL-450M-ONNX',
        (data) =>
          self.postMessage({
            type: 'progress',
            payload: data,
          } as WorkerResponse)
      )
      let image = load_image(payload.uri || '')
      const messages: MultiModalChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'image', image: image },
            { type: 'text', text: 'describe the image in detail.' },
          ],
        },
      ] as MultiModalChatMessage[]

      const prompt = pipe.tokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      })

      const output = await pipe(prompt, {
        max_new_tokens: 100,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
        repetition_penalty: 1.1,
        return_full_text: false, // Only return the newly generated tokens
      })
      console.log('Captioning output', output)
      // send final captioning result to main thread
      const caption = output
      self.postMessage({
        type: 'result',
        task: 'captioning',
        payload: caption,
      } as WorkerResponse)

      // dispose captioning pipeline to free resources
      await PipelineManager.disposePipeline(
        'image-to-text',
        'LiquidAI/LFM2.5-VL-1.6B-ONNX'
      )
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

/**
 * Optional fallback for WebAudio-based audio extraction
 * @param audioData - The full audio buffer
 * @param startSec - Start time in seconds
 * @param durationSec - Duration in seconds
 * @param sampleRate - Sample rate in Hz (default: 16000)
 * @returns Audio chunk as Float32Array
 */
async function extractAudioChunkWithWebAudio(
  audioData: Float32Array,
  startSec: number,
  durationSec: number,
  sampleRate: number = 16000
): Promise<Float32Array> {
  const OfflineCtx =
    (self as any).OfflineAudioContext || (self as any).webkitOfflineAudioContext

  if (!OfflineCtx) {
    const startSample = Math.floor(startSec * sampleRate)
    const endSample = Math.min(
      Math.ceil((startSec + durationSec) * sampleRate),
      audioData.length
    )
    return audioData.slice(startSample, endSample)
  }

  const audioDataLength = audioData.length
  const offlineContext = new OfflineCtx(1, audioDataLength, sampleRate)

  const buffer = offlineContext.createBuffer(1, audioDataLength, sampleRate)
  buffer.getChannelData(0).set(audioData)

  const source = offlineContext.createBufferSource()
  source.buffer = buffer
  source.connect(offlineContext.destination)
  source.start(0)

  const renderedBuffer = await offlineContext.startRendering()
  const renderedData = renderedBuffer.getChannelData(0)

  const startSample = Math.floor(startSec * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSec + durationSec) * sampleRate),
    renderedData.length
  )

  return renderedData.slice(startSample, endSample)
}
// function cleanText(text: string){
//   if (!text) return ''
//   return text
//     .replace(/Subtitle by [a-zA-Z0-9\s\.]+/gi, '')
//     .replace(/Amara\.org/gi, '')
//     .replace(/\[Music\]|\[Applause\]|\[Laughter\]/gi, '')
//     .replace(/([A-Z][^.!?]*[.!?])\s*\\1\s*\\1+/g, '$1') // Collapse 3+ sentence repetitions
//     .replace(/\s+/g, ' ')
//     .trim()
// }

