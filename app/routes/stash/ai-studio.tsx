import { useEffect, useState } from 'react'

type Phase =
  | 'idle'
  | 'loading'
  | 'detecting_language'
  | 'transcribing'
  | 'correcting_text'
  | 'summarizing'
  | 'extracting_keywords'
  | 'generating_tags'
  | 'ready'

const PHASES = [
  { id: 'idle', label: 'STANDBY', hint: 'Waiting for upload' },
  { id: 'loading', label: 'LOADING', hint: 'Fetching model weights' },
  { id: 'detecting_language', label: 'DETECTING', hint: 'Analyzing audio fingerprint' },
  { id: 'transcribing', label: 'TRANSCRIBING', hint: 'Whisper · large-v3-turbo' },
  { id: 'correcting_text', label: 'VERIFYING', hint: 'Tiny-Aya correction pass' },
  { id: 'summarizing', label: 'SUMMARIZING', hint: 'Tiny-Aya · 1500-char chunks' },
  { id: 'extracting_keywords', label: 'KEYWORDS', hint: 'MiniLM · semantic top-10' },
  { id: 'generating_tags', label: 'TAGGING', hint: 'Tiny-Aya · 7-10 tags' },
  { id: 'ready', label: 'DONE', hint: 'All artifacts ready' },
] as const

type Variant = 'studio' | 'lab' | 'console'

const VARIANTS = [
  { id: 'studio', label: 'Studio' },
  { id: 'lab', label: 'Lab' },
  { id: 'console', label: 'Console' },
] as const

const FILE_INFO = {
  name: 'Building a Production-Ready File Hosting App [5].wav',
  type: 'audio/wav',
  size: '20.0 MB',
  duration: 7 * 60 + 15,
  language: 'en',
  langConfidence: 0.94,
}

const TRANSCRIPT = `So the trick we landed on for the worker is to keep the audio buffer transferable — Float32Array goes across the postMessage boundary zero-copy, which means a 20 MB clip never duplicates. Once it's on the worker, we run Whisper-large-v3-turbo with stride length 5 over 30-second windows, and we keep partial results streaming so the UI can render them as they arrive instead of waiting for the whole file.

The interesting part is the second pass — we re-feed the raw transcript to tiny-aya-global with a correction prompt scoped to the detected language. It catches misheard names and proper nouns the acoustic model gets wrong. After that we run summarization, keyword extraction with MiniLM, and tag generation — all on the same WebGPU device, sequentially, because they share the same buffer pool.`

const SUMMARY = `A walkthrough of the local-AI pipeline used in a file hosting app: zero-copy audio handoff to a worker, Whisper transcription, an LLM correction pass, and downstream summarization / keywords / tagging — all running on-device via WebGPU.`

const KEYWORDS = [
  'Whisper',
  'WebGPU',
  'transcription',
  'tiny-aya',
  'pipeline',
  'Float32Array',
  'streaming',
  'MiniLM',
  'tagging',
  'on-device',
]

const TAGS = [
  'local AI',
  'audio pipeline',
  'WebGPU',
  'transcription',
  'engineering walk-thru',
  'file hosting',
  'monologue',
  'technical',
]

const MODEL_FILES = [
  { name: 'whisper-large-v3-turbo · encoder.onnx', progress: 100 },
  { name: 'whisper-large-v3-turbo · decoder.onnx', progress: 100 },
  { name: 'mms-lid-126.onnx', progress: 100 },
  { name: 'tiny-aya-global · embed_tokens.onnx', progress: 78 },
  { name: 'tiny-aya-global · decoder_q4f16.onnx', progress: 42 },
]

function Icon({ name, className }: { name: 'search' | 'x'; className?: string }) {
  return name === 'search' ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m21 21-4.5-4.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  )
}

function Corners({ active = true }: { active?: boolean }) {
  const cls = active ? 'border-[var(--acc-fg)]' : 'border-[var(--mut)] opacity-40'
  return (
    <>
      <i className={`absolute -top-px -left-px w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-[3px] ${cls}`} />
      <i className={`absolute -top-px -right-px w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-[3px] ${cls}`} />
      <i className={`absolute -bottom-px -left-px w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-[3px] ${cls}`} />
      <i className={`absolute -bottom-px -right-px w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-[3px] ${cls}`} />
    </>
  )
}

function fmtTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 60 }, (_, i) => i)
  return (
    <div className="flex items-center gap-[2px] h-12 w-56">
      {bars.map((i) => {
        const height = active ? 4 + Math.abs(Math.sin((i + Date.now() / 300) * 0.7)) * 36 : 4
        return (
          <span
            key={i}
            className="w-[3px] rounded-sm bg-[var(--acc-fg)]"
            style={{
              height: `${height}px`,
              opacity: active ? 0.4 + (Math.sin(i * 0.5) * 0.5 + 0.5) * 0.6 : 0.2,
            }}
          />
        )
      })}
    </div>
  )
}

function PipelineRail({ phase }: { phase: Phase }) {
  const flow = ['detecting_language', 'transcribing', 'correcting_text', 'summarizing', 'extracting_keywords', 'generating_tags'] as const
  const idx = flow.indexOf(phase as any)

  return (
    <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em]">
      {flow.map((id, i) => {
        const done = idx > i || phase === 'ready'
        const current = idx === i
        const phaseDetails = PHASES.find((item) => item.id === id)
        const cls = current
          ? 'bg-[var(--acc)] text-[var(--acc-fg)] border-[var(--acc-border)]'
          : done
          ? 'border-[var(--border)] text-[var(--fg)]'
          : 'border-[var(--border)] text-[var(--mut)] opacity-50'
        return (
          <span key={id} className={`px-1.5 py-0.5 border rounded-[2px] ${cls}`}>
            {phaseDetails?.label}
          </span>
        )
      })}
    </div>
  )
}

function Dropzone({
  phase,
  onUpload,
  onCancel,
}: {
  phase: Phase
  onUpload: () => void
  onCancel: () => void
}) {
  const isProcessing = phase !== 'idle' && phase !== 'ready'

  return (
    <div className="relative">
      <Corners active={isProcessing} />
      <div
        className={`relative h-60 border ${
          isProcessing ? 'border-[var(--acc-border)]' : 'border-dashed border-[var(--border)]'
        } rounded-md flex items-center justify-center bg-[var(--card)] overflow-hidden transition-colors`}
      >
        {phase === 'idle' && <DZIdle />}
        {phase === 'loading' && <DZLoading />}
        {phase === 'detecting_language' && <DZGeneric icon="search" title="DETECTING LANGUAGE" sub="Analyzing audio fingerprint" />}
        {phase === 'transcribing' && <DZTranscribing />}
        {phase === 'correcting_text' && <DZGeneric icon="x" title="VERIFYING TRANSCRIPT" sub="Tiny-Aya correction pass" />}
        {phase === 'summarizing' && <DZGeneric icon="search" title="SUMMARIZING" sub="Greedy decode · 1500-char chunks" />}
        {phase === 'extracting_keywords' && <DZGeneric icon="search" title="EXTRACTING KEYWORDS" sub="MiniLM cosine ranking" />}
        {phase === 'generating_tags' && <DZGeneric icon="search" title="GENERATING TAGS" sub="Tiny-Aya · 7-10 tags" />}
        {phase === 'ready' && <DZReady />}

        <input
          type="file"
          accept="audio/*,video/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onChange={onUpload}
          disabled={isProcessing}
        />
      </div>
      {isProcessing && phase !== 'ready' && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)] hover:text-[oklch(0.7_0.18_25)] inline-flex items-center gap-1.5 z-10"
          >
            <Icon name="x" className="w-3 h-3" />
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function DZIdle() {
  return (
    <div className="flex flex-col items-center gap-3 pointer-events-none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-10 h-10 text-[var(--mut)]">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m21 15-5-5-7 7-4-3-2 2" />
      </svg>
      <div className="text-center space-y-1">
        <div className="text-[11px] tracking-[0.3em] uppercase">Drop audio or video</div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--mut)]">Runs entirely on your device · WebGPU</div>
      </div>
    </div>
  )
}

function DZLoading() {
  return (
    <div className="w-full max-w-sm space-y-3 px-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--acc-fg)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--acc-fg)] animate-pulse" />
        Loading models
      </div>
      {MODEL_FILES.map((file) => (
        <div key={file.name}>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-[var(--mut)] truncate">{file.name}</span>
            <span className="tabular-nums">{file.progress}%</span>
          </div>
          <div className="h-px bg-[var(--bg)] relative overflow-hidden">
            <div className="h-full bg-[var(--acc-fg)] transition-all" style={{ width: `${file.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DZTranscribing() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Waveform active />
      <div className="text-center space-y-1">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--acc-fg)]">Transcribing</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">7 / 14 chunks · 3:42 processed</div>
      </div>
    </div>
  )
}

function DZGeneric({ title, sub, icon }: { title: string; sub: string; icon: 'search' | 'x' }) {
  return (
    <div className="flex flex-col items-center gap-3 text-[var(--acc-fg)]">
      <div className="animate-pulse">
        <Icon name={icon} className="w-7 h-7" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-[11px] uppercase tracking-[0.3em]">{title}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">{sub}</div>
      </div>
    </div>
  )
}

function DZReady() {
  return (
    <div className="flex flex-col items-center gap-3 text-[var(--fg)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-10 h-10 text-[var(--acc-fg)]">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 6-7" />
      </svg>
      <div className="text-center space-y-1">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--acc-fg)]">Pipeline complete</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">Drop another file to continue</div>
      </div>
    </div>
  )
}

function MetaStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tracking-[0.15em] uppercase text-[var(--mut)] py-2 border-b border-dashed border-[var(--border)]">
      <span className="text-[var(--fg)] truncate max-w-[40ch] normal-case">{FILE_INFO.name}</span>
      <span className="opacity-40">·</span>
      <span>{FILE_INFO.size}</span>
      <span className="opacity-40">·</span>
      <span>{fmtTime(FILE_INFO.duration)}</span>
      <span className="opacity-40">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="search" className="w-3 h-3" /> ENGLISH ({Math.round(FILE_INFO.langConfidence * 100)}%)
      </span>
      <span className="ml-auto">WEBGPU · NVIDIA RTX</span>
    </div>
  )
}

function TranscriptCard({ phase }: { phase: Phase }) {
  const wordCount = TRANSCRIPT.trim().split(/\s+/).length
  const tokens = Math.ceil(TRANSCRIPT.length / 4)
  return (
    <div className="border border-[var(--border)] rounded-md bg-[var(--card)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <div className="text-[10px] uppercase tracking-[0.3em]">Transcript</div>
        <div className="flex items-center gap-1">
          <ToolBtn label="Summarize" disabled={phase !== 'ready'} />
          <ToolBtn label="Keywords" disabled={phase !== 'ready'} />
          <ToolBtn label="Tags" disabled={phase !== 'ready'} />
          <span className="w-px h-3 bg-[var(--border)] mx-1" />
          <ToolBtn label="Copy" />
        </div>
      </div>
      <div className="px-4 py-4 max-h-64 overflow-auto">
        <p className="text-[12px] leading-relaxed text-[var(--fg)] opacity-90 whitespace-pre-wrap">{TRANSCRIPT}</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-1.5 border-t border-dashed border-[var(--border)] text-[10px] tracking-[0.18em] uppercase text-[var(--mut)]">
        <span>{wordCount.toLocaleString()} words</span>
        <span className="opacity-40">·</span>
        <span>~{tokens.toLocaleString()} tokens</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[var(--acc-fg)]" />verified pass
        </span>
      </div>
    </div>
  )
}

function ToolBtn({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm hover:bg-[var(--bg)] text-[var(--mut)] hover:text-[var(--fg)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  )
}

function SummaryCard() {
  return (
    <div className="border border-[var(--border)] rounded-md bg-[var(--card)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <div className="text-[10px] uppercase tracking-[0.3em]">Summary</div>
        <ToolBtn label="Copy" />
      </div>
      <div className="px-4 py-4 text-[12px] leading-relaxed text-[var(--fg)] opacity-90">{SUMMARY}</div>
    </div>
  )
}

function ChipsCard({ title, items, variant = 'outline' }: { title: string; items: string[]; variant?: 'outline' | 'solid' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] mb-2 text-[var(--mut)]">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={
              variant === 'solid'
                ? 'px-2 py-0.5 rounded-[2px] bg-[var(--acc)] text-[var(--acc-fg)] text-[11px] border border-[var(--acc-border)]'
                : 'px-2 py-0.5 rounded-[2px] border border-[var(--border)] text-[var(--mut)] text-[11px] hover:text-[var(--fg)] hover:border-[var(--ring)] cursor-pointer'
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function VarStudio({ phase, onUpload, onCancel }: { phase: Phase; onUpload: () => void; onCancel: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px]">AI Studio</h1>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">/ local · webgpu · streaming</span>
        </div>
        <PipelineRail phase={phase} />
      </div>
      <Dropzone phase={phase} onUpload={onUpload} onCancel={onCancel} />
      {phase === 'ready' && (
        <>
          <MetaStrip />
          <TranscriptCard phase={phase} />
          <SummaryCard />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <ChipsCard title="Keywords" items={KEYWORDS} />
            <ChipsCard title="Tags" items={TAGS} variant="solid" />
          </div>
        </>
      )}
    </div>
  )
}

function VarLab({ phase, onUpload, onCancel }: { phase: Phase; onUpload: () => void; onCancel: () => void }) {
  const pipeline = [
    { id: 'loading', label: 'Load weights', status: 'mms-lid · whisper · tiny-aya' },
    { id: 'detecting_language', label: 'Detect language', status: 'Xenova/mms-lid-126 · q4' },
    { id: 'transcribing', label: 'Transcribe audio', status: 'whisper-large-v3-turbo · fp16' },
    { id: 'correcting_text', label: 'Correct transcript', status: 'tiny-aya-global · q4' },
    { id: 'summarizing', label: 'Summarize', status: 'tiny-aya-global · greedy' },
    { id: 'extracting_keywords', label: 'Extract keywords', status: 'paraphrase-MiniLM' },
    { id: 'generating_tags', label: 'Generate tags', status: 'tiny-aya-global · 7-10' },
  ]
  const idx = pipeline.findIndex((item) => item.id === phase)

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-12 gap-5">
      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px]">Lab</h1>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">/ pipeline</span>
        </div>
        <Dropzone phase={phase} onUpload={onUpload} onCancel={onCancel} />
        <div className="border border-[var(--border)] rounded-md bg-[var(--card)] p-3">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-2 text-[var(--mut)]">Pipeline</div>
          <ol className="space-y-px">
            {pipeline.map((step, index) => {
              const done = idx > index || phase === 'ready'
              const current = idx === index
              return (
                <li
                  key={step.id}
                  className={`grid grid-cols-[16px_1fr_auto] items-center gap-2 px-1.5 py-1.5 rounded-sm ${
                    current
                      ? 'bg-[var(--acc)] text-[var(--acc-fg)]'
                      : done
                      ? 'border border-[var(--border)] text-[var(--fg)]'
                      : 'hover:bg-[var(--bg)]/50 text-[var(--mut)]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-[2px] ${done ? 'bg-[var(--acc-fg)]' : current ? 'border border-[var(--acc-fg)] animate-pulse' : 'border border-[var(--border)]'}`} />
                  <div className="min-w-0">
                    <div className="text-[11px]">{step.label}</div>
                    <div className="text-[9px] text-[var(--mut)] truncate uppercase tracking-[0.15em]">{step.status}</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--mut)]">{done ? '✓' : current ? '··' : ''}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="border border-[var(--border)] rounded-md bg-[var(--card)] p-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mut)] mb-2">Device</div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]">
            <span className="text-[var(--mut)] uppercase tracking-[0.2em]">Backend</span>
            <span>WebGPU</span>
            <span className="text-[var(--mut)] uppercase tracking-[0.2em]">Adapter</span>
            <span>NVIDIA RTX</span>
            <span className="text-[var(--mut)] uppercase tracking-[0.2em]">Buffer cap</span>
            <span>4 GiB</span>
            <span className="text-[var(--mut)] uppercase tracking-[0.2em]">Fallback</span>
            <span>WASM · q4</span>
          </div>
        </div>
      </aside>
      <section className="col-span-12 lg:col-span-8 space-y-4">
        {phase === 'ready' ? (
          <>
            <MetaStrip />
            <TranscriptCard phase={phase} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SummaryCard />
              <div className="space-y-4">
                <ChipsCard title="Keywords" items={KEYWORDS} />
                <ChipsCard title="Tags" items={TAGS} variant="solid" />
              </div>
            </div>
          </>
        ) : (
          <div className="border border-dashed border-[var(--border)] rounded-md bg-[var(--card)] h-full min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-2 text-[var(--mut)]">
              <div className="text-[10px] uppercase tracking-[0.3em]">Output panel</div>
              <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">Artifacts will materialize here as the pipeline runs</div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function VarConsole({ phase, onUpload, onCancel }: { phase: Phase; onUpload: () => void; onCancel: () => void }) {
  const lines = [
    { t: '00:00.012', msg: 'env.useBrowserCache = true', mut: true },
    { t: '00:00.018', msg: 'WebGPUDeviceManager · discoverAdapters()', mut: true },
    { t: '00:00.041', msg: 'adapter[0] = "NVIDIA RTX" · maxBufferSize=4294967296' },
    { t: '00:00.052', msg: 'pipeline("audio-classification","Xenova/mms-lid-126") · q4' },
    { t: '00:01.244', msg: 'detectLanguage → en (0.94)', acc: true },
    { t: '00:01.301', msg: 'pipeline("automatic-speech-recognition","whisper-large-v3-turbo") · fp16' },
    { t: '00:02.118', msg: 'transcribe · 14 chunks · stride=5s · batch=16' },
    { t: '00:46.512', msg: 'normalizeTranscript() · 1124 words', acc: true },
    { t: '00:46.601', msg: 'correctTranscript() · 2 chunks · tiny-aya-global', mut: true },
    { t: '01:02.331', msg: 'summarizeText() · greedy decode' },
    { t: '01:09.880', msg: 'extractKeywordsFromText() · 256 candidates → top 10' },
    { t: '01:11.402', msg: 'generateTagsFromText() · parseTags() · 8 tags', acc: true },
    { t: '01:11.418', msg: 'pipeline complete · 2.21s GPU idle', acc: true },
  ]

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[18px]">Console</h1>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--mut)]">/ terminal log</span>
      </div>
      <Dropzone phase={phase} onUpload={onUpload} onCancel={onCancel} />
      <div className="border border-[var(--border)] rounded-md bg-[var(--card)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.3em]">Pipeline log</div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[oklch(0.7_0.18_25)]" />
            <span className="w-2 h-2 rounded-full bg-[oklch(0.85_0.15_85)]" />
            <span className="w-2 h-2 rounded-full bg-[oklch(0.7_0.16_160)]" />
          </div>
        </div>
        <pre className="px-3 py-2 text-[10.5px] leading-relaxed font-stashly overflow-auto max-h-[420px]">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[64px_1fr] gap-2">
              <span className="text-[var(--mut)]">{line.t}</span>
              <span className={line.acc ? 'text-[var(--acc-fg)]' : line.mut ? 'text-[var(--mut)]' : ''}>{line.msg}</span>
            </div>
          ))}
          {phase !== 'ready' && (
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <span className="text-[var(--mut)]">··:··.···</span>
              <span className="text-[var(--acc-fg)] animate-pulse">▌</span>
            </div>
          )}
        </pre>
      </div>
    </div>
  )
}

export default function AiStudioRoute() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [variant, setVariant] = useState<Variant>('studio')

  useEffect(() => {
    setPhase('ready')
  }, [])

  const Comp = variant === 'lab' ? VarLab : variant === 'console' ? VarConsole : VarStudio

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap gap-2">
          {VARIANTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setVariant(option.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
                variant === option.id
                  ? 'bg-[var(--acc)] text-[var(--acc-fg)]'
                  : 'bg-[var(--background)] text-[var(--mut)] hover:bg-[var(--bg)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <Comp phase={phase} onUpload={() => setPhase('loading')} onCancel={() => setPhase('idle')} />
    </div>
  )
}
