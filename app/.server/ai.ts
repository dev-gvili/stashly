import { RawImage, Tensor, PretrainedConfig } from '@huggingface/transformers'
import {
  getVision,
  transcribeAudioStream,
  type TranscribeOptions,
  getPipeline,
  getWhisper,
} from './ai.utils'
import { getAudioPCMStream } from './ai-whisper'
import { Decoder, Demuxer, EOF } from 'node-av'

/**
 * Generates a detailed caption for an image located at the given URL using the Florence-2 model.
 * @param url - The URL of the image to be captioned.
 * @returns A promise that resolves to the generated image caption as a string.
 */
export async function toImageCaption(url: string) {
  try {
    // 01. get model instance
    const { model, processor } = await getVision()
    // 02.Load image from URL and prepare for processing
    const image = await RawImage.fromURL(url)
    // 03. preprocessing - prepare image tensors for model input
    const inputs = await processor(image, '<MORE_DETAILED_CAPTION>')
    // 04. output generation - generate tokenIds
    const output = await model.generate({
      ...inputs,
      max_new_tokens: 256, // use a higher token limit for more detailed captions
      remove_invalid_values: true, // Clean up NaNs/Infs in outputs
      length_penalty: 1.0, // Encourages the model not to cut the sentence short
    })
    // 05. Decode the output - Type-safe extraction of sequences
    const outputIds =
      output instanceof Tensor ? output : (output as any).sequences
    // 06. Decode the generated token IDs back into a human-readable caption
    const caption = processor.batch_decode(outputIds, {
      skip_special_tokens: true, // Remove special tokens like <s>, </s>, etc.
    })[0]
    // 07. Return the caption
    return caption
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Image Captioning failed:', message)
    throw message
  }
}

export interface TranscribeProps extends TranscribeOptions {
  /**
   * If true, the transcription will be streamed.
   *
   * @default false
   */
  stream?: boolean
  /**
   * Callback function to handle the transcribed text.
   *
   */
}

/**
 * Transcribes audio or video from a given URL, either in a streaming fashion or as a complete transcription.
 *
 * @param {object} props - The properties for transcription.
 * @param {string} props.url - The URL of the audio or video file to transcribe.
 * @param {boolean} props.stream - If true, the transcription will be streamed, yielding segments as they become available.
 *   If false, the entire file will be transcribed, and the complete text will be sent once.
 * @param {TranscribeOptions['model']} [props.model='large-v3-turbo'] - The Whisper model to use for transcription.
 *   Defaults to 'large-v3-turbo'.
 * @param {string} [props.language='auto'] - The language code for transcription (e.g., 'en', 'es').
 *   Use 'auto' for automatic language detection. Defaults to 'auto'.
 * @param {(text: string) => void} props.onReceive - A callback function that is invoked with each transcribed text segment
 *   (in streaming mode) or with the complete transcription (in non-streaming mode).
 * @throws {Error} If an error occurs during the transcription process (e.g., no audio stream found, model loading failure).
 *
 * @example
 * // Transcribe a video URL in streaming mode and log each segment
 * // This will call onReceive for each new segment of text.
 * await transcribe({
 *   url: 'https://example.com/my-video.mp4',
 *   stream: true,
 *   onTextTranscribed: (text) => {
 *     void 0;
 *   }
 * });
 *
 * // Transcribe an audio file completely and log the full text once.
 * // This will call onReceive once with the complete transcription.
 * await transcribe({
 *   url: 'https://example.com/my-audio.mp3',
 *   stream: false,
 *   language: 'en',
 *   onTextTranscribed: (fullText) => {
 *     void 0;
 *   }
 * });
 *
 */
export async function transcribeMedia({
  stream,
  onDone,
  onPartial,
  url,
  ...props
}: TranscribeProps) {
  const [whisper, input] = await Promise.all([
    getWhisper(props),
    Demuxer.open(url),
  ])
  let audioStream = input.audio()
  if (!audioStream) {
    await input.close()
    throw new Error('No audio stream found')
  }
  let decoder = await Decoder.create(audioStream)
  let segments: string[] = []
  try {
    for await (const segment of whisper.transcribe(
      decoder.frames(input.packets())
    )) {
      if (!segment.text) continue
      segments.push(segment.text)
      onPartial?.(segment.text)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Transcription failed:', message)
    throw err
  } finally {
    // Ensure decoder and input are closed even if they weren't successfully created
    decoder.close()
    await input.close()
  }
  const fullText = segments.join('. ').trim()
  onDone?.(fullText)
  return fullText
}

// AI pipeline to summarize text using Xenova/distilbart-cnn-12-6
export async function summarizeText(text: string): Promise<string> {
  try {
    const modelName = 'Xenova/distilbart-cnn-12-6'
    const summarizer = await getPipeline('summarization', modelName)
    const summaryOutput = (await summarizer(text)) as Array<{
      summary_text: string
    }>
    return summaryOutput[0].summary_text
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Text Summarization failed:', message)
    throw message
  }
}
