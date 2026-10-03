/**
 * The thumbnail stages, one producer per file type.
 *
 * Each type lives in its own file (`image.ts`, `pdf.ts`, `video.ts`,
 * `text.ts`); `producerFor` picks one, and the three stage functions below are
 * what the item machine's actors call. This replaced four `if (file.type …)`
 * ladders in `thumbnail-pipeline.ts`, which had to stay in step by hand.
 *
 * Browser-only at call time (compute worker, `<video>`, WebGPU), import-safe
 * anywhere.
 */
import { imageProducer } from './image'
import { pdfProducer } from './pdf'
import { videoProducer } from './video'
import { textProducer } from './text'
import type { ResizedThumbnail, ThumbnailProducer } from './types'

export type { ResizedThumbnail, ThumbnailProducer } from './types'
export { putThumbnailToS3, stageViewUrl } from './upload'

/**
 * In match order, the same order the old ladders checked. Text goes last: a
 * type-specific producer must win over the broad "renders as text" check.
 */
const PRODUCERS: readonly ThumbnailProducer[] = [
  imageProducer,
  pdfProducer,
  videoProducer,
  textProducer,
]

/**
 * The producer for a file, or null when no type here can thumbnail it.
 *
 * @example
 * producerFor(new File([], 'a.pdf', { type: 'application/pdf' }))?.name // → 'pdf'
 */
export function producerFor(file: File): ThumbnailProducer | null {
  return PRODUCERS.find((p) => p.matches(file)) ?? null
}

/**
 * Stage 1: a tiny blurred preview, painted from an object URL and never stored.
 *
 * @returns The blob, or null when the type has no preview (not an error).
 *
 * @example
 * const tiny = await generateStage1Preview(file)
 */
export async function generateStage1Preview(file: File): Promise<Blob | null> {
  return (await producerFor(file)?.preview(file)) ?? null
}

/**
 * Stage 2: the 512px thumbnail that is uploaded and saved.
 *
 * @param previewFrame - Stage 1's output; video resizes it as its frame.
 * @returns The thumbnail, or null when the type has none or it couldn't render.
 *
 * @example
 * const resized = await generateStage2Resize(file, tiny)
 */
export async function generateStage2Resize(
  file: File,
  previewFrame?: Blob | null
): Promise<ResizedThumbnail | null> {
  return (await producerFor(file)?.resize(file, previewFrame)) ?? null
}

/**
 * Stage 3: a salient square crop. Images only; null for every other type,
 * which is expected and not a degradation.
 *
 * @example
 * const crop = await generateStage3Salient(file)
 */
export async function generateStage3Salient(file: File): Promise<Blob | null> {
  const producer = producerFor(file)
  return (await producer?.salientCrop?.(file)) ?? null
}
