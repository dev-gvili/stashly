import {
  Florence2ForConditionalGeneration,
  Florence2Processor,
  AutoTokenizer,
  RawImage,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Processor,
} from '@huggingface/transformers'
import { PipelineManager } from './stash.ai'

const VIT_MODEL = 'Xenova/vit-base-patch16-224'
const FLORENCE_MODEL = 'onnx-community/Florence-2-base-ft'

// Serialize all AI operations — WebGPU can't handle concurrent inference.
// Shared with the embedding worker via `app/workers/ai-queue.ts` so saliency
// crops, captions, and text embeddings never overlap.
import { enqueue } from './ai-queue'

// Cached Florence-2 instances (loaded once, reused across stages)
let florenceModel: PreTrainedModel | null = null
let florenceProcessor: Processor | null = null
let florenceTokenizer: PreTrainedTokenizer | null = null

async function loadFlorence(onProgress?: (data: { progress?: number }) => void) {
  if (florenceModel && florenceProcessor && florenceTokenizer) {
    return { model: florenceModel, processor: florenceProcessor, tokenizer: florenceTokenizer }
  }

  const device = 'webgpu'
  const dtype = {
    embed_tokens: 'fp32' as const,
    vision_encoder: 'fp32' as const,
    encoder_model: 'fp32' as const,
    decoder_model_merged: 'q4' as const,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progressCallback = onProgress ? (p: any) => onProgress({ progress: p?.progress }) : undefined

  const [model, processor, tokenizer] = await Promise.all([
    Florence2ForConditionalGeneration.from_pretrained(FLORENCE_MODEL, {
      dtype,
      device,
      progress_callback: progressCallback,
    }),
    Florence2Processor.from_pretrained(FLORENCE_MODEL),
    AutoTokenizer.from_pretrained(FLORENCE_MODEL),
  ])

  florenceModel = model
  florenceProcessor = processor as Processor
  florenceTokenizer = tokenizer as PreTrainedTokenizer
  return { model, processor: florenceProcessor, tokenizer: florenceTokenizer }
}

/** Detect the largest face using the native browser FaceDetector API (Chrome). */
async function detectFaceCenter(
  bitmap: ImageBitmap,
): Promise<{ cx: number; cy: number } | null> {
  if (!('FaceDetector' in window)) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
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

    // Run ViT in background for future attention-map use (don't await — don't block)
    if (!faceCenter) {
      PipelineManager.getPipeline('image-classification', VIT_MODEL, onProgress)
        .then((pipe) => pipe(imageBlob, { top_k: 1 }).catch(() => {}))
        .catch(() => {})
    }

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

/**
 * Use Florence-2 to generate a short caption and render it as an overlay.
 * Returns null when the model fails or WebGPU is unavailable.
 */
export function generateCaption(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<{ blob: Blob; caption: string } | null> {
  return enqueue(() => _generateCaption(imageBlob, onProgress))
}

async function _generateCaption(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<{ blob: Blob; caption: string } | null> {
  try {
    const { model, processor, tokenizer } = await loadFlorence(onProgress)

    const image = await RawImage.fromBlob(imageBlob)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputs = await (processor as any)(image, '<CAPTION>')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generatedIds = await (model as any).generate({ ...inputs, max_new_tokens: 64 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generatedText: string = (tokenizer as any).batch_decode(generatedIds, { skip_special_tokens: false })[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = (processor as any).post_process_generation(generatedText, '<CAPTION>', {
      width: image.width,
      height: image.height,
    })
    const caption: string = parsed['<CAPTION>'] ?? ''
    if (!caption.trim()) return null

    // Render caption overlay onto the input image
    const bitmap = await createImageBitmap(imageBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    // Anchor bar so it ends at 87% height — the bottom 13% is cropped in 4:3 grid cells
    const safeBottom = Math.round(canvas.height * 0.87)
    const barH = Math.round(canvas.height * 0.22)
    const barY = safeBottom - barH
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(0, barY, canvas.width, barH)

    const fontSize = Math.max(12, Math.round(canvas.height * 0.072))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 4
    ctx.fillText(caption, canvas.width / 2, barY + barH * 0.7, canvas.width - 24)
    ctx.shadowBlur = 0

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/webp', 0.85),
    )

    return { blob, caption }
  } catch (e) {
    console.error('[stage4] generateCaption failed', e)
    return null
  }
}
