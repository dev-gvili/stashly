import { PipelineManager } from './stash.ai'

const VIT_MODEL = 'Xenova/vit-base-patch16-224'

// Serialize all AI operations — WebGPU can't handle concurrent inference.
// Shared with the embedding worker via `app/workers/ai-queue.ts` so saliency
// crops and text embeddings never overlap.
import { enqueue } from './ai-queue'

/** Detect the largest face using the native browser FaceDetector API (Chrome). */
async function detectFaceCenter(
  bitmap: ImageBitmap,
): Promise<{ cx: number; cy: number } | null> {
  if (!('FaceDetector' in window)) return null
  try {
    const { FaceDetector } = window as unknown as {
      FaceDetector: new (options: { fastMode: boolean; maxDetectedFaces: number }) => {
        detect(bitmap: ImageBitmap): Promise<Array<{ boundingBox: DOMRectReadOnly }>>
      }
    }
    const detector = new FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
    const faces: Array<{ boundingBox: DOMRectReadOnly }> = await detector.detect(bitmap)
    if (!faces.length) return null
    // Pick the largest face
    const face = faces.reduce((a, b) =>
      a.boundingBox.width * a.boundingBox.height >= b.boundingBox.width * b.boundingBox.height ? a : b
    )
    const { x, y, width, height } = face.boundingBox
    return { cx: x + width / 2, cy: y + height / 2 }
  } catch {
    return null
  }
}

/** Compute a square crop rect centered on (cx,cy), clamped to image bounds. */
function squareCrop(
  imgW: number,
  imgH: number,
  cx: number,
  cy: number,
  // Place face center at this vertical fraction of the crop (0.38 = upper third)
  faceFraction = 0.38,
): { x: number; y: number; size: number } {
  const size = Math.min(imgW, imgH)
  let x = Math.round(cx - size / 2)
  let y = Math.round(cy - size * faceFraction)
  x = Math.max(0, Math.min(imgW - size, x))
  y = Math.max(0, Math.min(imgH - size, y))
  return { x, y, size }
}

/**
 * Produce a smart square crop of the image:
 * 1. Native FaceDetector (Chrome) → crop centered on the largest face
 * 2. ViT classification → geometric center crop as fallback
 */
export function generateSalientCrop(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<Blob | null> {
  return enqueue(() => _generateSalientCrop(imageBlob, onProgress))
}

async function _generateSalientCrop(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(imageBlob)
    const { width: imgW, height: imgH } = bitmap

    // 1. Try native face detection
    const faceCenter = await detectFaceCenter(bitmap)

    const crop = faceCenter
      ? squareCrop(imgW, imgH, faceCenter.cx, faceCenter.cy)
      : (() => {
          // 2. ViT-informed fallback: still geometric center (attention map future work)
          const size = Math.min(imgW, imgH)
          return { x: Math.round((imgW - size) / 2), y: Math.round((imgH - size) / 2), size }
        })()

    // // Run ViT in background for future attention-map use (don't await — don't block)
    // if (!faceCenter) {
    //   PipelineManager.getPipeline('image-classification', VIT_MODEL, onProgress)
    //     .then((pipe) => pipe(imageBlob).catch((e) => { throw e }))
    //     .catch(() => {})
    // }

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = 512
    cropCanvas.height = 512
    cropCanvas.getContext('2d')!.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, 512, 512)
    bitmap.close()

    return new Promise((resolve) =>
      cropCanvas.toBlob((b) => resolve(b), 'image/webp', 0.85),
    )
  } catch (e) {
    console.error('[stage3] generateSalientCrop failed', e)
    return null
  } finally {
    await PipelineManager.disposePipeline('image-classification', VIT_MODEL).catch(() => {})
  }
}

