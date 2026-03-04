import { pipeline, env } from '@huggingface/transformers'

// Configuration
env.allowLocalModels = false
env.useBrowserCache = true

// Singleton to manage active pipelines
class PipelineManager {
  static instances = {}

  static async getPipeline(task, model, progressCallback) {
    const key = `${task}-${model}`
    if (!this.instances[key]) {
      this.instances[key] = await pipeline(task, model, {
        device: 'webgpu',
        dtype: 'q4',
        progress_callback: progressCallback,
      })
    }
    return this.instances[key]
  }

  static async disposePipeline(task, model) {
    const key = `${task}-${model}`
    if (this.instances[key]) {
      await this.instances[key].dispose()
      delete this.instances[key]
    }
  }
}

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data

  try {
    if (type === 'transcribe') {
      const audioChunk = extractAudioChunk({
        audio:
          payload.audio instanceof Float32Array
            ? payload.audio
            : payload.audio.array,
        startSeconds: 0,
        durationSeconds: 0,
      })
      const languageDetectionPipePromise = PipelineManager.getPipeline(
        'audio-classification',
        'Xenova/mms-lid-256',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      const asrPipePromise = PipelineManager.getPipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-large-v3-turbo',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      const [languageDetectionPipe, asrPipe] = await Promise.all([
        languageDetectionPipePromise,
        asrPipePromise,
      ])

      const languageDetectionResult = await languageDetectionPipe(
        audioChunk
      )
      let rawLabel = languageDetectionResult[0].label || undefined

      let detectedLanguage = undefined
      if (rawLabel && rawLabel.length >= 2) {
        detectedLanguage = rawLabel.slice(0, 2).toLowerCase()
      }
      console.log('Detected Language:', detectedLanguage)

      self.postMessage({ type: 'status', payload: 'inferencing' })

      const audioInput =
        payload.audio instanceof Float32Array
          ? payload.audio
          : payload.audio.array

      const sampleRate =
        payload.audio instanceof Float32Array
          ? 16000
          : payload.audio.sample_rate

      const chunks = makeChunks(audioInput, sampleRate, 30, 5)
      const allResults = []
      for (const chunk of chunks) {
        const res = await asrPipe(chunk, { language: detectedLanguage })
        allResults.push(res)
      }
      const transcriptionResult = allResults

      self.postMessage({
        type: 'result',
        task: 'transcription',
        payload: transcriptionResult,
      })
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
      const pipe = await PipelineManager.getPipeline(
        'text2text-generation',
        'Xenova/LaMini-Flan-T5-77M',
        (data) => self.postMessage({ type: 'progress', payload: data })
      )

      self.postMessage({ type: 'status', payload: 'inferencing' })

      const output = await pipe(payload.text, {
        max_new_tokens: 256,
        temperature: 0.7,
        repetition_penalty: 1.2,
      })

      self.postMessage({ type: 'result', task: 'generation', payload: output })
    } else if (type === 'classify') {
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

function extractAudioChunk({
  audio,
  startSeconds,
  durationSeconds,
}) {
  const isRaw = audio instanceof Float32Array
  const audioArray = isRaw ? audio : audio.array
  const sampleRate = isRaw ? 16000 : audio.sample_rate
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
}) {
  const ctx = new (self.AudioContext || self.webkitAudioContext)()
  const buf = await ctx.decodeAudioData(audioData)
  const sampleRate = buf.sampleRate
  const startSample = Math.floor(startSec * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSec + durationSec) * sampleRate),
    buf.length
  )
  const chunk = new Float32Array(endSample - startSample)
  buf.copyFromChannel(chunk, 0, startSample)
  await ctx.close()
  return chunk
}

function makeChunks(audio, sampleRate, chunkSec, strideSec = 0) {
  const chunkSize = Math.floor(chunkSec * sampleRate)
  const strideSize = Math.floor(strideSec * sampleRate)
  const chunks = []
  for (let start = 0; start < audio.length; start += chunkSize - strideSize) {
    const end = Math.min(start + chunkSize, audio.length)
    chunks.push(audio.subarray ? audio.subarray(start, end) : audio.slice(start, end))
    if (end === audio.length) break
  }
  return chunks
}

