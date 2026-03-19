import { fromCallback, fromPromise } from 'xstate'

// -------------------------
// Worker message types (mirrors stash.worker.ts)
// -------------------------
type WorkerMessage =
  | { type: 'transcribe'; payload: { audio: Float32Array; sampleRate: number; duration: number; language: string } }
  | { type: 'detect-language'; payload: { audio: Float32Array; sampleRate: number } }
  | { type: 'summarize'; payload: { text: string; language: string } }
  | { type: 'extract-keywords'; payload: { text: string } }
  | { type: 'generate-tags'; payload: { text: string; language: string } }

// Internal event the machine sends to the bridge actor
type BridgeReceiveEvent = { type: 'SEND_TO_WORKER'; message: WorkerMessage }

// ====================================================== //
// =================== Worker Bridge ==================== //
// ====================================================== //

/**
 * A persistent fromCallback actor that wraps the stash Web Worker.
 * - Bridges worker.onmessage → typed XState events via sendBack
 * - Receives SEND_TO_WORKER events from the machine and calls worker.postMessage
 * - Terminates the worker on cleanup (component unmount)
 */
export const workerBridgeActor = fromCallback<BridgeReceiveEvent, void>(
  ({ sendBack, receive }) => {
    const worker = new Worker(
      new URL('../../workers/stash.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload, task } = e.data

      switch (type) {
        case 'progress':
          sendBack({ type: 'WORKER.PROGRESS', data: payload })
          break
        case 'status':
          sendBack({ type: 'WORKER.STATUS', status: payload })
          break
        case 'language-detected':
          sendBack({
            type: 'WORKER.LANGUAGE_DETECTED',
            language: payload.language,
            confidence: payload.confidence,
          })
          break
        case 'audio-duration':
          sendBack({ type: 'WORKER.AUDIO_DURATION', seconds: payload })
          break
        case 'partial-result':
          sendBack({ type: 'WORKER.PARTIAL_RESULT', task, payload })
          break
        case 'result':
          if (task === 'transcription') {
            sendBack({ type: 'WORKER.RESULT.TRANSCRIPTION', text: payload ?? '' })
          } else if (task === 'summarization') {
            // Normalize the various payload shapes from the LLM worker
            let text = ''
            if (Array.isArray(payload)) text = payload[0]?.generated_text ?? ''
            else if (typeof payload === 'string') text = payload
            else if (payload?.generated_text) text = payload.generated_text
            else if (payload?.summary) text = payload.summary
            else if (payload?.summary_text) text = payload.summary_text
            sendBack({ type: 'WORKER.RESULT.SUMMARIZATION', text })
          } else if (task === 'extract-keywords') {
            sendBack({
              type: 'WORKER.RESULT.EXTRACT_KEYWORDS',
              keywords: payload?.keywords ?? [],
            })
          } else if (task === 'generate-tags') {
            sendBack({ type: 'WORKER.RESULT.GENERATE_TAGS', tags: payload?.tags ?? [] })
          }
          break
        case 'error':
          sendBack({ type: 'WORKER.ERROR', message: payload ?? 'Unknown worker error' })
          break
        // 'debug' messages are intentionally ignored here
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      sendBack({ type: 'WORKER.ERROR', message: e.message ?? 'Worker error' })
    }

    // Receive commands from the machine and forward to the worker
    receive((event) => {
      if (event.type === 'SEND_TO_WORKER') {
        const msg = event.message
        // Transfer audio buffer to avoid copying large Float32Arrays
        const transferables: Transferable[] = []
        if (
          (msg.type === 'detect-language' || msg.type === 'transcribe') &&
          msg.payload.audio.buffer instanceof ArrayBuffer
        ) {
          transferables.push(msg.payload.audio.buffer)
        }
        worker.postMessage(msg, transferables)
      }
    })

    return () => worker.terminate()
  }
)

// ====================================================== //
// ================= Hardware Detection ================= //
// ====================================================== //

/**
 * One-shot fromPromise actor that detects WebGPU availability.
 * Resolves to { executionProvider, gpuInfo } for initial context setup.
 */
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
        let device = await adapter.requestDevice()
        console.debug('WebGPU supported. Adapter info:', adapter, 'Device info:', device, 'Adapter info (from device):', device.adapterInfo)
        try {
          const info = (adapter as any).info as { description?: string; vendor?: string } | undefined
          gpuInfo = info?.vendor ?? null
        } catch {
          gpuInfo = "Unknown GPU"
          // requestAdapterInfo not available in all browsers
        }
        return { executionProvider: 'webgpu', gpuInfo }
      }
    }
  } catch {
    // WebGPU not available
  }
  return { executionProvider: 'wasm', gpuInfo: null }
})
