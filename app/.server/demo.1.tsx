import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MessageSquare,
  Loader2,
  Play,
  Sparkles,
  Volume2,
  FileAudio,
  CheckCircle2,
  Cpu,
  BarChart3,
  Terminal,
  Languages,
} from 'lucide-react'

// --- CONFIGURATION ---
const apiKey = ''

// --- WORKER CODE (Simplified and Debugged) ---
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js';

// Configuration
env.allowLocalModels = false
env.useBrowserCache = true

// Singleton to manage active pipelines
class PipelineManager {
  static instances = {}

  static async getPipeline(task, model, progressCallback) {
    const key = \`\${task}-\${model}\`
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
    const key = \`\${task}-\${model}\`
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
  const ctx = new (self.AudioContext || (self as any).webkitAudioContext)()
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
`

type ViewMode = 'audio' | 'text'
type ModelStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'detecting-language'
  | 'transcribing'
  | 'generating'
  | 'classifying'
  | 'error'

interface ChunkProgress {
  currentChunk: number
  totalChunks: number
  progress: number
  timeProcessed: number
  chunkStart?: number
  chunkEnd?: number
}

export default function App() {
  const [view, setView] = useState<ViewMode>('audio')
  const [status, setStatus] = useState<ModelStatus>('idle')
  const [progress, setProgress] = useState<Record<string, number> | null>(null)
  const [detectedLanguage, setDetectedLanguage] = useState<{
    language: string
    confidence: number
  } | null>(null)
  const [transcriptProgress, setTranscriptProgress] =
    useState<ChunkProgress | null>(null)
  const [loadingPhases, setLoadingPhases] = useState<string[]>([])
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const [transcript, setTranscript] = useState('')
  const [inputText, setInputText] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [sentiment, setSentiment] = useState<any>(null)
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const worker = useRef<Worker | null>(null)

  useEffect(() => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    worker.current = new Worker(url, { type: 'module' })

    worker.current.onmessage = (e) => {
      const { type, payload, task } = e.data
      switch (type) {
        case 'progress':
          if (payload.status === 'progress') {
            setProgress((prev) => ({
              ...(prev || {}),
              [payload.file]: payload.progress,
            }))

            const fileName = payload.file.split('/').pop() || ''
            if (
              fileName.includes('mms-lid') &&
              !loadingPhases.includes('Language Model')
            ) {
              setLoadingPhases((prev) => [...prev, 'Language Model'])
            } else if (
              fileName.includes('whisper') &&
              !loadingPhases.includes('Speech Recognition')
            ) {
              setLoadingPhases((prev) => [...prev, 'Speech Recognition'])
            } else if (
              fileName.includes('LaMini') &&
              !loadingPhases.includes('Text Generation')
            ) {
              setLoadingPhases((prev) => [...prev, 'Text Generation'])
            } else if (
              fileName.includes('distilbert') &&
              !loadingPhases.includes('Sentiment Analysis')
            ) {
              setLoadingPhases((prev) => [...prev, 'Sentiment Analysis'])
            }
          }
          break

        case 'debug':
          setDebugLogs((prev) => [...prev, payload].slice(-10))
          break

        case 'audio-duration':
          setAudioDuration(payload)
          break

        case 'status':
          setStatus(payload)
          if (payload === 'ready') {
            setProgress(null)
            setLoadingPhases([])
            setDetectedLanguage(null)
            setTranscriptProgress(null)
            setAudioDuration(0)
          }
          break

        case 'language-detected':
          setDetectedLanguage(payload)
          break

        case 'result':
          if (task === 'transcription') {
            setTranscript(payload[0]?.text || '')
          } else if (task === 'generation') {
            setGeneratedText(payload[0]?.generated_text || '')
          } else if (task === 'classification') {
            setSentiment(payload[0])
          }
          setTranscriptProgress(null)
          setStatus('ready')
          break

        case 'error':
          console.error('Worker Error:', payload)
          setStatus('error')
          setDebugLogs((prev) => [...prev, `ERROR: ${payload}`].slice(-10))
          break
      }
    }

    return () => {
      worker.current?.terminate()
      URL.revokeObjectURL(url)
    }
  }, [loadingPhases])

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTranscript('')
    setAnalysis('')
    setDetectedLanguage(null)
    setLoadingPhases([])
    setTranscriptProgress(null)
    setAudioDuration(0)
    setDebugLogs([])
    setStatus('loading')

    try {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const audioData = audioBuffer.getChannelData(0)
      const sampleRate = audioBuffer.sampleRate
      const duration = audioBuffer.duration
      setAudioDuration(Math.round(duration))

      worker.current?.postMessage({
        type: 'transcribe',
        payload: { audio: audioData, sampleRate, duration },
      })
    } catch (error) {
      console.error('Audio processing error:', error)
      setStatus('error')
    }
  }

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Unable to copy', err)
    })
  }

  const runTextGen = () => {
    if (!inputText) return
    setGeneratedText('')
    setStatus('loading')
    worker.current?.postMessage({
      type: 'generate',
      payload: { text: inputText },
    })
  }

  const runSentiment = () => {
    const target = transcript || inputText
    if (!target) return
    setSentiment(null)
    setStatus('loading')
    worker.current?.postMessage({
      type: 'classify',
      payload: { text: target },
    })
  }

  const runGeminiAnalysis = async (type: 'summary' | 'tasks' | 'polish') => {
    if (!transcript && !generatedText) return
    setIsAnalyzing(true)
    try {
      const content = transcript || generatedText
      let prompt = ''
      if (type === 'summary')
        prompt = `Summarize this text concisely in bullet points: "${content}"`
      if (type === 'tasks')
        prompt = `Extract action items from this text: "${content}"`
      if (type === 'polish')
        prompt = `Rewrite this text to be more professional and clear: "${content}"`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: {
              parts: [{ text: 'You are an expert editor.' }],
            },
          }),
        }
      )

      if (!response.ok) throw new Error('Gemini API Error')
      const data = await response.json()
      setAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || '')
    } catch (e) {
      console.error(e)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const playTTS = async (text: string) => {
    if (isPlaying || !text) return
    setIsPlaying(true)
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Say nicely: ${text}` }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
              },
            },
          }),
        }
      )

      if (!response.ok) throw new Error('TTS API Error')
      const data = await response.json()
      const base64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      const audioData = Uint8Array.from(atob(base64), (c) =>
        c.charCodeAt(0)
      ).buffer

      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )()
      const buffer = await ctx.decodeAudioData(audioData)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => setIsPlaying(false)
      source.start(0)
    } catch (e) {
      console.error(e)
      setIsPlaying(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const StatusIndicator = () => {
    const statusConfigs = {
      idle: {
        color: 'bg-slate-400',
        text: 'Ready',
        description: 'System ready for processing',
      },
      loading: {
        color: 'bg-amber-500',
        text: `Loading Models${loadingPhases.length > 0 ? ` (${loadingPhases.join(', ')})` : ''}`,
        description: 'Downloading and initializing AI models',
      },
      'detecting-language': {
        color: 'bg-blue-500',
        text: 'Detecting Language',
        description: 'Analyzing audio to identify language',
      },
      transcribing: {
        color: 'bg-indigo-500',
        text: 'Transcribing Audio',
        description: 'Converting speech to text',
      },
      generating: {
        color: 'bg-purple-500',
        text: 'Generating Text',
        description: 'Creating content with local T5 model',
      },
      classifying: {
        color: 'bg-cyan-500',
        text: 'Analyzing Sentiment',
        description: 'Assessing text sentiment and tone',
      },
      ready: {
        color: 'bg-emerald-500',
        text: 'Done',
        description: 'Processing complete',
      },
      error: {
        color: 'bg-red-500',
        text: 'Error',
        description: 'An error occurred',
      },
    }

    const current = statusConfigs[status]

    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full border border-border shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            {(status === 'loading' ||
              status === 'detecting-language' ||
              status === 'transcribing' ||
              status === 'generating' ||
              status === 'classifying') && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.color}`}
              ></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${current.color}`}
            ></span>
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {current.text}
          </span>
          <span className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Local AI
          </span>
        </div>
        {current.description && (
          <span className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-right">
            {current.description}
          </span>
        )}
      </div>
    )
  }

  const DebugPanel = () => {
    if (debugLogs.length === 0) return null

    return (
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 mt-4">
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Debug Logs
        </h4>
        <div className="max-h-32 overflow-y-auto text-xs font-mono">
          {debugLogs.map((log, index) => (
            <div
              key={index}
              className="text-slate-600 dark:text-slate-300 py-1"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const LanguageDetectionIndicator = () => {
    if (!detectedLanguage) return null

    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-right-4 duration-300">
        <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <div className="flex-1">
          <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
            Language Detected
          </span>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-200 capitalize">
              {detectedLanguage.language || 'Unknown'}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {(detectedLanguage.confidence * 100).toFixed(1)}% confidence
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-stashly flex overflow-hidden">
      <aside className="w-20 md:w-64 bg-sidebar border-r border-border flex flex-col z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-linear-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div className="hidden md:block">
            <h1 className="font-bold text-lg tracking-tight">Nexus AI</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Local • Hybrid
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-6">
          <button
            onClick={() => setView('audio')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${view === 'audio' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            <Mic className="w-5 h-5" />
            <span className="hidden md:block">Transcription</span>
          </button>
          <button
            onClick={() => setView('text')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${view === 'text' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="hidden md:block">Generation</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-tight">
              System Status
            </h3>

            {loadingPhases.length > 0 && (
              <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Loading Models
                  </span>
                </div>
                <div className="space-y-1">
                  {loadingPhases.map((phase) => (
                    <div key={phase} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[10px] text-amber-700 dark:text-amber-400">
                        {phase}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {progress &&
              Object.entries(progress).map(([file, p]) => (
                <div key={file} className="space-y-1 mb-2 last:mb-0">
                  <div className="flex justify-between text-[10px] font-medium text-slate-500">
                    <span className="truncate max-w-[120px]">
                      {file.split('/').pop()}
                    </span>
                    <span>{Math.round(p)}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              ))}

            {!progress && loadingPhases.length === 0 && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                All Models Buffered
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {view === 'audio' ? 'Audio Studio' : 'Text Playground'}
          </h2>
          <StatusIndicator />
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {view === 'audio' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border p-1 shadow-sm">
                  <div
                    className={`relative h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                      status === 'transcribing' ||
                      status === 'detecting-language'
                        ? 'bg-indigo-50/50 border-indigo-200'
                        : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                    }`}
                  >
                    {status === 'detecting-language' ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3">
                          <Languages className="w-8 h-8 text-blue-500 animate-pulse" />
                          <div className="flex flex-col items-start">
                            <p className="text-sm font-medium text-blue-600">
                              Detecting Language...
                            </p>
                            <p className="text-xs text-blue-400">
                              Analyzing audio sample
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : status === 'transcribing' ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3">
                          <Mic className="w-8 h-8 text-indigo-500 animate-pulse" />
                          <div className="flex flex-col items-start">
                            <p className="text-sm font-medium text-indigo-600">
                              Transcribing Audio
                            </p>
                            <p className="text-xs text-indigo-400">
                              {audioDuration > 0
                                ? `Processing ${formatTime(audioDuration)} audio`
                                : 'Processing...'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                          <span className="text-xs text-indigo-600">
                            Using whisper-base model
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                          <FileAudio className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">
                          Upload Media
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Runs locally on your device
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      onChange={handleAudioUpload}
                      disabled={
                        status === 'transcribing' ||
                        status === 'detecting-language' ||
                        status === 'loading'
                      }
                    />
                  </div>

                  {detectedLanguage && <LanguageDetectionIndicator />}
                  <DebugPanel />
                </div>

                {transcript && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Transcript
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={runSentiment}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"
                          title="Sentiment"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(transcript)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 max-h-[400px] overflow-y-auto">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {transcript}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-linear-to-br from-indigo-900 to-violet-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col min-h-[320px]">
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-300" />
                        Gemini Insights
                      </h3>
                      <p className="text-indigo-200 text-xs mt-1">
                        Hybrid Cloud-Local Intelligence
                      </p>
                    </div>
                    {analysis && (
                      <button
                        onClick={() => playTTS(analysis)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        disabled={isPlaying}
                      >
                        {isPlaying ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 relative z-10">
                    {isAnalyzing ? (
                      <div className="h-full flex flex-col items-center justify-center text-indigo-200 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm">Analyzing context...</span>
                      </div>
                    ) : analysis ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-indigo-50">
                          {analysis}
                        </p>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-indigo-300/50 border-2 border-dashed border-indigo-400/20 rounded-xl p-4 text-center">
                        <p className="text-sm">
                          Run an action below to generate insights from your
                          transcript.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-6 relative z-10">
                    <button
                      onClick={() => runGeminiAnalysis('summary')}
                      disabled={!transcript}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30"
                    >
                      <Terminal className="w-4 h-4" />
                      <span className="text-xs">Summary</span>
                    </button>
                    <button
                      onClick={() => runGeminiAnalysis('tasks')}
                      disabled={!transcript}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs">Tasks</span>
                    </button>
                    <button
                      onClick={() => runGeminiAnalysis('polish')}
                      disabled={!transcript}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs">Polish</span>
                    </button>
                  </div>
                </div>

                {sentiment && (
                  <div className="bg-card p-6 rounded-2xl border border-border flex items-center justify-between shadow-sm animate-in zoom-in-95">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        Tone Detection
                      </p>
                      <h4 className="text-lg font-semibold mt-1">Sentiment</h4>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-2xl font-bold ${sentiment.label === 'POSITIVE' ? 'text-emerald-500' : 'text-rose-500'}`}
                      >
                        {sentiment.label}
                      </span>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                        Conf: {(sentiment.score * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'text' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Editor
                  </span>
                  <button
                    onClick={runTextGen}
                    disabled={
                      status === 'generating' ||
                      status === 'loading' ||
                      !inputText
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {status === 'generating' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Execute Pipeline
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your prompt for the local T5 model..."
                  className="w-full h-32 p-6 bg-transparent border-none resize-none focus:ring-0 text-slate-800 dark:text-slate-200 text-lg"
                />
              </div>

              {generatedText && (
                <div className="grid md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-4 text-slate-500">
                      <Cpu className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Local T5 Output
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {generatedText}
                    </p>
                  </div>

                  <div className="bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-center items-center text-center space-y-4">
                    <Sparkles className="w-8 h-8 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                      Hybrid Upgrade
                    </h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      Refine this local draft with Gemini's high-parameter
                      reasoning.
                    </p>
                    <button
                      onClick={() => {
                        setTranscript(generatedText)
                        setView('audio')
                      }}
                      className="bg-white dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:shadow-md transition-all"
                    >
                      Upgrade Content
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
