/** A stage-2 thumbnail: the 512px webp and the size it came out at. */
export interface ResizedThumbnail {
  blob: Blob
  width: number
  height: number
}

/**
 * How one kind of file becomes a thumbnail. One per file type, in this folder;
 * `producerFor` picks the first whose `matches` accepts the file.
 */
export interface ThumbnailProducer {
  /** Short name for logs and tests, e.g. `'image'`. */
  name: string
  /** Whether this producer handles the file. */
  matches(file: File): boolean
  /** Stage 1: a tiny blurred preview, or null when the type has none. */
  preview(file: File): Promise<Blob | null>
  /**
   * Stage 2: the 512px thumbnail, or null when it can't be rendered.
   * `previewFrame` is stage 1's output, which video uses as its frame.
   */
  resize(file: File, previewFrame?: Blob | null): Promise<ResizedThumbnail | null>
  /** Stage 3: a salient square crop. Only images have one. */
  salientCrop?(file: File): Promise<Blob | null>
}
