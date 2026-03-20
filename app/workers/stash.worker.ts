/// <reference types="@webgpu/types" />
import {
  type ProgressData,
  detectLanguage,
  transcribeAudio,
  summarizeText,
  extractKeywordsFromText,
  generateTagsFromText,
} from './stash.ai'

// -------------------------
// Type Definitions (worker-side only)
// -------------------------

type WorkerMessageType =
  | 'transcribe'
  | 'summarize'
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

type WorkerMessage =
  | {
      type: 'transcribe'
      payload: {
        audio: Float32Array
        sampleRate: number
        duration: number
        language: string
      }
    }
  | {
      type: 'detect-language'
      payload: { audio: Float32Array; sampleRate: number }
    }
  | { type: 'summarize'; payload: { text: string; language: string } }
  | { type: 'extract-keywords'; payload: { text: string } }
  | { type: 'generate-tags'; payload: { text: string; language: string } }

interface WorkerResponse {
  type: WorkerMessageType
  task?: string
  payload?: unknown
}

// ~~~~~~~~~~~~~~~~ Utils ~~~~~~~~~~~~~~~~ //

const report = ({ type, payload, task }: WorkerResponse) =>
  self.postMessage({ type, payload, task } as WorkerResponse)

const progress = (data: ProgressData) =>
  report({ type: 'progress', payload: data })

const error = (payload: string) => report({ type: 'error', payload })
const debug = (payload: string) => report({ type: 'debug', payload })
const status = (payload: string) => report({ type: 'status', payload })
const result = (payload: any, task: string) =>
  report({ type: 'result', payload, task })
const audioDuration = (seconds: number) =>
  report({ type: 'audio-duration', payload: seconds })
const languageDetected = (language: string, confidence: number) =>
  report({ type: 'language-detected', payload: { language, confidence } })
const partialResult = (task: string, payload: unknown) =>
  report({ type: 'partial-result', task, payload })

// -------------------------
// Worker message handler
// -------------------------
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data
  try {
    if (type === 'detect-language') {
      status('detecting-language')
      const { language, confidence } = await detectLanguage(payload.audio)
      languageDetected(language, confidence)
    } else if (type === 'transcribe') {
      const {
        audio: audioInput,
        sampleRate,
        duration,
        language: detectedLanguage,
      } = payload

      audioDuration(Math.round(duration))
      status('transcribing')
      console.log('duration: ', duration)

      try {
        const transcriptText = await transcribeAudio(
          { audio: audioInput, sampleRate, duration, language: detectedLanguage },
          progress,
          partialResult
        )
        result(transcriptText, 'transcription')
      } catch (e) {
        debug(
          `✗ Failed to transcribe. Error: ${e instanceof Error ? e.message : String(e)}.`
        )
      }
    } else if (type === 'summarize') {
      status('summarizing')
      const summaryText = await summarizeText(
        { text: payload.text, language: payload.language },
        progress
      )
      result(summaryText, 'summarization')
    } else if (type === 'extract-keywords') {
      try {
        status('extract-keywords')
        const keywords = await extractKeywordsFromText(payload.text, progress)
        result({ keywords }, 'extract-keywords')
      } catch (err: any) {
        error(err.message)
      }
    } else if (type === 'generate-tags') {
      status('generating-tags')
      const tags = await generateTagsFromText(
        { text: payload.text, language: payload.language },
        progress
      )
      result({ tags }, 'generate-tags')
    } else {
      debug(`Unknown task type: ${type}`)
    }
  } catch (e) {
    console.error('Worker error:', e)
    debug(`Error: ${e instanceof Error ? e.message : String(e)}`)
    if (e instanceof Error) {
      error(e.message)
    }
  }
})
