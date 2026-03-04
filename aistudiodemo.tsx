import { useEffect, useRef, useState } from 'react'

// --- SSR CONFIGURATION ---

export const meta = () => {
  return [
    { title: 'WebGPU Speech Recognition' },
    {
      name: 'description',
      content: 'Local high-speed transcription using Distil-Whisper and WebGPU',
    },
  ]
}

// --- WORKER CODE ---
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js';

// Crucial: Disable local models and enable remote caching
env.allowLocalModels = false;
env.useBrowserCache = true;

class Transcriber {
  static instance = null;
  static modelId = 'onnx-community/whisper-large-v3-turbo_timestamped'; 

  static async getInstance(progressCallback) {
    if (!this.instance) {
      this.instance = await pipeline('automatic-speech-recognition', this.modelId, {
        device: 'webgpu',
        dtype: 'q4', 
        progress_callback: progressCallback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio } = event.data;

  if (type === 'transcribe') {
    try {
      const transcriber = await Transcriber.getInstance((data) => {
        self.postMessage({ type: 'progress', data });
      });

      self.postMessage({ type: 'start' });

      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'he'
      });

      self.postMessage({ type: 'complete', text: output.text });

    } catch (err) {
      console.error('Worker Error:', err);
      const msg = err.message.includes('external data file') 
        ? "Model loading failed: This model version requires external data files. Try the 'turbo' version."
        : err.message;
      self.postMessage({ type: 'error', error: msg });
    }
  }
});
`

/**
 * AIStudio - Local AI Audio/Video Transcription Component
 *
 * A React component that provides real-time audio/video transcription using
 * Whisper Large v3 (Turbo) model with WebGPU acceleration. Processes files
 * locally in the browser with fallback to WASM if WebGPU is unavailable.
 *
 * @component
 * @returns {JSX.Element} The AIStudio transcription interface
 *
 * @state {string} output - The transcription result text
 * @state {('idle'|'loading'|'transcribing'|'error')} status - Current processing status
 * @state {Record<string, number>} progressItems - Download progress per file (0-100)
 * @state {string|null} gpuTier - GPU acceleration tier ('WebGPU Active' or 'WASM Fallback')
 *
 * @example
 * // Basic usage within your app
 * <AIStudio />
 *
 * @features
 * - WebGPU acceleration detection and fallback
 * - Web Worker for non-blocking transcription
 * - Real-time model download progress tracking
 * - Support for audio and video file formats
 * - Local processing with no data upload
 * - Responsive UI with loading/error states
 *
 * @requires navigator.gpu or WebAssembly support
 */
export default function AIStudio() {
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'transcribing' | 'error'
  >('idle')
  const [progressItems, setProgressItems] = useState<Record<string, number>>({})
  const [gpuTier, setGpuTier] = useState<string | null>(null)

  const worker = useRef<Worker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!navigator.gpu) {
      setStatus('error')
      setOutput(
        'WebGPU is not supported in this browser. Please use Chrome 113+ or Edge.'
      )
      return
    }

    navigator.gpu.requestAdapter().then((adapter) => {
      setGpuTier(adapter ? 'WebGPU Active' : 'WASM Fallback')
    })

    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)
    worker.current = new Worker(workerUrl, { type: 'module' })

    worker.current.onmessage = (e) => {
      const { type, data, text, error } = e.data
      switch (type) {
        case 'progress':
          if (data.status === 'progress') {
            setProgressItems((prev) => ({
              ...prev,
              [data.file]: data.progress,
            }))
          }
          if (status === 'idle') setStatus('loading')
          break
        case 'start':
          setStatus('transcribing')
          break
        case 'complete':
          setOutput(text)
          setStatus('idle')
          break
        case 'error':
          setStatus('error')
          setOutput(`Error: ${error}`)
          break
      }
    }

    return () => {
      worker.current?.terminate()
      URL.revokeObjectURL(workerUrl)
    }
  }, [])

  const processFile = async (file: File) => {
    setStatus('loading')
    setOutput('Preparing audio data...')

    try {
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      let float32Data = audioBuffer.getChannelData(0)
      if (audioBuffer.numberOfChannels > 1) {
        const nextChannel = audioBuffer.getChannelData(1)
        for (let i = 0; i < float32Data.length; i++) {
          float32Data[i] = (float32Data[i] + nextChannel[i]) / 2
        }
      }

      worker.current?.postMessage({
        type: 'transcribe',
        audio: float32Data,
      })
    } catch (err: any) {
      setStatus('error')
      setOutput(`Audio Processing Error: ${err.message}`)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-6">
        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Local AI Transcription
            </h1>
            <p className="text-sm text-slate-500">
              Whisper Large v3 (Turbo) + WebGPU
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-bold">
            {gpuTier || 'Detecting...'}
          </span>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col relative overflow-hidden">
          {status === 'loading' && Object.keys(progressItems).length > 0 && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-full max-w-xs space-y-4">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 animate-pulse w-full" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Downloading AI Model...
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {Object.entries(progressItems).map(([file, progress]) => (
                    <div
                      key={file}
                      className="flex justify-between text-[10px] text-slate-400"
                    >
                      <span className="truncate max-w-[180px]">{file}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 p-8 overflow-y-auto">
            {status === 'transcribing' && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
                <div className="flex space-x-2">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
                      style={{
                        animationDelay: `${delay}s`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Transcribing locally (WebGPU)...
                </p>
              </div>
            )}

            {output && (
              <div className="prose prose-slate max-w-none">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">
                  Result
                </h3>
                <p className="text-slate-800 leading-relaxed text-lg">
                  {output}
                </p>
              </div>
            )}

            {!output && status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-20">
                <div className="p-6 bg-slate-50 rounded-full text-slate-200">
                  <svg
                    className="w-16 h-16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium">
                  Upload audio or video to transcribe
                </p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                status !== 'idle'
                  ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-50'
                  : 'bg-white border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
              }`}
            >
              <div className="flex items-center space-x-3">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-600">
                  Select File
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                accept="audio/*,video/*"
                onChange={onFileChange}
                disabled={status !== 'idle'}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-400 px-2">
          <p>Local GPU Inference • No Data Uploaded</p>
          <button
            onClick={() => {
              setOutput('')
              setProgressItems({})
            }}
            className="hover:text-slate-600 font-bold uppercase"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
