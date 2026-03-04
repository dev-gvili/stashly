import type { TranscribeProps } from '@/services//ai'
import z from 'zod'
import type { Route } from './+types/ai'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import { presignedUrl } from '../../machines/schema.zod'
import { StashlyAI } from '../../.server/stashly-ai'
import { cleanText } from '../../.server/search/embeddings'
// import { cleanTranscript } from '../../.server/search/embeddings'

/**
 * input validation schema for AI image caption generation.
 */
let aiCaptionSchema = z.object({
  intent: z.literal('caption-image'),
  url: z.url(),
})

/**
 *  Schema for ai embedding request.
 */
let aiEmbedSchema = z.object({
  intent: z.literal('extract-features'),
  content: z.string().nonempty(),
})

/**
 * Schema for ai translation request.
 */
let aiTranslateSchema = z.object({
  intent: z.literal('translate-text'),
  key: z.string().nonempty(),
})

/**
 * Schema for ai suggestion request.
 */
let aiSuggestionSchema = z.object({
  intent: z.literal('suggest-items'),
  key: z.string().nonempty(),
})

/**
 * Schema for ai summarization request.
 */
let aiSummarizeSchema = z.object({
  intent: z.literal('summarize-text'),
  text: z.string().nonempty(),
})

/**
 * Schema for ai audio transcription request.
 */
let aiTranscribeSchema = z.object({
  intent: z.literal('transcribe-file'),
  url: presignedUrl,
  model: z.custom<TranscribeProps['model']>().default('base'),
  stream: z
    .preprocess((val) => (val === 'true' ? true : false), z.boolean())
    .default(false),
  queue: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default(3),
  language: z.string().default('auto'),
})

/**
 * Schema for ai chat request.
 */
let aiChatSchema = z.object({
  intent: z.literal('chat'),
  prompt: z.string().nonempty(),
})

/**
 * Schema for ai chat request.
 */
let aiAudioSchema = z.object({
  intent: z.literal('process-audio'),
  url: z.string().nonempty(),
  stream: z
    .preprocess((val) => (val === 'true' ? true : false), z.boolean())
    .default(false),
})

/**
 * This schema is for validating and parsing the input from the client for AI-related actions.
 * It uses a discriminated union based on the 'intent' field to handle various AI functionalities.
 */
export const aiApiRouteInput = z.discriminatedUnion('intent', [
  aiCaptionSchema,
  aiAudioSchema,
  aiEmbedSchema,
  aiSummarizeSchema,
  aiTranscribeSchema,
  aiTranslateSchema,
  aiSuggestionSchema,
  aiChatSchema,
])

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request }: Route.ActionArgs) {
  let parsedInput = await parseFormData({
    request,
    schema: aiApiRouteInput,
  })

  let headers = { 'Content-Type': 'application/json' }
  switch (parsedInput.intent) {
    case 'process-audio': {
      const { transcription, summary } = await StashlyAI.processAudio(
        parsedInput.url
      )
      return data({ transcription, summary }, { headers, status: 200 })
    }
    case 'caption-image': {
      let caption = await StashlyAI.caption(parsedInput.url)
      // let caption = await StashlyLiquidAI.caption(parsedInput.url, 'long')
      // let caption = await toImageCaption(parsedInput.url)
      return data({ caption }, { headers, status: 200 })
    }
    case 'summarize-text': {
      let summary = await StashlyAI.summarize(parsedInput.text)
      return data({ summary }, { headers, status: 200 })
    }
    case 'transcribe-file': {
      if (parsedInput.stream) {
        let { intent, ...props } = parsedInput
        let transcription = await StashlyAI.transcribe(props)
        return data({ transcription }, { headers, status: 200 })
      }
    }
    case 'extract-features': {
      return data('not implemented yet', { headers, status: 200 })
    }
    case 'translate-text': {
      return data('not implemented yet', { headers, status: 200 })
    }
    case 'suggest-items':
    case 'chat':
      return data('not implemented yet', { headers, status: 200 })
    default:
      throw new Error('Unhandled AI API intent')
  }
}
