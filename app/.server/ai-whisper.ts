import {
  type Stream,
  AV_SAMPLE_FMT_FLT,
  AV_CHANNEL_LAYOUT_MONO,
  Decoder,
  Demuxer,
  Rational,
  Frame,
  AVMEDIA_TYPE_AUDIO,
} from 'node-av'
import { getWhisper } from './ai.utils'

import libsamplerate from '@alexanderolsen/libsamplerate-js'
const { ConverterType, create } = libsamplerate
export async function* framesToWhisperFrames(
  decoder: Decoder,
  demuxer: Demuxer,
  audioStream: Stream
): AsyncGenerator<Frame | null> {
  const sourceRate = audioStream.codecpar.sampleRate
  const channels = audioStream.codecpar.channels
  const tb = audioStream.timeBase

  const resampler = await create(1, sourceRate, 16000, {
    converterType: ConverterType.SRC_SINC_FASTEST,
  })

  let resampleBuffer = new Float32Array(8192)

  // ⭐ batching
  const batchSize = 16000 * 2 // 2 seconds
  let batchBuffer = new Float32Array(batchSize)
  let batchOffset = 0

  let nextPts = 0n
  const pendingFrames: Frame[] = []

  function flushBatch() {
    const samples = batchBuffer.slice(0, batchOffset)
    const frame = toFrame(samples, nextPts)
    nextPts += BigInt(samples.length)

    pendingFrames.push(frame)
    batchOffset = 0
  }

  function appendToBatch(samples: Float32Array) {
    if (batchOffset + samples.length > batchSize) {
      flushBatch()
    }
    batchBuffer.set(samples, batchOffset)
    batchOffset += samples.length
  }

  for await (const packet of demuxer.packets(audioStream.index)) {
    if (!packet) continue
    if (packet.streamIndex !== audioStream.index) {
      packet.free()
      continue
    }

    const frames = await decoder.decodeAll(packet)

    for (const frame of frames) {
      if (!frame.data) {
        frame.free()
        continue
      }

      const mono = toMono(frame.data, channels)

      const estimated = Math.ceil(mono.length * (16000 / sourceRate) * 1.2)
      if (resampleBuffer.length < estimated) {
        resampleBuffer = new Float32Array(Math.ceil(estimated * 1.5))
      }

      const outView = resampler.full(mono, resampleBuffer)
      const copy = new Float32Array(outView)

      appendToBatch(copy)

      frame.free()
    }

    packet.free()

    // yield any ready frames
    while (pendingFrames.length > 0) {
      yield pendingFrames.shift() as Frame
    }
  }

  resampler.destroy()

  // flush remaining batch
  flushBatch()
  while (pendingFrames.length > 0) {
    yield pendingFrames.shift() as Frame
  }

  // final flush frame
  // const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), {
  //   nbSamples: 0,
  //   format: AV_SAMPLE_FMT_FLT,
  //   sampleRate: 16000,
  //   channelLayout: AV_CHANNEL_LAYOUT_MONO,
  //   timeBase: new Rational(1, 16000),
  // })
  let flushFrame: Frame | null = null
  try {
    flushFrame = toFrame(new Float32Array(0), nextPts) // This is a dummy frame to signal end
    yield flushFrame
  } catch (e) {
    flushFrame = toFrame(new Float32Array(1), nextPts)
    yield flushFrame
  }

  // The generator is done, no more frames will be yielded. Cleanup if necessary.
  if (flushFrame) {
    flushFrame.free()
  }
}


export async function* getAudioPCMStream(url: string) {
  const demuxer = await Demuxer.open(url, {
    skipStreamInfo: false,
    copyTs: true,
  })
  const audioStream =
    demuxer.audio() ??
    demuxer.streams.find((s) => s.codecpar.codecType === AVMEDIA_TYPE_AUDIO)
  if (!audioStream) {
    await demuxer.close()
    throw new Error('No audio track found in media.')
  }

  const decoder = await Decoder.create(audioStream)
  const whisper = await getWhisper({
    model: 'medium-q5_0',
    queue: 3,
    language: 'auto', 
  })
  const framesGenerator = framesToWhisperFrames(decoder, demuxer, audioStream)
  let segments: string[] = []
  for await (const segment of whisper.transcribe(framesGenerator)) {
    segments.push(segment.text)
    console.log('---Segment End---', segment)
    yield segment.text
  }
  decoder.close()
  await demuxer.close()
  yield segments.join('. ')
}

/**
 * Converts interleaved or planar audio data into a single mono Float32Array.
 * If the input is already mono, it is returned directly.
 * If the input is stereo or multi-channel, it is downmixed to mono by averaging the channel samples.
 *
 * @param data - The audio data, which can be an array of Float32Arrays (planar) or a single Float32Array (interleaved).
 * @param channelCount - The number of channels in the input audio data.
 * @returns A Float32Array containing the mono audio data.
 *
 * @example
 * // Convert stereo interleaved audio to mono
 * const stereoData = new Float32Array([0.5, -0.5, 0.6, -0.6, 0.7, -0.7]);
 * const monoData = toMono(stereoData, 2); // [0.05, 0.06, 0.07]
 *
 * // Convert stereo planar audio to mono
 * const planarData = [new Float32Array([0.5, 0.6, 0.7]), new Float32Array([-0.5, -0.6, -0.7])];
 * const monoPlanarData = toMono(planarData, 2); // [0.0, 0.0, 0.0]
 *
 * @remarks
 * - Handles both interleaved and planar audio formats.
 * - Efficiently averages channel samples for downmixing.
 * - Returns the original data if it is already mono.
 * @see {@link https://en.wikipedia.org/wiki/Audio_channel#Mono} for more information on mono audio.
 *
 */
function toMono(data: any, channelCount: number): Float32Array {
  // Planar data: array of Float32Arrays, one per channel, e.g. [Float32Array, Float32Array]
  if (Array.isArray(data)) {
    const samplesPerChannel = data[0].length
    const mono = new Float32Array(samplesPerChannel)
    for (let i = 0; i < samplesPerChannel; i++) {
      let sum = 0
      for (let ch = 0; ch < data.length; ch++) sum += data[ch][i]
      mono[i] = sum / data.length
    }
    return mono
  }

  // Interleaved data: single Float32Array with samples interleaved per channel e.g. [L, R, L, R, ...]
  const interleaved = data as Float32Array
  if (channelCount === 1) return interleaved

  const totalSamples = interleaved.length / channelCount
  const mono = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    let sum = 0
    for (let ch = 0; ch < channelCount; ch++)
      sum += interleaved[i * channelCount + ch]
    mono[i] = sum / channelCount
  }
  return mono
}

/**
 * Converts a Float32Array of audio samples into a node-av Frame.
 * This helper ensures the frame is correctly configured for Whisper (16kHz, Mono, Float).
 * It uses a Buffer view of the samples to avoid unnecessary memory copies and fixes
 * "Invalid argument" errors by passing only the relevant portion of the backing buffer.
 *
 * @param samples - The audio samples as a Float32Array.
 * @param pts - The presentation timestamp (PTS) for the frame, typically in 1/16000 units.
 * @returns A node-av Frame object ready for processing or transcription.
 *
 * @example
 * ```typescript
 * const samples = new Float32Array(16000); // 1 second of audio
 * const pts = 0n;
 * const frame = toFrame(samples, pts);
 * ```
 *
 * @remarks
 * - Ensures the Buffer passed to Frame.fromAudioBuffer only includes the relevant data segment.
 * - Configures the frame with Whisper-compatible parameters (16kHz sample rate, mono channel layout, float format).
 * - Sets the frame's PTS for accurate timing during transcription.
 * @see {@link Frame.fromAudioBuffer} for more details on frame creation.
 */
function toFrame(samples: Float32Array, pts: bigint): Frame {
  const buf = Buffer.from(
    samples.buffer,
    samples.byteOffset,
    samples.byteLength
  )

  const frame = Frame.fromAudioBuffer(buf, {
    nbSamples: samples.length,
    format: AV_SAMPLE_FMT_FLT,
    sampleRate: 16000,
    channelLayout: AV_CHANNEL_LAYOUT_MONO,
    timeBase: new Rational(1, 16000),
  })

  frame.pts = pts
  return frame
}
