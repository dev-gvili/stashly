import { fromCallback, fromPromise } from 'xstate'
import type { PipelineEvents } from '@/types/machine.types'
import {
  detectLanguage,
  transcribeAudio,
  summarizeText,
  extractKeywordsFromText,
  generateTagsFromText,
} from '@/workers/stash.ai'

type DetectLanguageInput = { audio: Float32Array; sampleRate: number; duration: number }
type TranscribeInput = { audio: Float32Array; sampleRate: number; duration: number; language: string }
type SummarizeInput = { text: string; language: string }
type KeywordsInput = { text: string }
type GenerateTagsInput = { text: string; language: string }

// ── detectLanguageActor ───────────────────────────────────────────────────────
export const detectLanguageActor = fromCallback<PipelineEvents, DetectLanguageInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    detectLanguage(input.audio)
      .then(({ language, confidence }) => {
        if (!cancelled)
          sendBack({ type: 'WORKER.LANGUAGE_DETECTED', language, confidence })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => { cancelled = true }
  }
)

// ── transcribeActor ───────────────────────────────────────────────────────────
export const transcribeActor = fromCallback<PipelineEvents, TranscribeInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    transcribeAudio(
      input,
      (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) },
      (task, payload) => { if (!cancelled) sendBack({ type: 'WORKER.PARTIAL_RESULT', task, payload }) }
    )
      .then((text) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.TRANSCRIPTION', text })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => { cancelled = true }
  }
)

// ── summarizeActor ────────────────────────────────────────────────────────────
export const summarizeActor = fromCallback<PipelineEvents, SummarizeInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    summarizeText(
      input,
      (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
    )
      .then((text) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.SUMMARIZATION', text })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => { cancelled = true }
  }
)

// ── extractKeywordsActor ──────────────────────────────────────────────────────
export const extractKeywordsActor = fromCallback<PipelineEvents, KeywordsInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    extractKeywordsFromText(
      input.text,
      (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
    )
      .then((keywords) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.EXTRACT_KEYWORDS', keywords })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => { cancelled = true }
  }
)

// ── generateTagsActor ─────────────────────────────────────────────────────────
export const generateTagsActor = fromCallback<PipelineEvents, GenerateTagsInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    generateTagsFromText(
      input,
      (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
    )
      .then((tags) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.GENERATE_TAGS', tags })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => { cancelled = true }
  }
)

// ── detectHardwareActor ───────────────────────────────────────────────────────
// Uses navigator.gpu + adapter.info ONLY — no document.* (unavailable in workers)
export const detectHardwareActor = fromPromise<{
  executionProvider: 'webgpu' | 'wasm'
  gpuInfo: string | null
}>(async () => {
  try {
    const nav = navigator as Navigator & { gpu?: GPU }
    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter()
      if (adapter) {
        let gpuInfo: string | null = null
        try {
          const info = (adapter as any).info as { description?: string; vendor?: string } | undefined
          gpuInfo = info?.description ?? info?.vendor ?? null
        } catch { /* requestAdapterInfo not universally available */ }
        return { executionProvider: 'webgpu', gpuInfo }
      }
    }
  } catch { /* WebGPU not available */ }
  return { executionProvider: 'wasm', gpuInfo: null }
})
