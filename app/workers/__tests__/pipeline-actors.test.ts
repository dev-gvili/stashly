import { describe, it, expect, vi } from 'vitest'
import { createActor, createMachine, waitFor } from 'xstate'
import { detectLanguageActor } from '../../machines/stash/pipeline.actors'

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
    expect((received[0] as any).type).toBe('WORKER.LANGUAGE_DETECTED')
    expect((received[0] as any).language).toBe('en')
    expect((received[0] as any).confidence).toBe(0.95)
  })
})
