import { fromCallback, fromPromise } from 'xstate'
import type { PipelineEvents } from '@/types/machine.types'
import {
  detectLanguage,
  transcribeAudio,
  summarizeText,
  correctTranscript,
  extractKeywordsFromText,
  generateTagsFromText,
} from '@/workers/stash.ai'

type DetectLanguageInput = {
  audio: Float32Array
  sampleRate: number
  duration: number
}
type TranscribeInput = {
  audio: Float32Array
  sampleRate: number
  duration: number
  language: string
  contentHint?: 'music' | 'speech' | 'auto'
}
type SummarizeInput = { text: string; language: string }
type CorrectTranscriptInput = {
  text: string
  language: string
}
type KeywordsInput = { text: string }
type GenerateTagsInput = { text: string; language: string }

// ── detectLanguageActor ───────────────────────────────────────────────────────
export const detectLanguageActor = fromCallback<
  PipelineEvents,
  DetectLanguageInput
>(({ sendBack, input }) => {
  let cancelled = false
  detectLanguage(input.audio)
    .then(({ language, confidence }) => {
      if (!cancelled)
        sendBack({ type: 'WORKER.LANGUAGE_DETECTED', language, confidence })
    })
    .catch((e: Error) => {
      if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
    })
  return () => {
    cancelled = true
  }
})

// ── transcribeActor ───────────────────────────────────────────────────────────
export const transcribeActor = fromCallback<PipelineEvents, TranscribeInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    transcribeAudio(
      input,
      (data) => {
        if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data })
      },
      (task, payload) => {
        if (!cancelled)
          sendBack({ type: 'WORKER.PARTIAL_RESULT', task, payload })
      }
    )
      .then((text) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.TRANSCRIPTION', text })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => {
      cancelled = true
    }
  }
)

// ── summarizeActor ────────────────────────────────────────────────────────────
export const summarizeActor = fromCallback<PipelineEvents, SummarizeInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    summarizeText(input, (data) => {
      if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data })
    })
      .then((text) => {
        if (!cancelled) sendBack({ type: 'WORKER.RESULT.SUMMARIZATION', text })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => {
      cancelled = true
    }
  }
)

// ── correctTranscriptActor ────────────────────────────────────────────────────
export const correctTranscriptActor = fromCallback<
  PipelineEvents,
  CorrectTranscriptInput
>(({ sendBack, input }) => {
  let cancelled = false
  correctTranscript(
    { text: input.text, language: input.language },
    (data) => {
      if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data })
    }
  )
    .then((correctedTranscript) => {
      // Corrected transcript
      if (!cancelled)
        sendBack({ type: 'WORKER.RESULT.CORRECTION', correctedTranscript })
    })
    .catch((err) => {
      console.error('Error correcting transcript:', err)
      // Fallback: send the original uncorrected transcript
      if (!cancelled)
        sendBack({
          type: 'WORKER.RESULT.CORRECTION',
          correctedTranscript: input.text,
        })
    })
  return () => {
    cancelled = true
  }
})

// ── extractKeywordsActor ──────────────────────────────────────────────────────
export const extractKeywordsActor = fromCallback<PipelineEvents, KeywordsInput>(
  ({ sendBack, input }) => {
    let cancelled = false
    extractKeywordsFromText(input.text, (data) => {
      if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data })
    })
      .then((keywords) => {
        if (!cancelled)
          sendBack({ type: 'WORKER.RESULT.EXTRACT_KEYWORDS', keywords })
      })
      .catch((e: Error) => {
        if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
      })
    return () => {
      cancelled = true
    }
  }
)

// ── generateTagsActor ─────────────────────────────────────────────────────────
export const generateTagsActor = fromCallback<
  PipelineEvents,
  GenerateTagsInput
>(({ sendBack, input }) => {
  let cancelled = false
  generateTagsFromText(input, (data) => {
    if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data })
  })
    .then((tags) => {
      if (!cancelled) sendBack({ type: 'WORKER.RESULT.GENERATE_TAGS', tags })
    })
    .catch((e: Error) => {
      if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
    })
  return () => {
    cancelled = true
  }
})

// ── detectHardwareActor ───────────────────────────────────────────────────────
// Uses OffscreenCanvas (worker-safe) for WebGL GPU name detection
function getWebGLGpuName(): string | null {
  try {
    const canvas = new OffscreenCanvas(1, 1)
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return null
    // Try unmasked renderer via extension (Chrome workers: works; Edge: may be restricted)
    let renderer: string | null = null
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext)
        renderer =
          (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || null
    } catch {
      /* extension restricted in this context */
    }
    // Fall back to gl.RENDERER — ANGLE implementations expose GPU name here too
    if (!renderer) renderer = (gl.getParameter(gl.RENDERER) as string) || null
    if (!renderer) return null
    if (renderer.startsWith('ANGLE (')) {
      const inner = renderer.slice(7, -1)
      const parts = inner.split(', ')
      if (parts.length >= 2) {
        return parts[1]
          .replace(/\s+Direct3D\S*.*$/, '')
          .replace(/^ANGLE Metal Renderer:\s*/, '')
          .trim()
      }
    }
    return (
      renderer
        .replace(/\/PCIe.*$/, '')
        .replace(/\/SSE.*$/, '')
        .trim() || null
    )
  } catch {
    return null
  }
}

export const detectHardwareActor = fromPromise<{
  executionProvider: 'webgpu' | 'wasm'
  gpuInfo: string | null
}>(async () => {
  try {
    const nav = navigator
    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter({
        powerPreference: 'high-performance',
        forceFallbackAdapter: true,
      })
      if (adapter) {
        let gpuInfo: string | null = null
        // Try adapter.info (sync getter, Chrome/Edge 113+)
        try {
          const info = adapter.info
          gpuInfo = info?.description ?? info?.vendor ?? null
        } catch {}
        // Try adapter.requestAdapterInfo() (async, works on Edge where .info may be empty)
        if (!gpuInfo) {
          try {
            const info = (await (
              adapter as GPUAdapter & {
                requestAdapterInfo?: () => Promise<GPUAdapterInfo>
              }
            ).requestAdapterInfo?.()) as GPUAdapterInfo
            gpuInfo = info?.description || info?.vendor || null
          } catch {
            /* requestAdapterInfo may fail in some contexts */
            
          }
        }
        return {
          executionProvider: 'webgpu',
          gpuInfo: gpuInfo ??  getWebGLGpuName(),
        }
      }
    }
  } catch {
    /* WebGPU not available */
  }
  return { executionProvider: 'wasm', gpuInfo: getWebGLGpuName() }
})
