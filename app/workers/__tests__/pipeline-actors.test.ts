import { describe, it, expect, vi } from 'vitest'
import { createActor, createMachine, waitFor } from 'xstate'
import { detectLanguageActor } from '../../machines/pipeline/pipeline.actors'
import { pipelineMachine } from '../../machines/pipeline/pipeline.machine'

// Mock stash.ai so no real models load
vi.mock('@/workers/stash.ai', () => ({
  detectLanguage: vi.fn().mockResolvedValue({ language: 'en', confidence: 0.95 }),
  transcribeAudio: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
  summarizeText: vi.fn().mockReturnValue(new Promise(() => {})),
  extractKeywordsFromText: vi.fn().mockReturnValue(new Promise(() => {})),
  generateTagsFromText: vi.fn().mockReturnValue(new Promise(() => {})),
}))

describe('detectLanguageActor', () => {
  it('sends WORKER.LANGUAGE_DETECTED to parent machine when language is detected', async () => {
    // Wrap the actor in a parent machine so sendBack works
    const received: unknown[] = []
    const parentMachine = createMachine({
      initial: 'detecting',
      states: {
        detecting: {
          invoke: {
            id: 'lid',
            src: detectLanguageActor,
            input: { audio: new Float32Array([0.1]), sampleRate: 16000, duration: 0.1 },
          },
          on: {
            'WORKER.LANGUAGE_DETECTED': {
              target: 'done',
              actions: ({ event }) => received.push(event),
            },
          },
        },
        done: { type: 'final' },
      },
    })

    const actor = createActor(parentMachine)
    actor.start()
    await waitFor(actor, (s) => s.matches('done'), { timeout: 2000 })

    expect(received).toHaveLength(1)
    // eslint-disable-next-line no-restricted-syntax -- reads fields off a loosely typed received event
    expect((received[0] as any).type).toBe('WORKER.LANGUAGE_DETECTED')
    // eslint-disable-next-line no-restricted-syntax -- reads fields off a loosely typed received event
    expect((received[0] as any).language).toBe('en')
    // eslint-disable-next-line no-restricted-syntax -- reads fields off a loosely typed received event
    expect((received[0] as any).confidence).toBe(0.95)
  })
})

// Ensure transcribeAudio returns a never-resolving Promise so 'transcribing' state is stable

describe('pipelineMachine', () => {
  it('starts in checking_hardware', () => {
    const actor = createActor(pipelineMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('checking_hardware')
    actor.stop()
  })

  it('transitions to idle after hardware detection completes', async () => {
    const actor = createActor(pipelineMachine)
    actor.start()
    await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })
    actor.stop()
  })

  it('transitions idle → detecting_language on AUDIO_UPLOAD', async () => {
    const actor = createActor(pipelineMachine)
    actor.start()
    await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

    actor.send({
      type: 'AUDIO_UPLOAD',
      audio: new Float32Array([0.1]),
      sampleRate: 16000,
      duration: 0.1,
      fileName: 'test.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024,
    })
    await waitFor(actor, (s) => s.matches('detecting_language'), { timeout: 500 })
    expect(actor.getSnapshot().context.fileInfo?.name).toBe('test.mp3')
    actor.stop()
  })

  it('transitions detecting_language → transcribing on WORKER.LANGUAGE_DETECTED', async () => {
    // detectLanguage mock resolves to { language: 'en', confidence: 0.95 }
    const actor = createActor(pipelineMachine)
    actor.start()
    await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

    actor.send({
      type: 'AUDIO_UPLOAD',
      audio: new Float32Array([0.1]),
      sampleRate: 16000,
      duration: 0.1,
      fileName: 'test.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024,
    })
    await waitFor(actor, (s) => s.matches('transcribing'), { timeout: 2000 })
    expect(actor.getSnapshot().context.detectedLanguage?.language).toBe('en')
    actor.stop()
  })

  it('CANCEL from transcribing returns to idle', async () => {
    const actor = createActor(pipelineMachine)
    actor.start()
    await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

    actor.send({
      type: 'AUDIO_UPLOAD',
      audio: new Float32Array([0.1]),
      sampleRate: 16000,
      duration: 0.1,
      fileName: 'test.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024,
    })
    await waitFor(actor, (s) => s.matches('transcribing'), { timeout: 2000 })
    actor.send({ type: 'CANCEL' })
    await waitFor(actor, (s) => s.matches('idle'), { timeout: 1000 })
    actor.stop()
  })
})
