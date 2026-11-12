export function getVideoMetadata(
  file: File
): Promise<{ width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.preload = 'metadata'

    video.addEventListener(
      'loadedmetadata',
      () => {
        URL.revokeObjectURL(url)
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        })
      },
      { once: true }
    )

    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null) }, { once: true })
    video.load()
  })
}

/** Mean luminance (0-255) under which a grabbed frame counts as black. */
const BLACK_FRAME_LUMINANCE = 12

export function generateVideoThumbnail(file: File): Promise<string | null>
export function generateVideoThumbnail(src: string): Promise<string | null>
export function generateVideoThumbnail(
  source: File | string
): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const isFile = source instanceof File
    const url = isFile ? URL.createObjectURL(source) : source
    video.src = url
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const cleanup = () => { if (isFile) URL.revokeObjectURL(url) }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Draws the current frame and returns its mean luminance (0-255), or null
    // while the canvas is still blank. `seeked` fires when the seek completes,
    // not when its frame can be drawn: drawing right then left the canvas
    // transparent for most large videos, and JPEG writes a transparent canvas
    // as solid black, which was then stored for good.
    const measure = (): number | null => {
      if (!ctx || !video.videoWidth) return null
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let sum = 0
      let seen = 0
      for (let i = 0; i < data.length; i += 4 * 997) {
        if (data[i + 3] === 0) continue
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3
        seen++
      }
      return seen ? sum / seen : null
    }

    // Times to try, in order: a videos' first seconds are often a black intro
    // or fade-in, so move on to a later frame until one is not black.
    const candidates: number[] = []
    let next = 0
    let best: { luminance: number; dataUrl: string } | null = null

    const finish = () => {
      cleanup()
      resolve(best?.dataUrl ?? null)
    }

    // Poll until the frame arrives; a video that never yields one gets no
    // thumbnail, which beats a black one.
    const waitForFrame = (tries: number) => {
      try {
        const luminance = measure()
        if (luminance === null) {
          if (tries > 0) setTimeout(() => waitForFrame(tries - 1), 50)
          else finish()
          return
        }
        if (!best || luminance > best.luminance) {
          best = { luminance, dataUrl: canvas.toDataURL('image/jpeg', 0.7) }
        }
        if (best.luminance >= BLACK_FRAME_LUMINANCE || next >= candidates.length) finish()
        else video.currentTime = candidates[next++]
      } catch {
        finish()
      }
    }

    video.addEventListener(
      'loadedmetadata',
      () => {
        // Recorder output (webm) can report an infinite duration.
        const d = Number.isFinite(video.duration) ? video.duration : 20
        const times = [Math.min(1, d * 0.1), d * 0.1, d * 0.25, d * 0.5]
        for (const t of times) {
          if (Number.isFinite(t) && !candidates.some((c) => Math.abs(c - t) < 0.5)) candidates.push(t)
        }
        video.currentTime = candidates[next++] ?? 0
      },
      { once: true }
    )

    video.addEventListener('seeked', () => waitForFrame(60))

    video.addEventListener('error', () => { cleanup(); resolve(null) }, { once: true })
    video.load()
  })
}
