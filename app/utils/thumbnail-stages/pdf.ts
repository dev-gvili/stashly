import { compute } from '@/utils/compute-worker'
import type { ThumbnailProducer } from './types'

/** PDFs: the first page, rendered by PDF.js in the compute worker. */
export const pdfProducer: ThumbnailProducer = {
  name: 'pdf',
  matches: (file) => file.type === 'application/pdf',

  async preview(file) {
    const res = await compute({ kind: 'tinyPdf', file })
    return res.kind === 'tinyPdf' ? res.blob : null
  },

  async resize(file) {
    const res = await compute({ kind: 'resizePdf', file })
    return res.kind === 'resizePdf' && res.result
      ? { blob: res.result.blob, width: res.result.width, height: res.result.height }
      : null
  },
}
