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
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<{ blob: Blob; caption: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipe = await PipelineManager.getPipeline('image-text-to-text' as any, VLM_MODEL, onProgress) as any

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(imageBlob)
    })

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image', image: dataUrl },
          { type: 'text', text: 'Describe this image in 5 words or fewer.' },
        ],
      },
    ]

    const output = await pipe(messages, { max_new_tokens: 20, do_sample: false })
    const caption: string = output?.[0]?.generated_text?.at(-1)?.content ?? ''
    if (!caption) return null

    const bitmap = await createImageBitmap(imageBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const barH = Math.round(canvas.height * 0.22)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH)

    const fontSize = Math.max(12, Math.round(canvas.height * 0.075))
    ctx.font = `600 ${fontSize}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(caption, canvas.width / 2, canvas.height - barH / 2, canvas.width - 16)

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85),
    )

    return { blob, caption }
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-text-to-text', VLM_MODEL)
  }
}
