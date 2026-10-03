import { compute } from '@/utils/compute-worker'
import { isTextRenderableFile } from '@/utils/text-files'
import type { ThumbnailProducer } from './types'

/** Text, code and markdown: the first lines rendered as a page in the compute worker. */
export const textProducer: ThumbnailProducer = {
  name: 'text',
  matches: (file) => isTextRenderableFile(file),

  async preview(file) {
    const res = await compute({ kind: 'tinyText', file })
    return res.kind === 'tinyText' ? res.blob : null
  },

  async resize(file) {
    const res = await compute({ kind: 'resizeText', file })
    return res.kind === 'resizeText' && res.result
      ? { blob: res.result.blob, width: res.result.width, height: res.result.height }
      : null
  },
}
