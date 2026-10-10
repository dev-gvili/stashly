import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from '@/services/vinktar'
import { flush } from '@vinktarhq/node'

/**
 * Vitest loads `.env`, which carries a real `VINKTAR_KEY` locally, and every
 * `createUploadedItem` test calls `track('file_uploaded')`. The setup module
 * switches the SDK off under `NODE_ENV=test`, so nothing reaches Vinktar.
 */
describe('vinktar under Vitest', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends nothing, even with events tracked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    track('file_uploaded', { size_bytes: 1 }, { userId: 'usr_test' })
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
