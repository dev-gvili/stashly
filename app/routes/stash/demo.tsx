import ibmPlexSansHebrewFonts from '@fontsource/ibm-plex-sans-hebrew/index.css?url'
import React, { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Progress } from '@/ui/progress'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import { formatSize } from '@/utils/formaters'
import {
  LanguageIcon,
  MediaIcon,
  MicIcon,
  SummarizeIcon,
  AiKeywordsIcon,
  AiTagsIcon,
  CopyIcon,
} from '../../components/icons'

type ModelStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'audio-duration'
  | 'detecting-language'
  | 'transcribing'
  | 'summarizing'
  | 'extract-keywords'
  | 'generating-tags'
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

const BAR_HEIGHTS = [
  0.35, 0.7, 1.0, 0.55, 0.85, 0.45, 0.75, 0.3, 0.9, 0.6, 0.95, 0.4, 0.65, 0.8,
  0.5, 0.7,
]

const STATUS_LABELS: Record<ModelStatus, string> = {
  idle: 'STANDBY',
  loading: 'LOADING',
  ready: 'DONE',
  'audio-duration': 'LOADED',
  'detecting-language': 'DETECTING',
  transcribing: 'TRANSCRIBING',
  summarizing: 'SUMMARIZING',
  'extract-keywords': 'KEYWORDS',
  'generating-tags': 'TAGGING',
  error: 'ERROR',
}

const PROCESSING_STATUSES: ModelStatus[] = [
  'loading',
  'detecting-language',
  'transcribing',
  'summarizing',
  'extract-keywords',
  'generating-tags',
]

export default function App() {
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
  const [fileInfo, setFileInfo] = useState<{
    name: string
    type: string
    size: string
    duration: number
  } | null>(null)
  const [modelName, setModelName] = useState<string | null>(null)
  const [executionProvider, setExecutionProvider] = useState<string>('unknown')
  const [gpuInfo, setGpuInfo] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState<string>('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [generatedTags, setGeneratedTags] = useState<string[]>([])

  const worker = useRef<Worker | null>(null)
  const pendingAudioRef = useRef<{
    audio: Float32Array
    sampleRate: number
    duration: number
  } | null>(null)

  const isProcessing = PROCESSING_STATUSES.includes(status)

  useEffect(() => {
    ;(async () => {
      try {
        const nav: any = navigator
        if (nav.gpu) {
          const adapter: any = await nav.gpu.requestAdapter()
          if (adapter) {
            setExecutionProvider('webgpu')
            try {
              const info = adapter?.info as any
              setGpuInfo(info?.description || info?.vendor || null)
            } catch {}
          } else {
            setExecutionProvider('wasm')
          }
        } else {
          setExecutionProvider('wasm')
        }
      } catch {
        setExecutionProvider('wasm')
      }
    })()

    worker.current = new Worker(
      new URL('../../workers/stash.worker.ts', import.meta.url),
      { type: 'module' }
    )

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
            if (!modelName) {
              if (fileName.includes('mms-lid')) setModelName('mms-lid-256')
              else if (fileName.includes('whisper-large'))
                setModelName('whisper-large-v3-turbo')
              else if (fileName.includes('whisper-small'))
                setModelName('whisper-small')
              else if (fileName.includes('LaMini'))
                setModelName('LaMini-Flan-T5-77M')
              else if (fileName.includes('tiny-aya-global-ONNX'))
                setModelName('tiny-aya-global-ONNX')
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
              fileName.includes('tiny-aya-global-ONNX') &&
              !loadingPhases.includes('Summarization')
            ) {
              setLoadingPhases((prev) => [...prev, 'Summarization'])
            }
          } else {
            setProgress(null)
            setLoadingPhases([])
          }
          break

        case 'audio-duration':
          setAudioDuration(payload)
          setStatus('audio-duration')
          break

        case 'partial-result':
          if (task === 'transcription') setTranscriptProgress(payload)
          break

        case 'status':
          setStatus(payload as ModelStatus)
          if (payload === 'detecting-language') setModelName('mms-lid-256')
          else if (payload === 'transcribing')
            setModelName('whisper-large-v3-turbo')
          else if (payload === 'summarizing')
            setModelName('tiny-aya-global-ONNX')
          else if (payload === 'extract-keywords')
            setModelName('bert-base-multilingual-cased-ner-hrl')
          else if (payload === 'generating-tags')
            setModelName('tiny-aya-global-ONNX')
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
          if (pendingAudioRef.current) {
            const { audio, sampleRate, duration } = pendingAudioRef.current
            pendingAudioRef.current = null
            worker.current?.postMessage({
              type: 'transcribe',
              payload: {
                audio,
                sampleRate,
                duration,
                language: payload.language,
              },
            })
          }
          break

        case 'result':
          if (task === 'transcription') {
            setTranscript(payload || '')
          } else if (task === 'summarization') {
            let text = ''
            if (Array.isArray(payload)) text = payload[0]?.generated_text || ''
            else if (typeof payload === 'string') text = payload
            else if (payload?.generated_text) text = payload.generated_text
            else if (payload?.summary) text = payload.summary
            else if (payload?.summary_text) text = payload.summary_text
            if (text) setSummary(text)
          } else if (task === 'extract-keywords') {
            setKeywords(payload.keywords)
          } else if (task === 'generate-tags') {
            setGeneratedTags(payload.tags)
          }
          setTranscriptProgress(null)
          setStatus('ready')
          break

        case 'error':
          console.error('Worker Error:', payload)
          setStatus('error')
          break
      }
    }

    return () => worker.current?.terminate()
  }, [])

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTranscript('')
    setSummary('')
    setKeywords([])
    setGeneratedTags([])
    setDetectedLanguage(null)
    setLoadingPhases([])
    setTranscriptProgress(null)
    setAudioDuration(0)
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

      setFileInfo({
        name: file.name,
        type: file.type,
        size: formatSize('byte', 'unit', file.size),
        duration,
      })

      pendingAudioRef.current = { audio: audioData, sampleRate, duration }
      worker.current?.postMessage({
        type: 'detect-language',
        payload: { audio: audioData, sampleRate },
      })
    } catch (err) {
      console.error('Audio processing error:', err)
      setStatus('error')
    }
  }

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .catch((err) => console.error('Unable to copy', err))
  }

  const runSummary = () => {
    if (!transcript) return
    setModelName('Qwen3-1.7B-ONNX')
    setSummary('')
    setStatus('loading')
    worker.current?.postMessage({
      type: 'summarize',
      payload: {
        text: transcript,
        language: detectedLanguage?.language || 'en',
      },
    })
  }

  const runKeywords = () => {
    const target = summary || transcript
    if (!target) return
    setModelName('Xenova/paraphrase-multilingual-MiniLM-L12-v2')
    setKeywords([])
    setStatus('loading')
    worker.current?.postMessage({
      type: 'extract-keywords',
      payload: { text: target, lang: detectedLanguage?.language || 'en' },
    })
  }

  const runGenerateTags = () => {
    const target = summary || transcript
    if (!target) return
    setGeneratedTags([])
    setStatus('loading')
    setModelName('tiny-aya-global-ONNX')
    worker.current?.postMessage({
      type: 'generate-tags',
      payload: {
        text: target,
        language: detectedLanguage?.language || 'en',
      },
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const gpuShort = gpuInfo ? gpuInfo.split(/[\s,]/)[0] : null

  return (
    <div className="min-h-screen bg-background text-foreground font-stashly">
      <style>{`
        @keyframes audioBar {
          0%   { transform: scaleY(0.25); }
          100% { transform: scaleY(1.1);  }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-[0.35em] uppercase text-muted-foreground">
              Stashly
            </span>
            <span className="text-border/60 text-xs leading-none">/</span>
            <span className="text-[9px] font-bold tracking-[0.35em] uppercase text-primary">
              Local AI
            </span>
          </div>

          <div className="flex items-center gap-3 text-[9px] font-bold tracking-[0.18em] uppercase">
            {modelName && (
              <span className="hidden sm:block text-muted-foreground/50 truncate max-w-36">
                {modelName}
              </span>
            )}
            <span className="hidden sm:block text-muted-foreground/50">
              {executionProvider}
              {gpuShort ? ` · ${gpuShort}` : ''}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {isProcessing && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    status === 'error'
                      ? 'bg-destructive-foreground'
                      : isProcessing
                        ? 'bg-primary'
                        : 'bg-muted-foreground/40'
                  }`}
                />
              </span>
              <span
                className={
                  status === 'error'
                    ? 'text-destructive-foreground'
                    : isProcessing
                      ? 'text-primary'
                      : 'text-muted-foreground/60'
                }
              >
                {STATUS_LABELS[status]}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Upload zone */}
        <div className="relative group">
          {/* Viewfinder corners */}
          <div className="absolute -top-px -left-px w-4 h-4 border-t border-l border-primary z-10 pointer-events-none rounded-tl" />
          <div className="absolute -top-px -right-px w-4 h-4 border-t border-r border-primary z-10 pointer-events-none rounded-tr" />
          <div className="absolute -bottom-px -left-px w-4 h-4 border-b border-l border-primary z-10 pointer-events-none rounded-bl" />
          <div className="absolute -bottom-px -right-px w-4 h-4 border-b border-r border-primary z-10 pointer-events-none rounded-br" />

          <div
            className={`relative h-56 border border-dashed flex items-center justify-center transition-all duration-300 overflow-hidden ${
              isProcessing
                ? 'cursor-default border-primary/25 bg-primary/2'
                : status === 'error'
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-border/40 hover:border-primary/40 bg-transparent hover:bg-muted/5'
            }`}
          >
            {/* Idle / ready / error */}
            {!isProcessing && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200 pointer-events-none">
                <MediaIcon
                  className={`w-8 h-8 ${
                    status === 'error'
                      ? 'text-destructive-foreground/50'
                      : 'text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors duration-200'
                  }`}
                />
                <div className="text-center space-y-1.5">
                  <p
                    className={`text-[10px] font-bold tracking-[0.28em] uppercase ${
                      status === 'error'
                        ? 'text-destructive-foreground'
                        : 'text-foreground/60'
                    }`}
                  >
                    {status === 'error'
                      ? 'Upload failed — try again'
                      : 'Drop audio or video'}
                  </p>
                  <p className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40">
                    Runs entirely on your device
                  </p>
                </div>
              </div>
            )}

            {/* Loading models */}
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-5 animate-in fade-in duration-200 w-full max-w-xs">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-primary">
                    {loadingPhases.length > 0
                      ? loadingPhases[loadingPhases.length - 1]
                      : 'Loading Models'}
                  </span>
                </div>
                {progress &&
                  Object.entries(progress).map(([file, p]) => (
                    <div key={file} className="w-full space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] tracking-wider text-muted-foreground/60 truncate max-w-44">
                          {file.split('/').pop()}
                        </span>
                        <span className="text-[9px] font-bold text-primary tabular-nums">
                          {Math.round(p)}%
                        </span>
                      </div>
                      <Progress value={p} className="h-px" />
                    </div>
                  ))}
              </div>
            )}

            {/* Detecting language */}
            {status === 'detecting-language' && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
                <LanguageIcon className="w-8 h-8 text-primary animate-pulse" />
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
                    Detecting Language
                  </p>
                  <p className="text-[9px] tracking-wider text-muted-foreground/50">
                    Analyzing audio fingerprint
                  </p>
                </div>
              </div>
            )}

            {/* Transcribing */}
            {status === 'transcribing' && (
              <div className="flex flex-col items-center gap-5 animate-in fade-in duration-200">
                <div className="flex items-end gap-[2px] h-10 w-32">
                  {BAR_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-primary/70 origin-bottom"
                      style={{
                        height: `${Math.max(12, h * 100)}%`,
                        animation: `audioBar ${0.65 + (i % 4) * 0.15}s ease-in-out ${i * 55}ms infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
                    Transcribing
                  </p>
                  {transcriptProgress ? (
                    <p className="text-[9px] tracking-wider text-muted-foreground/50">
                      {transcriptProgress.currentChunk} /{' '}
                      {transcriptProgress.totalChunks} chunks
                      {transcriptProgress.timeProcessed > 0 &&
                        ` · ${formatTime(transcriptProgress.timeProcessed)} processed`}
                    </p>
                  ) : audioDuration > 0 ? (
                    <p className="text-[9px] tracking-wider text-muted-foreground/50">
                      {formatTime(audioDuration)} audio file
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {/* Post-processing states */}
            {(status === 'summarizing' ||
              status === 'extract-keywords' ||
              status === 'generating-tags') && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
                {status === 'summarizing' && (
                  <SummarizeIcon className="w-8 h-8 text-primary animate-pulse" />
                )}
                {status === 'extract-keywords' && (
                  <AiKeywordsIcon className="w-8 h-8 text-primary animate-pulse" />
                )}
                {status === 'generating-tags' && (
                  <AiTagsIcon className="w-8 h-8 text-primary animate-pulse" />
                )}
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
                  {status === 'summarizing'
                    ? 'Summarizing'
                    : status === 'extract-keywords'
                      ? 'Extracting Keywords'
                      : 'Generating Tags'}
                </p>
              </div>
            )}

            {/* File input */}
            <input
              type="file"
              accept="audio/*, video/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleAudioUpload}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Metadata strip */}
        {fileInfo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase animate-in fade-in duration-300 pb-4 border-b border-border/20">
            <span className="normal-case text-muted-foreground/70 truncate max-w-56">
              {fileInfo.name}
            </span>
            <span className="text-border/40">·</span>
            <span>{fileInfo.size}</span>
            <span className="text-border/40">·</span>
            <span>{formatTime(fileInfo.duration)}</span>
            {detectedLanguage && (
              <>
                <span className="text-border/40">·</span>
                <span className="flex items-center gap-1">
                  <LanguageIcon className="w-3 h-3" />
                  <span className="capitalize">
                    {detectedLanguage.language}
                  </span>
                  <span className="opacity-50">
                    ({(detectedLanguage.confidence * 100).toFixed(0)}%)
                  </span>
                </span>
              </>
            )}
            <span className="ml-auto">
              {executionProvider}
              {gpuShort ? ` · ${gpuShort}` : ''}
            </span>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="border border-border animate-in slide-in-from-bottom-3 fade-in duration-400 rounded bg-sidebar">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
                Transcript
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  onClick={runSummary}
                  title="Summarize"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isProcessing}
                >
                  <SummarizeIcon className="size-5!" />
                </Button>
                <Button
                  onClick={runKeywords}
                  title="Extract Keywords"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isProcessing}
                >
                  <AiKeywordsIcon className="size-5!" />
                </Button>
                <Button
                  onClick={runGenerateTags}
                  title="Generate Tags"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isProcessing}
                >
                  <AiTagsIcon className="size-5!" />
                </Button>
                <Separator
                  orientation="vertical"
                  className="h-3 mx-1 opacity-30"
                />
                <Button
                  onClick={() => handleCopy(transcript)}
                  title="Copy Transcript"
                  variant="ghost"
                  size="icon-sm"
                >
                  <CopyIcon className="size-5!" />
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-72">
              <div className="px-4 py-4">
                <p
                  dir={detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
                  className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
                >
                  {transcript}
                </p>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="border border-border/50 animate-in slide-in-from-bottom-3 fade-in duration-400">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                Summary
              </span>
              <Button
                onClick={() => handleCopy(summary)}
                title="Copy Summary"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground/50 hover:text-foreground"
              >
                <CopyIcon className="size-3.5!" />
              </Button>
            </div>
            <div className="px-4 py-4">
              <p
                dir={detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
                className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap"
              >
                {summary}
              </p>
            </div>
          </div>
        )}

        {/* Keywords + Tags */}
        {(keywords.length > 0 || generatedTags.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-bottom-3 fade-in duration-400">
            {keywords.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                  Keywords
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((keyword, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[9px] tracking-wide rounded-none border-border/40 text-muted-foreground/60 font-stashly py-0.5"
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {generatedTags.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                  Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {generatedTags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[9px] tracking-wide rounded-none border-primary/20 text-primary/60 font-stashly py-0.5"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
