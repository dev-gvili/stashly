import { compute } from '@/utils/compute-worker'
import { dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail } from '@/utils/video'
import type { ThumbnailProducer } from './types'

/**
 * Videos: stage 1 grabs a frame on the main thread (a `<video>` element can't
 * run in a worker), and stage 2 resizes that frame as an image. That is why
 * stage 1 always runs before stage 2: without the frame there is no resize.
 */
export const videoProducer: ThumbnailProducer = {
  name: 'video',
  matches: (file) => file.type.startsWith('video/'),

  async preview(file) {
    const dataUrl = await generateVideoThumbnail(file).catch(() => null)
    return dataUrl ? dataUrlToBlob(dataUrl) : null
  },

  async resize(_file, previewFrame) {
    if (!previewFrame) return null
    const frameFile = new File([previewFrame], 'frame.webp', { type: 'image/webp' })
    const res = await compute({ kind: 'resizeImage', file: frameFile })
    return res.kind === 'resizeImage' && res.result
      ? { blob: res.result.blob, width: res.result.width, height: res.result.height }
      : null
  },
}
