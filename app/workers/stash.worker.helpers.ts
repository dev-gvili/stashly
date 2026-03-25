// -------------------------
// Pure helper functions for stash.worker.ts
// Extracted here so they can be imported and unit-tested independently.
// -------------------------

/** Parameters for extractAudioChunk */
export interface ExtractAudioChunkParams {
  audio: Float32Array
  startSeconds: number
  durationSeconds: number
  sampleRate?: number
}

/**
 * Extracts a chunk of audio data from a larger audio buffer.
 * @param audio - The full audio buffer
 * @param startSeconds - Start time in seconds
 * @param durationSeconds - Duration of chunk in seconds
 * @param sampleRate - Sample rate in Hz (default: 16000)
 * @returns Audio chunk as Float32Array
 */
export function extractAudioChunk({
  audio,
  startSeconds,
  durationSeconds,
  sampleRate = 16000,
}: ExtractAudioChunkParams): Float32Array {
  const startSample = Math.floor(startSeconds * sampleRate)
  const endSample = Math.min(
    Math.ceil((startSeconds + durationSeconds) * sampleRate),
    audio.length
  )

  if (startSample >= audio.length || startSample >= endSample) {
    return new Float32Array(0)
  }

  return audio.slice(startSample, endSample)
}

/**
 * Splits audio into fixed-size chunks with optional stride overlap.
 * @param audio - The full audio buffer
 * @param sampleRate - Sample rate in Hz
 * @param chunkSec - Chunk duration in seconds
 * @param strideSec - Stride/overlap in seconds (default: 0)
 * @returns Array of audio chunks
 */
export function makeChunks(
  audio: Float32Array,
  sampleRate: number,
  chunkSec: number,
  strideSec: number = 0
): Float32Array[] {
  const chunkSize = Math.floor(chunkSec * sampleRate)
  const strideSize = Math.floor(strideSec * sampleRate)
  const chunks: Float32Array[] = []

  for (let start = 0; start < audio.length; start += chunkSize - strideSize) {
    const end = Math.min(start + chunkSize, audio.length)
    chunks.push(audio.slice(start, end))
    if (end === audio.length) break
  }

  return chunks
}

/**
 * Splits text into chunks that respect sentence boundaries and stay within
 * a maximum character length.
 * @param text - Input text
 * @param maxLength - Maximum characters per chunk
 * @returns Array of text chunks
 */
export function toChunk(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks
}

/**
 * Parses LLM-generated tag output into a clean array of tag strings.
 * Handles common LLM formatting quirks: leading bullets, numbers, quotes, parens.
 * @param raw - Raw text output from the LLM
 * @returns Array of up to 10 cleaned tag strings
 */
export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) =>
      t
        .replace(/^[\s\-*•#\d.()\[\]"']+/, '') // strip leading decorators
        .replace(/[\s\-*•#.()\[\]"']+$/, '') // strip trailing decorators
        .trim()
    )
    .filter((t) => t.length > 0 && t.length <= 60)
    .slice(0, 10)
}
