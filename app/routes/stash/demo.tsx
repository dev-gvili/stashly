import ibmPlexSansHebrewFonts from '@fontsource/ibm-plex-sans-hebrew/index.css?url'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { WorkerSnapshot } from '@/types/machine.types'
import { initialWorkerSnapshot } from '@/types/machine.types'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Progress } from '@/ui/progress'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import {
  LanguageIcon,
  MediaIcon,
  SummarizeIcon,
  AiKeywordsIcon,
  AiTagsIcon,
  CopyIcon,
  VerifyTranscriptIcon
} from '@/components/icons'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChunkProgress {
  currentChunk: number
  totalChunks: number
  progress: number
  timeProcessed: number
  chunkStart?: number
  chunkEnd?: number
}

interface FileInfo {
  name: string
  type: string
  size: string
  duration: number
}

interface DetectedLanguage {
  language: string
  confidence: number
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

export const links = () => [{ rel: 'stylesheet', href: ibmPlexSansHebrewFonts }]

const STATE_LABELS: Record<string, string> = {
  checking_hardware: 'STANDBY',
  idle: 'STANDBY',
  detecting_language: 'DETECTING',
  transcribing: 'TRANSCRIBING',
  correcting_text: 'CORRECTING',
  ready: 'DONE',
  summarizing: 'SUMMARIZING',
  extracting_keywords: 'KEYWORDS',
  generating_tags: 'TAGGING',
  error: 'ERROR',
}

const IDLE_STATES = ['idle', 'ready', 'error', 'checking_hardware']

// Sine wave path for the transcribing animation — sampled every 2px for a smooth curve
const WAVE_PERIOD = 32
const transcribeWavePath = (() => {
  const amp = 9
  const cy = 24
  let d = ''
  for (let x = 0; x <= 352; x += 2) {
    const y = cy + amp * Math.sin((x / WAVE_PERIOD) * Math.PI * 2)
    d += x === 0 ? `M ${x},${y.toFixed(2)}` : ` L ${x},${y.toFixed(2)}`
  }
  return d
})()

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppHeader({
  modelName,
  stateValue,
  isProcessing,
}: {
  modelName: string | null
  stateValue: string
  isProcessing: boolean
}) {
  const isError = stateValue === 'error'
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 h-10 flex items-center justify-between">
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
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              {isProcessing && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  isError
                    ? 'bg-destructive-foreground'
                    : isProcessing
                      ? 'bg-primary'
                      : 'bg-muted-foreground/40'
                }`}
              />
            </span>
            <span
              className={
                isError
                  ? 'text-destructive-foreground'
                  : isProcessing
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
              }
            >
              {STATE_LABELS[stateValue] ?? 'STANDBY'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

function UploadIdleState({ isError }: { isError: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200 pointer-events-none">
      <MediaIcon
        className={`w-8 h-8 ${
          isError
            ? 'text-destructive-foreground/50'
            : 'text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors duration-200'
        }`}
      />
      <div className="text-center space-y-1.5">
        <p
          className={`text-[10px] font-bold tracking-[0.28em] uppercase ${
            isError ? 'text-destructive-foreground' : 'text-foreground/60'
          }`}
        >
          {isError ? 'Upload failed — try again' : 'Drop audio or video'}
        </p>
        <p className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40">
          Runs entirely on your device
        </p>
      </div>
    </div>
  )
}

function UploadLoadingState({
  loadingPhases,
  progress,
}: {
  loadingPhases: string[]
  progress: Record<string, number> | null
}) {
  return (
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
  )
}

function UploadDetectingState() {
  return (
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
  )
}

function UploadTranscribingState({
  transcriptProgress,
  audioDuration,
}: {
  transcriptProgress: ChunkProgress | null
  audioDuration: number
}) {
  return (
    <div className="flex flex-col items-center gap-5 animate-in fade-in duration-200">
      <div className="relative w-56 h-12 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          <motion.svg
            width={370}
            height={48}
            className="absolute top-0 left-0"
            initial={{ x: -WAVE_PERIOD }}
            animate={{ x: [-WAVE_PERIOD, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          >
            <path
              d={transcribeWavePath}
              className="stroke-primary"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.55}
              fill="none"
            />
          </motion.svg>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
          Transcribing
        </p>
        {transcriptProgress ? (
          <p className="text-[9px] tracking-wider text-muted-foreground/50">
            {transcriptProgress.currentChunk} / {transcriptProgress.totalChunks} chunks
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
  )
}

function UploadPostProcessingState({ stateValue }: { stateValue: string }) {
  const label =
    stateValue === 'correcting_text'
      ? 'Verifying Transcript'
      : stateValue === 'summarizing'
        ? 'Summarizing'
        : stateValue === 'extracting_keywords'
          ? 'Extracting Keywords'
          : 'Generating Tags'

  return (
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
      {stateValue === 'correcting_text' && (
        <VerifyTranscriptIcon className="w-8 h-8 text-primary animate-pulse" />
      )}
      {stateValue === 'summarizing' && (
        <SummarizeIcon className="w-8 h-8 text-primary animate-pulse" />
      )}
      {stateValue === 'extracting_keywords' && (
        <AiKeywordsIcon className="w-8 h-8 text-primary animate-pulse" />
      )}
      {stateValue === 'generating_tags' && (
        <AiTagsIcon className="w-8 h-8 text-primary animate-pulse" />
      )}
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
        {label}
      </p>
    </div>
  )
}

function UploadZone({
  stateValue,
  isProcessing,
  loadingPhases,
  progress,
  transcriptProgress,
  audioDuration,
  onUpload,
}: {
  stateValue: string
  isProcessing: boolean
  loadingPhases: string[]
  progress: Record<string, number> | null
  transcriptProgress: ChunkProgress | null
  audioDuration: number
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const isError = stateValue === 'error'
  const showLoading = isProcessing && progress !== null && Object.keys(progress).length > 0
  const showDetecting = stateValue === 'detecting_language' && !showLoading
  const showTranscribing = stateValue === 'transcribing' && !showLoading
  const showPostProcessing =
    (stateValue === 'correcting_text' ||
      stateValue === 'summarizing' ||
      stateValue === 'extracting_keywords' ||
      stateValue === 'generating_tags') &&
    !showLoading

  return (
    <div className="relative group">
      {/* Viewfinder corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary z-10 pointer-events-none rounded-tl-lg" />
      <div className="absolute -top-px right-0 w-4 h-4 border-t-2 border-r-2 border-primary z-10 pointer-events-none rounded-tr-lg" />
      <div className="absolute -bottom-px left-0 w-4 h-4 border-b-2 border-l-2 border-primary z-10 pointer-events-none rounded-bl-lg" />
      <div className="absolute -bottom-px right-0 w-4 h-4 border-b-2 border-r-2 border-primary z-10 pointer-events-none rounded-br-lg" />

      <div
        className={`relative h-56 border-2 border-border flex items-center justify-center transition-all duration-300 overflow-hidden ${
          isProcessing
            ? 'cursor-default border-primary/25 bg-primary/2'
            : isError
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-border/40 hover:border-primary/40 bg-transparent hover:bg-muted/5'
        }`}
      >
        {!isProcessing && <UploadIdleState isError={isError} />}
        {showLoading && (
          <UploadLoadingState loadingPhases={loadingPhases} progress={progress} />
        )}
        {showDetecting && <UploadDetectingState />}
        {showTranscribing && (
          <UploadTranscribingState
            transcriptProgress={transcriptProgress}
            audioDuration={audioDuration}
          />
        )}
        {showPostProcessing && <UploadPostProcessingState stateValue={stateValue} />}

        <input
          type="file"
          accept="audio/*, video/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onChange={onUpload}
          disabled={isProcessing}
        />
      </div>
    </div>
  )
}

function MetadataStrip({
  fileInfo,
  detectedLanguage,
  executionProvider,
  gpuShort,
}: {
  fileInfo: FileInfo
  detectedLanguage: DetectedLanguage | null
  executionProvider: string
  gpuShort: string | null
}) {
  return (
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
            <span className="capitalize">{detectedLanguage.language}</span>
            <span className="opacity-50">
              ({(detectedLanguage.confidence * 100).toFixed(0)}%)
            </span>
          </span>
        </>
      )}
      <span className="ml-auto truncate max-w-60 text-right" title={gpuShort || undefined}>
        {executionProvider}
        {gpuShort ? ` · ${gpuShort}` : ''}
      </span>
    </div>
  )
}

function TranscriptCard({
  transcript,
  rawTranscript,
  detectedLanguage,
  isProcessing,
  onRunSummary,
  onRunKeywords,
  onRunGenerateTags,
  onCopy,
}: {
  transcript: string
  rawTranscript: string
  detectedLanguage: DetectedLanguage | null
  isProcessing: boolean
  onRunSummary: () => void
  onRunKeywords: () => void
  onRunGenerateTags: () => void
  onCopy: (text: string) => void
}) {
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0
  const approxTokens = Math.ceil(rawTranscript.length / 4)

  return (
    <div className="border border-border animate-in slide-in-from-bottom-3 fade-in duration-400 rounded bg-sidebar">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
          Transcript
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            onClick={onRunSummary}
            title="Summarize"
            variant="ghost"
            size="icon-sm"
            disabled={isProcessing}
          >
            <SummarizeIcon className="size-5!" />
          </Button>
          <Button
            onClick={onRunKeywords}
            title="Extract Keywords"
            variant="ghost"
            size="icon-sm"
            disabled={isProcessing}
          >
            <AiKeywordsIcon className="size-5!" />
          </Button>
          <Button
            onClick={onRunGenerateTags}
            title="Generate Tags"
            variant="ghost"
            size="icon-sm"
            disabled={isProcessing}
          >
            <AiTagsIcon className="size-5!" />
          </Button>
          <Separator orientation="vertical" className="h-3 mx-1 opacity-30" />
          <Button
            onClick={() => onCopy(transcript)}
            title="Copy Transcript"
            variant="ghost"
            size="icon-sm"
          >
            <CopyIcon className="size-5!" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-64 min-h-0">
        <div className="px-4 py-4">
          <p
            dir={detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
            className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
          >
            {transcript}
          </p>
        </div>
      </ScrollArea>
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border/30">
        <span className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/35">
          {wordCount.toLocaleString()} words
        </span>
        <span className="text-border/30">·</span>
        <span className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/35">
          ~{approxTokens.toLocaleString()} tokens
        </span>
      </div>
    </div>
  )
}

function SummaryCard({
  summary,
  detectedLanguage,
  onCopy,
}: {
  summary: string
  detectedLanguage: DetectedLanguage | null
  onCopy: (text: string) => void
}) {
  return (
    <div className="border border-border/50 animate-in slide-in-from-bottom-3 fade-in duration-400">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
          Summary
        </span>
        <Button
          onClick={() => onCopy(summary)}
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
  )
}

function KeywordsTagsGrid({
  keywords,
  generatedTags,
}: {
  keywords: string[]
  generatedTags: string[]
}) {
  return (
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
            {generatedTags.sort((a, b) => a.localeCompare(b)).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="font-stashly rounded! text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function App() {
  const workerRef = useRef<Worker | null>(null)
  const [snapshot, setSnapshot] = useState<WorkerSnapshot>(initialWorkerSnapshot)
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl)
    }
  }, [fileObjectUrl])

  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/stash.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = (e: MessageEvent<WorkerSnapshot>) => setSnapshot(e.data)
    worker.onerror = (e) => console.error('Worker error:', e)
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const send = useCallback((event: object, transferables?: Transferable[]) => {
    workerRef.current?.postMessage(event, transferables ?? [])
  }, [])

  const { value: stateValue, context } = snapshot
  const isProcessing = !IDLE_STATES.includes(stateValue)

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileObjectUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    try {
      const ctx = new window.AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const audio = audioBuffer.getChannelData(0)
      // File objects are NOT cloneable across worker boundaries — send flat metadata instead
      send(
        {
          type: 'AUDIO_UPLOAD',
          audio,
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
        [audio.buffer] // transfer the ArrayBuffer zero-copy
      )
    } catch (err) {
      console.error('Audio processing error:', err)
    }
  }

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).catch((err) => console.error('Unable to copy', err))
  }

  // Machine derives text from its own context — no payload needed
  const runSummary = () => {
    if (!context.transcript) return
    send({ type: 'SUMMARIZE' })
  }

  const runKeywords = () => {
    if (!context.summary && !context.transcript) return
    send({ type: 'EXTRACT_KEYWORDS' })
  }

  const runGenerateTags = () => {
    send({ type: 'GENERATE_TAGS' })
  }

  const handleCancel = () => {
    send({ type: 'CANCEL' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-stashly">
      <AppHeader modelName={context.modelName} stateValue={stateValue} isProcessing={isProcessing} />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <UploadZone
            stateValue={stateValue}
            isProcessing={isProcessing}
            loadingPhases={context.loadingPhases}
            progress={context.progress}
            transcriptProgress={context.transcriptProgress as ChunkProgress | null}
            audioDuration={context.audioDuration}
            onUpload={handleAudioUpload}
          />
          {isProcessing && (
            <div className="flex justify-end">
              <Button
                onClick={handleCancel}
                variant="ghost"
                size="sm"
                className="text-[9px] font-bold tracking-[0.25em] uppercase text-muted-foreground/50 hover:text-destructive-foreground gap-1.5 h-7"
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {fileObjectUrl && context.fileInfo && (
          <div className="w-full rounded-lg overflow-hidden bg-black/5 border border-white/10">
            {context.fileInfo.type.startsWith('video/') ? (
              <video src={fileObjectUrl} controls className="w-full max-h-72 rounded-lg" />
            ) : (
              <audio src={fileObjectUrl} controls className="w-full" />
            )}
          </div>
        )}

        {context.fileInfo && (
          <MetadataStrip
            fileInfo={context.fileInfo}
            detectedLanguage={context.detectedLanguage}
            executionProvider={context.executionProvider}
            gpuShort={context.gpuInfo}
          />
        )}

        {context.transcript && (
          <TranscriptCard
            transcript={context.correctedTranscript}
            rawTranscript={context.transcript}
            detectedLanguage={context.detectedLanguage}
            isProcessing={isProcessing}
            onRunSummary={runSummary}
            onRunKeywords={runKeywords}
            onRunGenerateTags={runGenerateTags}
            onCopy={handleCopy}
          />
        )}

        {context.summary && (
          <SummaryCard
            summary={context.summary}
            detectedLanguage={context.detectedLanguage}
            onCopy={handleCopy}
          />
        )}

        {(context.keywords.length > 0 || context.generatedTags.length > 0) && (
          <KeywordsTagsGrid keywords={context.keywords} generatedTags={context.generatedTags} />
        )}
      </main>
    </div>
  )
}
