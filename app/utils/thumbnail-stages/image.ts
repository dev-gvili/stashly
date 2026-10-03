import { compute } from '@/utils/compute-worker'
import { classifyDegradation, reportDegraded } from '@/utils/report-degraded'
import type { ThumbnailProducer } from './types'

/**
 * Images: a tiny blur and a 512px resize in the compute worker, plus the one
 * stage-3 producer there is, a salient crop by the WebGPU model in
 * `thumbnail.ai.ts` (loaded on first use, it is large).
 */
export const imageProducer: ThumbnailProducer = {
  name: 'image',
  matches: (file) => file.type.startsWith('image/'),

  async preview(file) {
    const res = await compute({ kind: 'tinyImage', file })
    return res.kind === 'tinyImage' ? res.blob : null
  },

  async resize(file) {
    const res = await compute({ kind: 'resizeImage', file })
    return res.kind === 'resizeImage' && res.result
      ? { blob: res.result.blob, width: res.result.width, height: res.result.height }
      : null
  },

  async salientCrop(file) {
    const { generateSalientCrop } = await import('@/workers/thumbnail.ai')
    return generateSalientCrop(file).catch((e) => {
      console.error('[generateSalientCrop]', e)
      reportDegraded('thumbnail_stage3', classifyDegradation(e))
      return null
    })
  },
}
