/// <reference types="@webgpu/types" />
import {
  pipeline,
  env,
  type TaskType,
  type PretrainedModelOptions,
  type SupportedTasks,
} from '@huggingface/transformers'


// Configuration
// @ts-ignore this property is added by the transformers runtime
env.logLevel = 'error'
env.allowLocalModels = false
env.useBrowserCache = true
env.useWasmCache = false

// -------------------------
// WebGPU Device Manager
// -------------------------
interface WebGPUDeviceManagerType {
  adapter: GPUAdapter | null
  device: GPUDevice | null
  listenersAttached: boolean
  init(): Promise<GPUDevice>
}

const WebGPUDeviceManager: WebGPUDeviceManagerType = {
  adapter: null,
  device: null,
  listenersAttached: false,
  async init() {
    if (this.device) return this.device

    this.adapter = await navigator.gpu.requestAdapter()
    if (!this.adapter) {
      throw new Error('WebGPU adapter not available')
    }

    // adapter is non-null here
    this.device = await this.adapter!.requestDevice()
    if (!this.listenersAttached) {
      this.listenersAttached = true

      this.device.lost.then(async (info) => {
        console.warn('WebGPU device lost:', info.message)

        // Recreate adapter + device
        this.adapter = await navigator.gpu.requestAdapter()
        if (!this.adapter) {
          throw new Error('WebGPU adapter not available on restore')
        }
        this.device = await this.adapter!.requestDevice()

        console.warn('WebGPU device restored')

        // Reset pipelines so they rebuild with the new device
        // TS can't resolve static method before declaration, use any
        ;(PipelineManager as any).resetAllPipelines()
      })
    }

    return this.device
  },
}

// Singleton to manage active pipelines
class PipelineManager {
  static instances: Record<string, Awaited<ReturnType<typeof pipeline>>> = {}

  static async getPipeline<Task extends TaskType>(
    task: Task,
    model: string,
    progressCallback?: PretrainedModelOptions['progress_callback']
  ) {
    const key = `${task}-${model}`
    if (env.backends.onnx.webgpu) {
      env.backends.onnx.webgpu.device = await WebGPUDeviceManager.init()
    }
    if (!this.instances[key]) {
      // ensure WebGPU device is ready before creating pipeline
      await WebGPUDeviceManager.init()
      this.instances[key] = await pipeline<typeof task>(task, model, {
        // we always pass string provider; device object is not accepted by types
        device: 'webgpu',
        dtype: 'q4', // Quantized for performance
        progress_callback: progressCallback,
        use_external_data_format: true, // Use external data format for large models to avoid memory issues
      })
    }
    return this.instances[key] as SupportedTasks[Task]
  }

  static async disposePipeline(task: TaskType, model: string) {
    const key = `${task}-${model}`
    if (this.instances[key]) {
      await this.instances[key].dispose()
      delete this.instances[key]
    }
  }
}

type WorkerMessage =
  | {
      type: 'transcribe'
      payload: {
        audio: Float32Array | { array: Float32Array; sample_rate: number }
      }
    }
  | {
      type: 'generate'
      payload: {
        text: string
      }
    }
  | {
      type: 'classify'
      payload: {
        text: string
      }
    }

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data

  try {
    if (type === 'transcribe') {
      // Extract first 30 seconds of audio for language detection
      const audioChunk = extractAudioChunk({
        audio:
          payload.audio instanceof Float32Array
            ? payload.audio
            : payload.audio.array,
        startSeconds: 0,
        durationSeconds: 0,
      })
      // const audioChunk = extractAudioChunk({
      //   audio: payload.audio,
      //   startSeconds: 0,
      //   durationSeconds: 30,
      // })
      // Language detection Pipeline Promise (MMS-LID-256), run before ASR to improve accuracy, supporting 256 languages.
      // Note: This is a lightweight model designed for language identification, not transcription, so it should be fast even on CPU. It can help guide the ASR model to focus on the correct language, improving transcription quality.
      const languageDetectionPipePromise = PipelineManager.getPipeline(
        'audio-classification',
        'Xenova/mms-lid-256',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      // ASR Pipeline Promise (Whisper Large V3 Turbo), which is optimized for performance and can leverage the detected language to enhance transcription accuracy. This model is designed to be efficient and can run on CPU, but will perform best with WebGPU.
      const asrPipePromise = PipelineManager.getPipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-large-v3-turbo',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      // Run both pipelines in parallel to save time, as loading models can be the bottleneck.
      const [languageDetectionPipe, asrPipe] = await Promise.all([
        languageDetectionPipePromise,
        asrPipePromise,
      ])
      const languageDetectionResult = await languageDetectionPipe(
        audioChunk as any,
        { top_k: 1 }
      ) // Cast to any to bypass type issues with audio input
      // The model returns an array of detected languages with confidence scores. We take the top result.
      let rawLabel = languageDetectionResult[0].label || undefined

      let detectedLanguage: string | undefined = undefined
      // The label is typically in the format "eng" for English, "heb" for Hebrew, etc. We extract the first two characters to get the ISO 639-1 language code.
      if (rawLabel && rawLabel.length >= 2) {
        // Extract the first two characters as the language code (e.g., "en" for English, "fr" for French)
        detectedLanguage = rawLabel.slice(0, 2).toLowerCase()
      }
      // Inform the main thread that we're starting the inferencing step, which can take some time, especially on CPU.
      self.postMessage({ type: 'status', payload: 'inferencing' })

      // Run the ASR pipeline with the detected language to improve transcription accuracy. The model will use the provided language hint to focus on that language, which can significantly enhance transcription quality, especially in noisy environments or with accents.
      const audioInput =
        payload.audio instanceof Float32Array
          ? payload.audio
          : payload.audio.array

      // determine sample rate (default 16k if raw buffer)
      const sampleRate =
        payload.audio instanceof Float32Array
          ? 16000
          : payload.audio.sample_rate

      // split the input into overlapping chunks so we can feed each to ASR
      const chunks = makeChunks(audioInput, sampleRate, 30, 5)

      // run the ASR pipeline sequentially over each chunk and merge the results
      const allResults: any[] = []
      for (const chunk of chunks) {
        const res = await asrPipe(chunk, {
          language: detectedLanguage,
          force_full_sequences: true,
          remove_invalid_values: true,
          chunk_length_s: 18, // slightly shorter than chunk size to account for stride and avoid cutting off words
          stride_length_s: 3, // overlap to help with continuity and avoid cutting off words
          task: 'transcribe',
          return_timestamps: true,
          return_whole_text: false,
        })
        allResults.push(res)
      }

      // stitch together or just return array; downstream code can decide how to concatenate
      const transcriptionResult = allResults

      // Send the transcription result back to the main thread. The result typically includes the transcribed text and may also include timestamps for each segment.
      self.postMessage({
        type: 'result',
        task: 'transcription',
        payload: transcriptionResult,
      })
      // Remove the instances from the manager to allow for garbage collection. This is important for memory management, especially in a worker environment where models can consume significant resources.
      await Promise.all([
        PipelineManager.disposePipeline(
          'audio-classification',
          'Xenova/mms-lid-256'
        ),
        PipelineManager.disposePipeline(
          'automatic-speech-recognition',
          'onnx-community/whisper-large-v3-turbo'
        ),
      ])
    } else if (type === 'generate') {
      // Text Generation Pipeline (LaMini)
      const pipe = await PipelineManager.getPipeline(
        'text-generation',
        'onnx-community/Qwen3.5-0.8B-ONNX',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )
      // const pipe = await PipelineManager.getPipeline(
      //   'text2text-generation',
      //   'Xenova/LaMini-Flan-T5-77M',
      //   (data) => self.postMessage({ type: 'progress', payload: data })
      // )

      self.postMessage({ type: 'status', payload: 'inferencing' })

      const output = await pipe(payload.text, {
        max_new_tokens: 256,
        temperature: 0.7,
        repetition_penalty: 1.2,
        remove_invalid_values: true,
        return_full_text: false,
      })

      self.postMessage({ type: 'result', task: 'generation', payload: output })
    } else if (type === 'classify') {
      // Sentiment Analysis (DistilBERT)
      const pipe = await PipelineManager.getPipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      self.postMessage({ type: 'status', payload: 'inferencing' })

      const output = await pipe(payload.text)
      self.postMessage({
        type: 'result',
        task: 'classification',
        payload: output,
      })
    }
  } catch (error) {
    console.error(error)
    if (error instanceof Error) {
      self.postMessage({ type: 'error', payload: error.message })
    }
  } finally {
    self.postMessage({ type: 'status', payload: 'ready' })
  }
})

/**
 *  Extracts a chunk of audio data based on the specified start time and duration. This function handles both raw Float32Array audio data and objects containing an audio array with a sample rate. It calculates the appropriate sample indices to slice the audio data, ensuring that the chunk is correctly extracted without floating point errors.
 * @param audio - The input audio data, which can be either a raw Float32Array or an object containing an audio array and its sample rate.
 * @param startSeconds - The starting point in seconds from which to extract the audio chunk.
 * @param durationSeconds - The duration in seconds of the audio chunk to be extracted.
 * @returns A Float32Array containing the extracted audio chunk, or an object with the chunk and its sample rate if the input was in that format.
 *
 * @example
 * // Extract a 30-second chunk starting from the 60-second mark
 * const chunk = extractAudioChunk({
 * audio: myAudioData,
 * startSeconds: 60,
 * durationSeconds: 30,
 * })
 */
function extractAudioChunk({
  audio,
  startSeconds,
  durationSeconds,
}: {
  audio: Float32Array | { array: Float32Array; sample_rate: number }
  startSeconds: number
  durationSeconds: number
}): Float32Array | { array: Float32Array; sample_rate: number } {
  const isRaw = audio instanceof Float32Array
  const audioArray = isRaw ? audio : audio.array
  const sampleRate = isRaw ? 16000 : audio.sample_rate // Default to 16kHz if raw

  // convert to integer indices to avoid floating point slice errors
  const startSample = Math.floor(startSeconds * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSeconds + durationSeconds) * sampleRate),
    audioArray.length
  )
  const chunk = audioArray.slice(startSample, endSample)

  return isRaw ? chunk : { array: chunk, sample_rate: sampleRate }
}

async function extractAudioChunkWithWebAudio({
  audioData,
  startSec,
  durationSec,
}: {
  audioData: ArrayBuffer // The audio data as an ArrayBuffer, typically from a Blob or File.
  startSec: number
  durationSec: number
}): Promise<Float32Array> {
  // Decode audio data using Web Audio API, which can handle various formats and sample rates. This is more robust than assuming a specific format or sample rate, but it does require the audio data to be in a compatible format (e.g., WAV, MP3).
  const ctx = new (self.AudioContext || (self as any).webkitAudioContext)()
  // The decodeAudioData method decodes the audio data and returns an AudioBuffer, which contains the decoded audio samples and metadata such as sample rate and number of channels. This allows us to work with the audio data in a more flexible way, regardless of its original format.
  const buf = await ctx.decodeAudioData(audioData)

  const sampleRate = buf.sampleRate
  const startSample = Math.floor(startSec * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSec + durationSec) * sampleRate),
    buf.length
  )

  // assuming mono or just take channel 0
  const chunk = new Float32Array(endSample - startSample)
  buf.copyFromChannel(chunk, 0, startSample)

  // you can keep ctx open if you reuse it; otherwise close() eventually
  await ctx.close()
  return chunk
}

// utility to break a mono Float32Array into fixed-size (and optionally overlapping) pieces
function makeChunks(
  audio: Float32Array,
  sampleRate: number,
  chunkSec: number,
  strideSec = 0
): Float32Array[] {
  const chunkSize = Math.floor(chunkSec * sampleRate)
  const strideSize = Math.floor(strideSec * sampleRate)
  const chunks: Float32Array[] = []

  for (let start = 0; start < audio.length; start += chunkSize - strideSize) {
    const end = Math.min(start + chunkSize, audio.length)
    chunks.push(audio.subarray(start, end))
    if (end === audio.length) break
  }

  return chunks
}
