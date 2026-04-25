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

    await pipe(canvas.toDataURL('image/webp', 0.9), { top_k: 5 })

    // Center-crop to square at 512px (ViT attention map as future enhancement)
    const size = Math.min(canvas.width, canvas.height)
    const x = Math.round((canvas.width - size) / 2)
    const y = Math.round((canvas.height - size) / 2)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = 512
    cropCanvas.height = 512
    cropCanvas.getContext('2d')!.drawImage(canvas, x, y, size, size, 0, 0, 512, 512)

    return new Promise((resolve) =>
      cropCanvas.toBlob((b) => resolve(b), 'image/webp', 0.85),
    )
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-classification', VIT_MODEL)
  }
}

/**
 * Use Florence-2 to generate a short caption and render it as an overlay.
 * Returns null when the model fails or WebGPU is unavailable.
 */
export async function generateCaption(
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
  } catch {
    return null
  }
}
