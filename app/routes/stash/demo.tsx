import ibmPlexSansHebrewFonts from '@fontsource/ibm-plex-sans-hebrew/index.css?url'
import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Loader2,
  Play,
  FileAudio,
  CheckCircle2,
  Cpu,
  BarChart3,
  FileText,
  Sparkles,
  GithubIcon,
  BarChart2,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/ui/card'
import { Button } from '@/ui/button'
import { Textarea } from '@/ui/textarea'
import { formatSize } from '@/utils/formaters'
import {
  Audio2Icon,
  AudioIcon,
  LanguageIcon,
  MediaIcon,
  MicIcon,
  SummarizeIcon,
} from '../../components/icons'
import type { summarizeContextSchema } from '../../machines/ai/ai.machine'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Badge } from '../../components/ui'
// import {cleanText} from '@/.server/search/embeddings'
// import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.4';
// --- WORKER CODE (WebGPU device-loss safe + memory/GPU optimized) ---

// Note: GPU adapter detection uses runtime `any` to avoid missing DOM lib types.

type ViewMode =
  | 'audio'
  | 'text'
  | 'image'
  | 'video'
  | 'caption'
  | 'summary'
  | 'sentiment'
type ModelStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'audio-duration'
  | 'detecting-language'
  | 'captioning'
  | 'transcribing'
  | 'generating'
  | 'summarizing'
  | 'classifying'
  | 'extract-keywords'
  | 'error'

interface ChunkProgress {
  currentChunk: number
  totalChunks: number
  progress: number
  timeProcessed: number
  chunkStart?: number
  chunkEnd?: number
}

export const links = () => [{ rel: 'stylesheet', href: ibmPlexSansHebrewFonts }]

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

  // additional metadata states
  const [fileInfo, setFileInfo] = useState<{
    name: string
    type: string
    size: string
    duration: number
  } | null>(null)
  const [modelName, setModelName] = useState<string | null>(null)
  const [executionProvider, setExecutionProvider] = useState<string>('unknown')
  const [gpuAdapter, setGpuAdapter] = useState<any | null>(null)
  const [gpuInfo, setGpuInfo] = useState<string | null>(null)

  const [transcript, setTranscript] = useState('')
  const [inputText, setInputText] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [sentiment, setSentiment] = useState<any>(null)
  const [summary, setSummary] = useState<string>('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [captioningImage, setCaptioningImage] = useState<string | null>(null)

  const [caption, setCaption] = useState<string>('')
  const worker = useRef<Worker | null>(null)

  useEffect(() => {
    // detect GPU/provider for display
    ;(async () => {
      try {
        const nav: any = navigator
        if (nav.gpu) {
          const adapter: any = await nav.gpu.requestAdapter()
          if (adapter) {
            setExecutionProvider('webgpu')
            setGpuAdapter(adapter)
            try {
              const info = adapter?.info as any
              setGpuInfo(info?.description || info?.vendor || 'GPU adapter')
            } catch {}
          } else {
            setExecutionProvider('wasm')
          }
        } else {
          setExecutionProvider('wasm')
        }
      } catch (e) {
        console.warn('GPU detection failed', e)
        setExecutionProvider('wasm')
      }
    })()

    // const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
    // const url = URL.createObjectURL(blob)
    worker.current = new Worker(
      new URL('../../workers/stash.worker.ts', import.meta.url),
      {
        type: 'module',
      }
    )
    // worker.current = new Worker(url, { type: 'module' })

    worker.current.onmessage = (e) => {
      const { type, payload, task } = e.data

      if (type !== 'progress') {
        console.log('Worker message:', type, payload)
      }

      switch (type) {
        case 'progress':
          if (payload.status === 'progress') {
            setProgress((prev) => ({
              ...(prev || {}),
              [payload.file]: payload.progress,
            }))

            const fileName = payload.file.split('/').pop() || ''
            // capture model name once when first seen
            if (!modelName) {
              if (fileName.includes('mms-lid')) setModelName('mms-lid-256')
              else if (fileName.includes('whisper-large'))
                setModelName('whisper-large-v3-turbo')
              else if (fileName.includes('whisper-small'))
                setModelName('whisper-small')
              else if (fileName.includes('LaMini'))
                setModelName('LaMini-Flan-T5-77M')
              else if (fileName.includes('distilbert'))
                setModelName('distilbert-sst-2')
              else if (fileName.includes('tiny-aya-global-ONNX'))
                setModelName('tiny-aya-global-ONNX')
              else if (fileName.includes('Florence-2-base-ft'))
                setModelName('Florence-2-base-ft')
            }
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
            } else if (
              fileName.includes('tiny-aya-global-ONNX') &&
              !loadingPhases.includes('Summarization')
            ) {
              setLoadingPhases((prev) => [...prev, 'Summarization'])
            } else if (
              fileName.includes('Florence-2-base-ft') &&
              !loadingPhases.includes('Captioning')
            ) {
              setLoadingPhases((prev) => [...prev, 'Captioning'])
            }
          } else {
            // If no specific model is loading, clear progress and phases
            setProgress(null)
            setLoadingPhases([])
          }
          break

        case 'debug':
          setDebugLogs((prev) => [...prev, payload].slice(-10))
          console.log('Worker Debug:', payload)
          break

        case 'audio-duration':
          setAudioDuration(payload)
          setStatus('audio-duration')
          break

        case 'partial-result':
          if (task === 'transcription') {
            setTranscriptProgress(payload)
          }
          break

        case 'status':
          setStatus(payload)
          // map status to model when known
          if (payload === 'detecting-language') {
            setModelName('mms-lid-256')
          } else if (payload === 'transcribing') {
            setModelName('whisper-large-v3-turbo')
          } else if (payload === 'generating') {
            setModelName('LaMini-Flan-T5-77M')
          } else if (payload === 'classifying') {
            setModelName('distilbert-sst-2')
          } else if (payload === 'summarizing') {
            setModelName('tiny-aya-global-ONNX')
          } else if (payload === 'captioning') {
            setModelName('Florence-2-base-ft')
          } else if (payload === 'extract-keywords') {
            setModelName('bert-base-multilingual-cased-ner-hrl')
          }
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
          console.log('result payload', task, payload)
          if (task === 'transcription') {
            setTranscript(payload || '')
          } else if (task === 'generation') {
            setGeneratedText(
              Array.isArray(payload)
                ? payload[0]?.generated_text || ''
                : typeof payload === 'string'
                  ? payload
                  : ''
            )
          } else if (task === 'classification') {
            setSentiment(payload[0])
          } else if (task === 'summarization') {
            let text = ''
            if (Array.isArray(payload)) {
              text = payload[0]?.generated_text || ''
            } else if (typeof payload === 'string') {
              text = payload
            } else if (payload?.generated_text) {
              text = payload.generated_text
            } else if (payload?.summary) {
              text = payload.summary
            } else if (payload?.summary_text) {
              text = payload.summary_text
            }
            if (text) {
              setSummary(text)
            }
          } else if (task === 'captioning' && payload?.caption) {
            setCaption(payload.caption)
          } else if (task === 'extract-keywords') {
            setKeywords(payload.keywords)
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
    }
  }, [])

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('Audio file selected:', file.name, file.size, file.type)

    setTranscript('')
    setSummary('')
    setDetectedLanguage(null)
    setLoadingPhases([])
    setTranscriptProgress(null)
    setAudioDuration(0)
    setDebugLogs([])
    setStatus('loading')
    setModelName('whisper-large-v3-turbo')
    setFileInfo(null)

    try {
      const ctx = new window.AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const audioData = audioBuffer.getChannelData(0)
      const sampleRate = audioBuffer.sampleRate
      const duration = audioBuffer.duration

      // record uploaded file metadata
      setFileInfo({
        name: file.name,
        type: file.type,
        size: formatSize('byte', 'unit', file.size),
        duration,
      })

      worker.current?.postMessage({
        type: 'transcribe',
        payload: {
          audio: audioData,
          sampleRate: sampleRate,
          duration: duration,
        },
      })
      // await ctx.close()
    } catch (error) {
      console.error('Audio processing error:', error)
      setStatus('error')
      if (error instanceof Error) {
        setDebugLogs((prev) =>
          [...prev, `Audio processing error: ${error.message}`].slice(-10)
        )
      }
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
    setModelName('LaMini-Flan-T5-77M')
    setGeneratedText('')
    setSummary('')
    setStatus('loading')
    worker.current?.postMessage({
      type: 'generate',
      payload: { text: inputText },
    })
  }

  const runSentiment = () => {
    const target = transcript || inputText
    if (!target) return
    setModelName('distilbert-sst-2')
    setSentiment(null)
    setStatus('loading')
    worker.current?.postMessage({
      type: 'classify',
      payload: { text: target },
    })
  }

  const runSummary = () => {
    const target = transcript || inputText
    if (!target) return
    setModelName('Qwen3-1.7B-ONNX')
    setSummary('')
    setStatus('loading')
    worker.current?.postMessage({
      type: 'summarize',
      payload: { text: target, lang: detectedLanguage?.language || 'en' },
    })
  }

  const runKeywords = () => {
    const target = summary || transcript || inputText
    if (!target) return
    setModelName('Xenova/paraphrase-multilingual-MiniLM-L12-v2')
    setKeywords([]) // Clear summary as we're doing keywords
    setStatus('loading')
    worker.current?.postMessage({
      type: 'extract-keywords',
      payload: { text: target, lang: detectedLanguage?.language || 'en' },
    })
  }

  const runCaptioning = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCaption('')
    setCaptioningImage(URL.createObjectURL(file))
    setStatus('loading')
    setModelName('Florence-2-base-ft')

    worker.current?.postMessage({
      type: 'caption',
      payload: { url: captioningImage },
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const StatusIndicator = () => {
    const statusConfigs = {
      idle: {
        color: 'bg-muted',
        text: 'Ready',
        description: 'System ready for processing',
      },
      loading: {
        color: 'bg-secondary',
        text: `Loading Models${loadingPhases.length > 0 ? ` (${loadingPhases.join(', ')})` : ''}`,
        description: 'Downloading and initializing AI models',
      },
      'audio-duration': {
        color: 'bg-primary',
        text: 'Audio Loaded',
        description: `Audio duration: ${formatTime(audioDuration)}`,
      },
      'detecting-language': {
        color: 'bg-primary',
        text: 'Detecting Language',
        description: 'Analyzing audio to identify language',
      },
      transcribing: {
        color: 'bg-primary',
        text: 'Transcribing Audio',
        description: 'Converting speech to text',
      },
      summarizing: {
        color: 'bg-primary',
        text: 'Summarizing Text',
        description: 'Generating concise summary of the text',
      },
      generating: {
        color: 'bg-secondary',
        text: 'Generating Text',
        description: 'Creating content with local T5 model',
      },
      classifying: {
        color: 'bg-secondary',
        text: 'Analyzing Sentiment',
        description: 'Assessing text sentiment and tone',
      },
      captioning: {
        color: 'bg-secondary',
        text: 'Generating Caption',
        description: 'Creating image caption with Florence-2-base-ft',
      },
      'extract-keywords': {
        color: 'bg-secondary',
        text: 'Extracting Keywords',
        description: 'Extracting keywords from text',
      },
      ready: {
        color: 'bg-primary',
        text: 'Done',
        description: 'Processing complete',
      },
      error: {
        color: 'bg-destructive',
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
              status === 'summarizing' ||
              status === 'captioning' ||
              status === 'extract-keywords' ||
              status === 'classifying') && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.color}`}
              ></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${current.color}`}
            ></span>
          </span>
          <span className="text-xs font-medium text-foreground">
            {current.text}
          </span>
          <span className="h-3 w-px bg-border mx-1" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Local AI
          </span>
        </div>
        {current.description && (
          <span className="text-xs text-muted-foreground max-w-xs text-right">
            {current.description}
          </span>
        )}
      </div>
    )
  }

  const DebugPanel = () => {
    if (debugLogs.length === 0) return null

    return (
      <Card className="bg-muted p-4">
        Debug Logs
        <ScrollArea className="h-32">
          {debugLogs.map((log, index) => (
            <div
              key={index}
              className="text-muted-foreground text-xs py-1.5 leading-relaxed hover:text-foreground transition-colors"
            >
              {log}
            </div>
          ))}
        </ScrollArea>
      </Card>
    )
  }

  const LanguageDetectionIndicator = () => {
    if (!detectedLanguage) return null

    return (
      <Card className="bg-muted p-4">
        <CardContent className="p-0">
          Language Detected
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <LanguageIcon className="size-6 text-primary" />
              <span className="mt-1 text-muted-foreground capitalize text-lg">
                {detectedLanguage.language || 'Unknown'}
              </span>
            </div>
            <span className="text-xs font-medium bg-card/20 text-muted-foreground px-2 py-1 rounded">
              {(detectedLanguage.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const FileInfoCard = () => {
    if (!fileInfo) return null

    return (
      <Card className="bg-muted p-4">
        <CardHeader className="p-0">File Info</CardHeader>
        <CardContent className="space-y-3 text-xs p-0">
          <div className="flex justify-between items-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="font-medium">Name</span>
            <span className="font-medium text-foreground truncate ml-2 max-w-xs">
              {fileInfo.name}
            </span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="font-medium">Type</span>
            <span className="font-medium text-foreground bg-muted/40 px-2 py-0.5 rounded">
              {fileInfo.type || 'unknown'}
            </span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="font-medium">Size</span>
            <span className="font-medium text-foreground">{fileInfo.size}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="font-medium">Duration</span>
            <span className="font-medium text-foreground">
              {formatTime(fileInfo.duration)}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const ModelInfoCard = () => {
    if (!modelName) return null

    return (
      <Card className="bg-muted p-4">
        <CardContent className="p-0">
          Model In Use
          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
            {modelName}
          </p>
        </CardContent>
      </Card>
    )
  }

  const GPUDeviceCard = () => {
    return (
      <Card className="bg-muted p-4">
        <CardContent className="flex flex-col gap-y-2 text-xs p-0">
          Execution
          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">Provider</span>
            <span className="font-semibold">{executionProvider}</span>
          </div>
          {gpuInfo && (
            <div className="flex justify-between">
              <span className="font-medium text-muted-foreground">GPU</span>
              <span className="font-semibold truncate ml-2 max-w-xs">
                {gpuInfo}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-stashly flex overflow-hidden">
      <aside className="w-20 md:w-64 bg-sidebar border-r border-border flex flex-col z-20 shadow-lg">
        <nav className="flex-1 px-2 space-y-0.5 mt-6">
          <button
            onClick={() => setView('audio')}
            className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg ${
              view === 'audio'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
            }`}
          >
            <MicIcon className="w-5 h-5 shrink-0" />
            <span className="hidden md:block text-sm">Transcription</span>
          </button>
          <button
            onClick={() => setView('text')}
            className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg ${
              view === 'text'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            <span className="hidden md:block text-sm">Generation</span>
          </button>
          <button
            onClick={() => setView('image')}
            className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg ${
              view === 'image'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
            }`}
          >
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="hidden md:block text-sm">Image Captioning</span>
          </button>
        </nav>

        <div className="p-4 border-t border-border flex flex-col gap-4">
          <div className="bg-linear-to-br from-secondary/10 to-transparent rounded-lg p-3 border border-secondary/20">
            <h3 className="text-xs font-semibold text-secondary mb-3 uppercase tracking-tight flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
              System Status
            </h3>

            {loadingPhases.length > 0 && (
              <div className="mb-4 p-2.5 bg-secondary/10 rounded border border-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-3 h-3 text-secondary animate-spin" />
                  <span className="text-xs font-semibold text-secondary">
                    Loading Models
                  </span>
                </div>
                <div className="space-y-1.5">
                  {loadingPhases.map((phase) => (
                    <div
                      key={phase}
                      className="text-[10px] text-muted-foreground flex items-center gap-2"
                    >
                      <div className="w-1 h-1 rounded-full bg-secondary/50" />
                      {phase}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {progress &&
              Object.entries(progress).map(([file, p]) => (
                <div key={file} className="space-y-1 mb-2 last:mb-0">
                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                    <span className="truncate max-w-30">
                      {file.split('/').pop()}
                    </span>
                    <span>{Math.round(p)}%</span>
                  </div>
                  <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              ))}

            {!progress && loadingPhases.length === 0 && (
              <div className="text-[11px] text-muted-foreground font-medium">
                All Models Buffered
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="p-0 overflow-y-auto relative w-full">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 flex justify-between items-center shadow-sm">
          <StatusIndicator />
        </header>
        <div className="py-4 max-w-6xl mx-auto space-y-10">
          {view === 'audio' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-y-4">
                <div className="space-y-6">
                  <Card
                    className={`relative h-48 border-border border-2 border-dashed flex flex-col items-center ${
                      status === 'transcribing' ||
                      status === 'detecting-language'
                        ? 'bg-primary/5'
                        : 'bg-muted/5 hover:bg-muted/10'
                    }`}
                  >
                    <CardContent className="flex flex-col items-center justify-center h-full w-full">
                      {status === 'detecting-language' ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center gap-3">
                            <LanguageIcon className="w-8 h-8 text-current animate-pulse" />
                            <div className="flex flex-col items-start">
                              <p className="text-sm font-medium text-muted-foreground">
                                Detecting Language...
                              </p>
                              <p className="text-xs text-secondary-foreground">
                                Analyzing audio sample
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : status === 'transcribing' ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center gap-3">
                            <MicIcon className="w-8 h-8 text-primary animate-pulse" />
                            <div className="flex flex-col items-start">
                              <p className="text-sm font-medium text-primary">
                                Transcribing Audio
                              </p>
                              <p className="text-muted-foreground font-stashly text-sm">
                                {audioDuration > 0
                                  ? `Processing ${formatTime(audioDuration)} audio`
                                  : 'Processing...'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            <span className="text-xs text-primary">
                              This may take a while for longer audio files
                            </span>
                          </div>
                        </div>
                      ) : status === 'summarizing' ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center gap-3">
                            <SummarizeIcon className="w-8 h-8 text-primary animate-pulse" />
                            <div className="flex flex-col items-start">
                              <p className="text-sm font-medium text-primary">
                                Summarizing Content
                              </p>
                              <p className="text-muted-foreground font-stashly text-sm">
                                Generating summary of transcript
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mb-3">
                            <MediaIcon className="size-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            Upload Media
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Runs locally on your device
                          </p>
                        </>
                      )}
                    </CardContent>
                    <input
                      type="file"
                      accept="audio/*, video/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      onChange={handleAudioUpload}
                      disabled={
                        status === 'transcribing' ||
                        status === 'detecting-language' ||
                        status === 'loading' ||
                        status === 'generating' ||
                        status === 'summarizing' ||
                        status === 'classifying'
                      }
                    />
                  </Card>

                  {detectedLanguage && <LanguageDetectionIndicator />}
                </div>

                {transcript && (
                  <div className="bg-linear-to-br from-foreground/5 to-transparent rounded-lg border border-foreground/10 shadow-md overflow-hidden animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-4 p-4 pb-3 border-b border-foreground/5">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        Transcript
                      </h3>
                      <div className="flex gap-1">
                        <button
                          onClick={runSummary}
                          className="p-2 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-all"
                          title="Summarize"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={runSentiment}
                          className="p-2 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-all"
                          title="Sentiment"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={runKeywords}
                          className="p-2 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-all"
                          title="Keywords"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(transcript)}
                          className="p-2 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-all"
                          title="Copy"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto px-4 pb-4">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                        {transcript}
                      </p>
                    </div>
                  </div>
                )}

                {summary && (
                  <Card className="bg-muted p-4">
                    Summary
                    <p
                      dir={detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
                      className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {summary}
                    </p>
                  </Card>
                )}

                {caption && (
                  <div className="bg-linear-to-br from-primary/5 to-transparent rounded-lg p-4 border border-primary/20 shadow-md mt-6 animate-in fade-in duration-300 delay-100">
                    <h4 className="text-sm font-semibold text-primary mb-3 uppercase tracking-tight flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      Image Caption
                    </h4>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {caption}
                    </p>
                  </div>
                )}
                {keywords && keywords.length > 0 && (
                  <Card className="bg-muted p-4">
                    <div className="flex flex-wrap gap-2">
                      Keywords
                      {keywords.map((keyword, index) => (
                        <Badge
                          key={index}
                          className="bg-primary/10 text-muted-foreground text-xs font-stashly rounded-md"
                          variant="outline"
                        >
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              <div className="flex flex-col gap-y-4">
                <FileInfoCard />
                <ModelInfoCard />
                <GPUDeviceCard />
                <DebugPanel />
              </div>

              {sentiment && (
                <div className="bg-linear-to-br from-secondary/10 to-secondary/5 rounded-lg p-4 border border-secondary/30 shadow-md flex items-start justify-between animate-in zoom-in-95 mt-6">
                  <div>
                    <p className="text-xs text-secondary uppercase font-bold tracking-tight mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      Tone Detection
                    </p>
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                      Sentiment
                    </h4>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-lg font-bold px-3 py-1.5 rounded-md ${
                        sentiment.label === 'POSITIVE'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-destructive/20 text-destructive'
                      }`}
                    >
                      {sentiment.label}
                    </span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-tight mt-1.5 font-medium">
                      Conf: {(sentiment.score * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'text' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
              <div className="bg-linear-to-br from-foreground/5 to-transparent rounded-lg border border-foreground/10 overflow-hidden">
                <div className="flex justify-between items-center gap-4 p-4 pb-3 border-b border-foreground/5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-tight flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    Text Generation
                  </h2>
                  <button
                    onClick={runTextGen}
                    disabled={
                      status === 'generating' ||
                      status === 'loading' ||
                      !inputText
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow-md"
                  >
                    {status === 'generating' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Generate
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your prompt for the local T5 model..."
                  className="w-full h-32 p-4 bg-muted/20 border-none resize-none focus:ring-1 focus:ring-primary text-foreground text-sm leading-relaxed"
                />
              </div>

              {summary && (
                <div className="bg-linear-to-br from-secondary/5 to-transparent rounded-lg p-4 border border-secondary/20 animate-in fade-in duration-300">
                  <h4 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-tight flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full" />
                    Summary
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {summary}
                  </p>
                </div>
              )}

              {generatedText && (
                <div className="grid md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500 mt-6">
                  <div className="bg-linear-to-br from-primary/5 to-transparent rounded-lg p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">
                        Local T5 Output
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {generatedText}
                    </p>
                  </div>

                  <div className="bg-linear-to-br from-secondary/10 to-secondary/5 rounded-lg p-4 border border-secondary/30 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-secondary" />
                        <h3 className="text-sm font-semibold text-secondary">
                          Hybrid Upgrade
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Refine this local draft with Gemini's high-parameter
                        reasoning.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setTranscript(generatedText)
                        setView('audio')
                      }}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2.5 rounded-md text-sm font-semibold transition-all w-fit"
                    >
                      Upgrade Content
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {view === 'image' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
              <div className="space-y-6">
                <div
                  className={`relative h-96 rounded-lg flex flex-col items-center justify-center transition-all border-2 border-dashed ${status === 'captioning' ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/5'}`}
                >
                  {captioningImage ? (
                    <img
                      src={captioningImage}
                      alt="Captioning Image"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <MediaIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Upload Image
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Runs locally on your device
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={runCaptioning}
                    disabled={status === 'captioning' || status === 'loading'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
