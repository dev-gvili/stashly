import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, waitFor } from 'xstate'

// ── Realistic mock data ─────────────────────────────────────────────────────
const MOCK_TRANSCRIPT =
  'עומר, חיים, שלי, שתהיה לך שנה טובה ומתוקה. אני אוהב אותך, אני חולה עליך.'
const MOCK_CORRECTED =
  'עומר, חיים שלי, שתהיה לך שנה טובה ומתוקה. אני אוהב אותך, אני חולה עליך.'
const MOCK_SUMMARY =
  'הטקסט מבטא אהבה והערכה לעומר, עם ביטויים של חיבה והערצה.'
const MOCK_KEYWORDS = ['עומר', 'אהבה', 'כדורגל', 'שנה טובה', 'חברים']
const MOCK_TAGS = ['שנה טובה', 'עומר', 'אהבה', 'כדורגל', 'מונולוג', 'חם']

// ── Mock control ────────────────────────────────────────────────────────────
// Each mock can be configured per-test to resolve, reject, or delay
let mockBehaviors = {
  detectLanguage: () => Promise.resolve({ language: 'he', confidence: 0.92 }),
  transcribeAudio: () => Promise.resolve(MOCK_TRANSCRIPT),
  correctTranscript: () => Promise.resolve(MOCK_CORRECTED),
  summarizeText: () => Promise.resolve(MOCK_SUMMARY),
  extractKeywordsFromText: () => Promise.resolve(MOCK_KEYWORDS),
  generateTagsFromText: () => Promise.resolve(MOCK_TAGS),
}

vi.mock('@/workers/stash.ai', () => ({
  detectLanguage: vi.fn((...args: any[]) => mockBehaviors.detectLanguage()),
  transcribeAudio: vi.fn((params: any, onProgress: any, onPartial: any) => {
    // Simulate partial results like the real transcriber
    onPartial?.('transcription', { index: 0, text: MOCK_TRANSCRIPT })
    return mockBehaviors.transcribeAudio()
  }),
  correctTranscript: vi.fn((params: any, onProgress: any) =>
    mockBehaviors.correctTranscript()
  ),
  summarizeText: vi.fn((params: any, onProgress: any) =>
    mockBehaviors.summarizeText()
  ),
  extractKeywordsFromText: vi.fn((text: string, onProgress: any) =>
    mockBehaviors.extractKeywordsFromText()
  ),
  generateTagsFromText: vi.fn((params: any, onProgress: any) =>
    mockBehaviors.generateTagsFromText()
  ),
}))

import { pipelineMachine } from '../../machines/pipeline/pipeline.machine'

// ── Test helpers ────────────────────────────────────────────────────────────
const AUDIO_UPLOAD_EVENT = {
  type: 'AUDIO_UPLOAD' as const,
  audio: new Float32Array(16000).fill(0.1), // 1s of audio
  sampleRate: 16000,
  duration: 1,
  fileName: 'test-greeting.mp4',
  fileType: 'video/mp4',
  fileSize: 37_500_000,
}

function createPipeline() {
  const actor = createActor(pipelineMachine)
  actor.start()
  return actor
}

async function waitForState(actor: ReturnType<typeof createActor<typeof pipelineMachine>>, state: string, timeout = 5000) {
  return waitFor(actor, (s) => {
    const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value)
    return val === state
  }, { timeout })
}

// ── Reset mocks before each test ────────────────────────────────────────────
beforeEach(() => {
  mockBehaviors = {
    detectLanguage: () => Promise.resolve({ language: 'he', confidence: 0.92 }),
    transcribeAudio: () => Promise.resolve(MOCK_TRANSCRIPT),
    correctTranscript: () => Promise.resolve(MOCK_CORRECTED),
    summarizeText: () => Promise.resolve(MOCK_SUMMARY),
    extractKeywordsFromText: () => Promise.resolve(MOCK_KEYWORDS),
    generateTagsFromText: () => Promise.resolve(MOCK_TAGS),
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// FULL PIPELINE FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline: full flow (upload → ready)', () => {
  it('completes the entire pipeline: idle → detect → transcribe → cooldown → correct → ready', async () => {
    const actor = createPipeline()
    await waitForState(actor, 'idle')

    actor.send(AUDIO_UPLOAD_EVENT)

    // Should go through all states and reach ready
    await waitForState(actor, 'ready', 10000)

    const ctx = actor.getSnapshot().context
    expect(ctx.detectedLanguage?.language).toBe('he')
    expect(ctx.transcript).toBe(MOCK_TRANSCRIPT)
    expect(ctx.correctedTranscript).toBe(MOCK_CORRECTED)
    actor.stop()
  })

  it('populates fileInfo correctly', async () => {
    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    const { fileInfo } = actor.getSnapshot().context
    expect(fileInfo?.name).toBe('test-greeting.mp4')
    expect(fileInfo?.type).toBe('video/mp4')
    expect(fileInfo?.duration).toBe(1)
    actor.stop()
  })

  it('passes through gpu_cooldown state between transcription and correction', async () => {
    const statesVisited: string[] = []
    const actor = createPipeline()

    actor.subscribe((s) => {
      const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value)
      if (!statesVisited.includes(val)) statesVisited.push(val)
    })

    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    expect(statesVisited).toContain('gpu_cooldown')
    // Verify order: gpu_cooldown comes after transcribing, before correcting_text
    const cooldownIdx = statesVisited.indexOf('gpu_cooldown')
    const transcribeIdx = statesVisited.indexOf('transcribing')
    const correctIdx = statesVisited.indexOf('correcting_text')
    expect(cooldownIdx).toBeGreaterThan(transcribeIdx)
    expect(correctIdx).toBeGreaterThan(cooldownIdx)
    actor.stop()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST-READY OPERATIONS (summarize, tags, keywords from ready state)
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline: post-ready operations', () => {
  async function getReadyActor() {
    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)
    return actor
  }

  it('SUMMARIZE from ready → summarizing → ready with summary', async () => {
    const actor = await getReadyActor()
    actor.send({ type: 'SUMMARIZE' })
    await waitForState(actor, 'ready', 5000)

    expect(actor.getSnapshot().context.summary).toBe(MOCK_SUMMARY)
    actor.stop()
  })

  it('GENERATE_TAGS from ready → generating_tags → ready with tags', async () => {
    const actor = await getReadyActor()
    actor.send({ type: 'GENERATE_TAGS' })
    await waitForState(actor, 'ready', 5000)

    expect(actor.getSnapshot().context.generatedTags).toEqual(MOCK_TAGS)
    actor.stop()
  })

  it('EXTRACT_KEYWORDS from ready → extracting_keywords → ready', async () => {
    const actor = await getReadyActor()
    actor.send({ type: 'EXTRACT_KEYWORDS' })
    await waitForState(actor, 'ready', 5000)

    expect(actor.getSnapshot().context.keywords).toEqual(MOCK_KEYWORDS)
    actor.stop()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING AND GPU CRASH RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline: error handling', () => {
  it('transitions to error state on transcription failure', async () => {
    mockBehaviors.transcribeAudio = () =>
      Promise.reject(new Error('Whisper model failed to load'))

    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'error', 5000)

    expect(actor.getSnapshot().context.error).toContain('Whisper model failed')
    actor.stop()
  })

  it('correction failure falls back to original transcript', async () => {
    // correctTranscript now handles fallback internally and returns
    // the original text if all retries fail via the actor's catch handler
    mockBehaviors.correctTranscript = () =>
      Promise.reject(new Error('Device is lost'))

    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    // Actor catch handler sends original text as correctedTranscript
    expect(actor.getSnapshot().context.correctedTranscript).toBe(MOCK_TRANSCRIPT)
    actor.stop()
  })

  it('recovers from error state with new AUDIO_UPLOAD', async () => {
    mockBehaviors.transcribeAudio = () =>
      Promise.reject(new Error('Network error'))

    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'error', 5000)

    // Now fix the mock and upload again
    mockBehaviors.transcribeAudio = () => Promise.resolve(MOCK_TRANSCRIPT)
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    expect(actor.getSnapshot().context.transcript).toBe(MOCK_TRANSCRIPT)
    actor.stop()
  })

  it('CANCEL during any active state returns to idle', async () => {
    // Make transcription hang forever
    mockBehaviors.transcribeAudio = () => new Promise(() => {})

    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'transcribing', 5000)

    actor.send({ type: 'CANCEL' })
    await waitForState(actor, 'idle', 2000)
    actor.stop()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// REPEATED RUNS (stability / stress)
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline: repeated runs', () => {
  it('can process multiple uploads sequentially without getting stuck', async () => {
    const actor = createPipeline()

    for (let run = 1; run <= 3; run++) {
      await waitForState(actor, run === 1 ? 'idle' : 'ready', 5000)

      actor.send({
        ...AUDIO_UPLOAD_EVENT,
        fileName: `test-${run}.mp4`,
      })
      await waitForState(actor, 'ready', 10000)

      const ctx = actor.getSnapshot().context
      expect(ctx.fileInfo?.name).toBe(`test-${run}.mp4`)
      expect(ctx.transcript).toBe(MOCK_TRANSCRIPT)
      expect(ctx.correctedTranscript).toBe(MOCK_CORRECTED)
    }

    actor.stop()
  })

  it('can run summarize → tags → keywords in sequence from ready', async () => {
    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    // Summarize
    actor.send({ type: 'SUMMARIZE' })
    await waitForState(actor, 'ready', 5000)
    expect(actor.getSnapshot().context.summary).toBe(MOCK_SUMMARY)

    // Tags
    actor.send({ type: 'GENERATE_TAGS' })
    await waitForState(actor, 'ready', 5000)
    expect(actor.getSnapshot().context.generatedTags).toEqual(MOCK_TAGS)

    // Keywords
    actor.send({ type: 'EXTRACT_KEYWORDS' })
    await waitForState(actor, 'ready', 5000)
    expect(actor.getSnapshot().context.keywords).toEqual(MOCK_KEYWORDS)

    actor.stop()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE-SPECIFIC BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline: multilingual support', () => {
  it.each([
    ['he', 0.92, 'Hebrew'],
    ['en', 0.98, 'English'],
    ['ar', 0.85, 'Arabic'],
    ['fr', 0.90, 'French'],
    ['ja', 0.88, 'Japanese'],
  ])('detects %s (confidence: %f) and passes it through pipeline', async (lang, confidence) => {
    mockBehaviors.detectLanguage = () =>
      Promise.resolve({ language: lang, confidence })

    const actor = createPipeline()
    await waitForState(actor, 'idle')
    actor.send(AUDIO_UPLOAD_EVENT)
    await waitForState(actor, 'ready', 10000)

    expect(actor.getSnapshot().context.detectedLanguage?.language).toBe(lang)
    expect(actor.getSnapshot().context.detectedLanguage?.confidence).toBe(confidence)
    actor.stop()
  })
})
