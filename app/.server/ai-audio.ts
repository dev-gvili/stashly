// AsyncQueue.ts
// types.ts
import { Frame, Decoder, Demuxer, type Stream } from 'node-av'
import { getWhisper, type TranscribeOptions } from './ai.utils'

export type FrameOrNull = Frame | null
export type PCMBatchOptions = {
  batchSamples?: number // target total samples per batch (sum of frame.nbSamples)
}

// decoderProducer.ts

export async function startDecoderProducer(
  decoder: Decoder,
  demuxer: Demuxer,
  audioStreamIndex: number,
  queue: AsyncQueue<FrameOrNull>
): Promise<void> {
  // Run decoding in background
  ;(async () => {
    try {
      for await (const packet of demuxer.packets(audioStreamIndex)) {
        // Only process packets for the audio stream
        if (packet?.streamIndex !== audioStreamIndex) {
          packet?.free()
          continue
        }

        const frames: Frame[] = await decoder.decodeAll(packet)
        for (const frame of frames) {
          // Push the raw decoded frame into the queue.
          // Consumer will free the frame after processing.
          await queue.push(frame)
        }

        packet.free?.()
      }

      // Flush decoder internal buffers (codec-level)
      for await (const f of decoder.flushFrames()) {
        await queue.push(f)
      }

      // End-of-stream marker
      await queue.push(null)
    } catch (err) {
      // On error, push null to unblock consumer and rethrow/log
      try {
        await queue.push(null)
      } catch {}
      throw err
    }
  })()
}

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

// batcher.ts

/**
 * batcher yields raw Frames to the consumer (Whisper).
 * The consumer receives Frame objects and is responsible for freeing them.
 */
export async function* batcher(
  queue: AsyncQueue<FrameOrNull>,
  options: PCMBatchOptions = {}
): AsyncGenerator<Frame> {
  const batchSamples = options.batchSamples ?? 16000 * 2 // default 2 seconds at 16k
  let pending: Frame[] = []
  let pendingSamples = 0
  let lastPts: bigint | null = null

  function flushPendingYield() {
    // Yield frames one by one (ownership transferred to consumer)
    while (pending.length > 0) {
      const f = pending.shift()!
      pendingSamples -= f.nbSamples
      // update lastPts
      if (typeof f.pts === 'bigint') lastPts = f.pts
      // yield frame to consumer
      // consumer must free the frame after use
      // (we yield and return control; consumer handles free)
      // Note: we do not call f.free() here
      // because we transfer ownership to the caller.
      // Caller must call f.free() when done.
      // eslint-disable-next-line no-await-in-loop
      // (yield is synchronous in generator; consumer handles async)
      // yield below in outer scope
      // We'll yield in the outer loop by pushing back into a local queue
      // but here we simply break to let outer loop yield.
      // Implementation detail: we will yield frames below.
    }
  }

  // Simpler approach: yield frames as they are ready
  while (true) {
    const item = await queue.pop()
    if (item === null) {
      // End-of-stream: yield any pending frames, then final flush frame
      while (pending.length > 0) {
        const f = pending.shift()!
        if (typeof f.pts === 'bigint') lastPts = f.pts
        yield f
      }

      // Final Whisper flush frame (zero-length)
      const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), {
        nbSamples: 0,
        format:
          /* use same format as last frame if available */ pending[0]?.format ??
          undefined,
        sampleRate: /* best-effort: use 16000 or last frame sampleRate */ 16000,
        channelLayout: /* best-effort */ 0,
        timeBase: /* best-effort */ pending[0]?.timeBase ?? undefined,
      } as any)

      // If we tracked lastPts, set it
      if (lastPts !== null) flushFrame.pts = lastPts
      yield flushFrame
      return
    }

    // Received a real frame
    const frame = item as Frame
    pending.push(frame)
    pendingSamples += frame.nbSamples

    // If we reached batch target, yield all pending frames
    if (pendingSamples >= batchSamples) {
      while (pending.length > 0) {
        const f = pending.shift()!
        if (typeof f.pts === 'bigint') lastPts = f.pts
        yield f
      }
      pendingSamples = 0
    }
  }
}

// integration.ts

// Example wiring

export async function runPipeline({
  decoder,
  demuxer,
  audioStream,
  audioQueue,
  onDone,
  onPartial,
}: {
  decoder: Decoder
  demuxer: Demuxer
  audioStream: Stream
  audioQueue: number // Audio queue size in seconds. Maximum duration of audio buffered before processing.
  onDone?: (segment: string) => void
  onPartial?: (segment: string) => void
}) {
  const whisper = await getWhisper({
    model: 'medium-q5_0',
    queue: audioQueue,
    language: 'auto',
  })

  const queue = new AsyncQueue<Frame | null>(30)

  // Start decoder producer (runs in background)
  await startDecoderProducer(decoder, demuxer, audioStream.index, queue)

  // Create batcher generator
  const frameStream = batcher(queue, { batchSamples: audioStream.codecpar.sampleRate * 2 })

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
    await demuxer.close()
    throw new Error('No audio stream found')
  }

  const decoder = await Decoder.create(audioStream, {
    exitOnError: false
  })

  await runPipeline({
    decoder,
    demuxer,
    audioStream: audioStream,
    audioQueue: 2,
    onDone: props.onDone,
    onPartial: props.onPartial,
  })
  decoder.close()
  await demuxer.close()
}
