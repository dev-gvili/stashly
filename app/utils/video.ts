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

    // `seeked` fires when the seek completes, not when its frame can be drawn:
    // drawing right then left the canvas transparent for most large videos, and
    // JPEG writes a transparent canvas as solid black, which was then stored for
    // good. So draw, and look for pixels: poll until the frame arrives. A video
    // that never produces one gets no thumbnail, which beats a black one.
    const drawn = () => {
      if (!ctx || !video.videoWidth) return false
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 3; i < data.length; i += 4 * 997) {
        if (data[i] !== 0) return true
      }
      return false
    }

    const waitForFrame = (tries: number) => {
      try {
        if (drawn()) {
          cleanup()
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        } else if (tries > 0) {
          setTimeout(() => waitForFrame(tries - 1), 50)
        } else {
          cleanup()
          resolve(null)
        }
      } catch {
        cleanup()
        resolve(null)
      }
    }

    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = Math.min(1, video.duration * 0.1)
      },
      { once: true }
    )

    video.addEventListener('seeked', () => waitForFrame(60), { once: true })

    video.addEventListener('error', () => { cleanup(); resolve(null) }, { once: true })
    video.load()
  })
}
