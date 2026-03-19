import {
  AiTagsIcon,
  CopyIcon,
  LanguageIcon,
  MediaIcon,
  SummarizeIcon,
  LoaderIcon
} from '@/components/icons'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Progress } from '@/ui/progress'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import ibmPlexSansHebrewFonts from '@fontsource/ibm-plex-sans-hebrew/index.css?url'
import { useMachine } from '@xstate/react'
import { pipelineMachine } from '@/machines/stash/pipeline.machine'
import type { PipelineState } from '@/types/machine.types'

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

// Maps machine state to a display label
type DisplayStatus = 'idle' | 'loading' | 'detecting-language' | 'transcribing' | 'summarizing' | 'generating-tags' | 'ready' | 'error'

const STATUS_LABELS: Record<DisplayStatus, string> = {
  idle: 'STANDBY',
  loading: 'LOADING',
  ready: 'DONE',
  'detecting-language': 'DETECTING',
  transcribing: 'TRANSCRIBING',
  summarizing: 'SUMMARIZING',
  'generating-tags': 'TAGGING',
  error: 'ERROR',
}

function getDisplayStatus(stateValue: string, hasProgress: boolean): DisplayStatus {
  if (hasProgress && stateValue !== 'idle' && stateValue !== 'ready' && stateValue !== 'error') {
    return 'loading'
  }
  const map: Partial<Record<PipelineState, DisplayStatus>> = {
    detecting_language: 'detecting-language',
    transcribing: 'transcribing',
    ready: 'ready',
    summarizing: 'summarizing',
    generating_tags: 'generating-tags',
    error: 'error',
  }
  return map[stateValue as PipelineState] ?? 'idle'
}

export default function App() {
  const [state, send] = useMachine(pipelineMachine)
  const { context } = state
  const stateValue = state.value as string

  const isProcessing =
    stateValue === 'detecting_language' ||
    stateValue === 'transcribing' ||
    stateValue === 'summarizing' ||
    stateValue === 'generating_tags' ||
    context.progress !== null

  const displayStatus = getDisplayStatus(stateValue, context.progress !== null)
  const transcript = context.transcript
  const summary = context.summary
  const transcriptProgress = context.transcriptProgress as ChunkProgress | null
  const gpuShort = context.gpuInfo ? context.gpuInfo.split(/[\s,]/)[0] : null

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const ctx = new window.AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      send({
        type: 'AUDIO_UPLOAD',
        audio: audioBuffer.getChannelData(0),
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        file,
      })
    } catch (err) {
      console.error('Audio processing error:', err)
    }
  }

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .catch((err) => console.error('Unable to copy', err))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
            {context.modelName && (
              <span className="hidden sm:block text-muted-foreground/50 truncate max-w-36">
                {context.modelName}
              </span>
            )}
            <span className="hidden sm:block text-muted-foreground/50">
              {context.executionProvider}
              {gpuShort ? ` · ${gpuShort}` : ''}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {isProcessing && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    displayStatus === 'error'
                      ? 'bg-destructive-foreground'
                      : isProcessing
                        ? 'bg-primary'
                        : 'bg-muted-foreground/40'
                  }`}
                />
              </span>
              <span
                className={
                  displayStatus === 'error'
                    ? 'text-destructive-foreground'
                    : isProcessing
                      ? 'text-primary'
                      : 'text-muted-foreground/60'
                }
              >
                {STATUS_LABELS[displayStatus]}
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
                : displayStatus === 'error'
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-border/40 hover:border-primary/40 bg-transparent hover:bg-muted/5'
            }`}
          >
            {/* Idle / ready / error */}
            {!isProcessing && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200 pointer-events-none">
                <MediaIcon
                  className={`w-8 h-8 ${
                    displayStatus === 'error'
                      ? 'text-destructive-foreground/50'
                      : 'text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors duration-200'
                  }`}
                />
                <div className="text-center space-y-1.5">
                  <p
                    className={`text-[10px] font-bold tracking-[0.28em] uppercase ${
                      displayStatus === 'error'
                        ? 'text-destructive-foreground'
                        : 'text-foreground/60'
                    }`}
                  >
                    {displayStatus === 'error'
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
            {displayStatus === 'loading' && (
              <div className="flex flex-col items-center gap-5 animate-in fade-in duration-200 w-full max-w-xs">
                <div className="flex items-center gap-2.5">
                  <LoaderIcon className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-primary">
                    {context.loadingPhases.length > 0
                      ? context.loadingPhases[context.loadingPhases.length - 1]
                      : 'Loading Models'}
                  </span>
                </div>
                {context.progress &&
                  Object.entries(context.progress).map(([file, p]) => (
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
            {displayStatus === 'detecting-language' && (
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
            {displayStatus === 'transcribing' && (
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
                  ) : context.audioDuration > 0 ? (
                    <p className="text-[9px] tracking-wider text-muted-foreground/50">
                      {formatTime(context.audioDuration)} audio file
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {/* Post-processing states */}
            {(displayStatus === 'summarizing' ||
              displayStatus === 'generating-tags') && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
                {displayStatus === 'summarizing' && (
                  <SummarizeIcon className="w-8 h-8 text-primary animate-pulse" />
                )}
                {displayStatus === 'generating-tags' && (
                  <AiTagsIcon className="w-8 h-8 text-primary animate-pulse" />
                )}
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-primary">
                  {displayStatus === 'summarizing' ? 'Summarizing' : 'Generating Tags'}
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
        {context.fileInfo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase animate-in fade-in duration-300 pb-4 border-b border-border/20">
            <span className="normal-case text-muted-foreground/70 truncate max-w-56">
              {context.fileInfo.name}
            </span>
            <span className="text-border/40">·</span>
            <span>{context.fileInfo.size}</span>
            <span className="text-border/40">·</span>
            <span>{formatTime(context.fileInfo.duration)}</span>
            {context.detectedLanguage && (
              <>
                <span className="text-border/40">·</span>
                <span className="flex items-center gap-1">
                  <LanguageIcon className="w-3 h-3" />
                  <span className="capitalize">
                    {context.detectedLanguage.language}
                  </span>
                  <span className="opacity-50">
                    ({(context.detectedLanguage.confidence * 100).toFixed(0)}%)
                  </span>
                </span>
              </>
            )}
            <span className="ml-auto">
              {context.executionProvider}
              {gpuShort ? ` · ${gpuShort}` : ''}
            </span>
          </div>
        )}

        {/* Transcript */}
        {context.transcript && (
          <div className="border border-border animate-in slide-in-from-bottom-3 fade-in duration-400 rounded bg-sidebar">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
                Transcript
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  onClick={() => send({ type: 'SUMMARIZE', text: transcript })}
                  title="Summarize"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isProcessing}
                >
                  <SummarizeIcon className="size-5!" />
                </Button>
                <Button
                  onClick={() => send({ type: 'GENERATE_TAGS' })}
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
                  onClick={() => handleCopy(context.transcript)}
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
                  dir={context.detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
                  className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
                >
                  {context.transcript}
                </p>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Summary */}
        {context.summary && (
          <div className="border border-border/50 animate-in slide-in-from-bottom-3 fade-in duration-400">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                Summary
              </span>
              <Button
                onClick={() => handleCopy(context.summary)}
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
                dir={context.detectedLanguage?.language === 'he' ? 'rtl' : 'ltr'}
                className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap"
              >
                {context.summary}
              </p>
            </div>
          </div>
        )}

        {/* Keywords + Tags */}
        {(context.keywords.length > 0 || context.generatedTags.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-bottom-3 fade-in duration-400">
            {context.keywords.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                  Keywords
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {context.keywords.map((keyword, i) => (
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
            {context.generatedTags.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                  Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {context.generatedTags.map((tag, i) => (
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
