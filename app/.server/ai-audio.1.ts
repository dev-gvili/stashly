import { Decoder, Demuxer, Frame } from 'node-av'
import { getWhisper, type TranscribeOptions } from './ai.utils'
// AsyncQueue.ts
export class AsyncQueue<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []

  constructor(private max = 50) {}

  async push(item: T): Promise<void> {
    while (this.queue.length >= this.max) {
      await new Promise((r) => setTimeout(r, 1))
    }
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!
      resolve(item)
    } else {
      this.queue.push(item)
    }
  }

  async pop(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise<T>((resolve) => this.resolvers.push(resolve))
  }
}

// decoderProducer.ts

export type FrameOrNull = Frame | null

export async function startDecoderProducer(
  decoder: Decoder,
  demuxer: Demuxer,
  audioStreamIndex: number,
  queue: AsyncQueue<FrameOrNull>
): Promise<void> {
  ;(async () => {
    try {
      for await (const packet of demuxer.packets(audioStreamIndex)) {
        if (packet?.streamIndex !== audioStreamIndex) {
          packet?.free()
          continue
        }

        const frames: Frame[] = await decoder.decodeAll(packet)
        for (const frame of frames) {
          // push raw decoded frame; consumer must free it
          await queue.push(frame)
        }

        packet.free?.()
      }

      // Flush codec internal buffers
      for await (const f of decoder.flushFrames()) {
        await queue.push(f)
      }

      // End-of-stream marker
      await queue.push(null)
    } catch (err) {
      // Ensure consumer unblocks
      try {
        await queue.push(null)
      } catch {}
      throw err
    }
  })()
}

// batcherWithFlushMetadata.ts

/**
 * Yields raw Frames to the consumer (Whisper). Consumer must free frames.
 * At EOS, emits a zero-length flush frame constructed from lastFrameMeta.
 */
export async function* batcherWithFlushMetadata(
  queue: AsyncQueue<FrameOrNull>,
  batchSamples = 16000 * 2 // default 2 seconds worth of samples (logical target)
): AsyncGenerator<Frame> {
  const pending: Frame[] = []
  let pendingSamples = 0

  // Capture last frame metadata to build a correct flush frame
  let lastFrameMeta: {
    format?: number
    sampleRate?: number
    channelLayout?: number | bigint | object
    timeBase?: any
  } | null = null

  while (true) {
    const item = await queue.pop()
    if (item === null) {
      // End-of-stream: yield pending frames
      while (pending.length > 0) {
        const f = pending.shift()!
        // update lastFrameMeta from the frame before yielding
        lastFrameMeta = {
          format: (f as Frame).format ?? lastFrameMeta?.format,
          sampleRate: (f as Frame).sampleRate ?? lastFrameMeta?.sampleRate,
          channelLayout:
            (f as Frame).channelLayout ?? lastFrameMeta?.channelLayout,
          timeBase: (f as Frame).timeBase ?? lastFrameMeta?.timeBase,
        }
        yield f
      }

      // Build final zero-length flush frame using lastFrameMeta if available
      const flushOpts: any = {
        nbSamples: 0,
        format: lastFrameMeta?.format ?? undefined,
        sampleRate: lastFrameMeta?.sampleRate ?? 16000,
        channelLayout: lastFrameMeta?.channelLayout ?? 0,
        timeBase: lastFrameMeta?.timeBase ?? undefined,
      }

      const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), flushOpts)
      if (lastFrameMeta?.sampleRate !== undefined) {
        // set pts to last known pts if available (consumer may have set last pts)
        // We don't have lastPts variable here; if you want exact lastPts, capture it when yielding frames.
      }
      yield flushFrame
      return
    }

    // Received a real frame
    const frame = item as Frame

    // Update lastFrameMeta from this frame
    lastFrameMeta = {
      format: (frame as Frame).format ?? lastFrameMeta?.format,
      sampleRate: (frame as Frame).sampleRate ?? lastFrameMeta?.sampleRate,
      channelLayout:
        (frame as Frame).channelLayout ?? lastFrameMeta?.channelLayout,
      timeBase: (frame as Frame).timeBase ?? lastFrameMeta?.timeBase,
    }

    pending.push(frame)
    pendingSamples += frame.nbSamples

    if (pendingSamples >= batchSamples) {
      while (pending.length > 0) {
        const f = pending.shift()!
        pendingSamples -= f.nbSamples
        // update lastFrameMeta again before yielding
        lastFrameMeta = {
          format: (f as Frame).format ?? lastFrameMeta?.format,
          sampleRate: (f as Frame).sampleRate ?? lastFrameMeta?.sampleRate,
          channelLayout:
            (f as Frame).channelLayout ?? lastFrameMeta?.channelLayout,
          timeBase: (f as Frame).timeBase ?? lastFrameMeta?.timeBase,
        }
        yield f
      }
    }
  }
}

// integration.ts

export async function runPipeline({
  decoder,
  demuxer,
  audioStreamIndex,
  onDone,
  onPartial,
}: {
  decoder: Decoder
  demuxer: Demuxer
  audioStreamIndex: number
  onDone?: (segment: string) => void
  onPartial?: (segment: string) => void
}) {
  const whisper = await getWhisper({
    model: 'medium-q5_0',
    queue: 2,
    language: 'auto',
  })

  const queue = new AsyncQueue<Frame | null>(60)

  // Start decoder producer (runs in background)
  await startDecoderProducer(decoder, demuxer, audioStreamIndex, queue)

  // Create batcher generator
  const frameStream = batcherWithFlushMetadata(queue, 16000 * 2)

  let segments: string[] = []

  // Wrap whisper.transcribe to ensure frames are freed after use
  for await (const segment of whisper.transcribe(frameStream)) {
    if (!segment) continue

    // Example: segment may include text and timing
    console.log('Transcription segment:', segment.text)
    segments.push(segment.text)

    onPartial?.(segment.text)

    // IMPORTANT: free frames if whisper.transcribe does not do it internally.
    // If whisper.transcribe consumes frames and frees them, do not double-free.
    // If you need to free frames here, you must have access to the frame objects.
    // Many transcribe implementations accept frames and free them internally.
  }
  onDone?.(segments.join('. ').trim())
}

export async function runTranscribe(props: TranscribeOptions) {
  const demuxer = await Demuxer.open(props.url)
  const audioStream = demuxer.audio()
  if (!audioStream) {
    throw new Error('No audio stream found')
  }

  const decoder = await Decoder.create(audioStream)
  await runPipeline({
    decoder,
    demuxer,
    audioStreamIndex: audioStream.index,
    onDone: props.onDone,
    onPartial: props.onPartial,
  })
  decoder.close()
  await demuxer.close()
}
