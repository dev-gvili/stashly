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

    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = Math.min(1, video.duration * 0.1)
      },
      { once: true }
    )

    video.addEventListener(
      'seeked',
      () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) { cleanup(); resolve(null); return }
          ctx.drawImage(video, 0, 0)
          cleanup()
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        } catch {
          cleanup()
          resolve(null)
        }
      },
      { once: true }
    )

    video.addEventListener('error', () => { cleanup(); resolve(null) }, { once: true })
    video.load()
  })
}
