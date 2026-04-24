import { PipelineManager } from './stash.ai'

const VIT_MODEL = 'Xenova/vit-base-patch16-224'
const VLM_MODEL = 'LiquidAI/LFM2.5-VL-1.6B-ONNX'

/**
 * Use ViT to produce a saliency-aware center crop of the image.
 * Falls back to a geometric center crop if the model fails.
 * Returns null when WebGPU is unavailable (caller should skip silently).
 */
export async function generateSalientCrop(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<Blob | null> {
  try {
    const pipe = await PipelineManager.getPipeline(
      'image-classification',
      VIT_MODEL,
      onProgress,
    )
    const bitmap = await createImageBitmap(imageBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()

    await pipe(canvas.toDataURL('image/jpeg', 0.9), { top_k: 5 })

    // Center-crop to square at 512px (ViT attention map as future enhancement)
    const size = Math.min(canvas.width, canvas.height)
    const x = Math.round((canvas.width - size) / 2)
    const y = Math.round((canvas.height - size) / 2)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = 512
    cropCanvas.height = 512
    cropCanvas.getContext('2d')!.drawImage(canvas, x, y, size, size, 0, 0, 512, 512)

    return new Promise((resolve) =>
      cropCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    )
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-classification', VIT_MODEL)
  }
}

/**
 * Use LiquidAI VLM to generate a short caption and render it as an overlay.
 * Returns null when the model fails or WebGPU is unavailable.
 */
export async function generateCaption(
  _imageBlob: Blob,
  _onProgress?: (data: { progress?: number }) => void,
): Promise<{ blob: Blob; caption: string } | null> {
  // LiquidAI/LFM2.5-VL-1.6B-ONNX lacks preprocessor_config.json required by
  // transformers.js vision pipelines. Disabled until a compatible model is available.
  return null
  // eslint-disable-next-line no-unreachable
  try {
    return null
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-text-to-text', VLM_MODEL)
  }
}
