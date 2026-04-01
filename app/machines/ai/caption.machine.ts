import { assertEvent, assign, fromPromise, setup } from 'xstate'
import { parsePresignedUrl } from '../../utils/parsers'
import { StashlyAI } from '../../.client/stashly-ai'

interface ImageCaptionContext {
  url: string
  caption: string | null
  error: string | null
}

const caption = fromPromise<{ caption: string }, { url: string }>(
  async ({ input }) => {
    let caption = await StashlyAI.caption(input.url)
    // let formData = new FormData()
    // formData.append('intent', 'caption-image')
    // // Get the presigned URL of the corrent loaded item ( if item category is image ).
    // formData.append('url', input.url)
    // // Call the captioning API
    // let response = await fetch('/api/ai/caption', {
    //   method: 'POST',
    //   body: formData,
    // })
    // // Parse the response, expecting a JSON with { description: string }
    // let data = (await response.json()) as { caption: string }
    return { caption }
  }
)

export const imageCaptionMachine = setup({
  types: {
    input: {} as { url: string },
    output: {} as { caption: string },
    context: {} as ImageCaptionContext,
  },
  actors: {
    caption,
  },
  actions: {
    setUrl: assign(({ context }) => {
      return { url: context.url }
    }),
    setCaption: (_, params: { caption: string }) => ({
      caption: params.caption,
    }),
    setError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    reset: ({ context }) => {
      context.caption = null
      context.error = null
    },
  },
  guards: {
    hasValidUrl: ({ context }) => {
      return parsePresignedUrl(context.url).success
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsC2BDGBaAxugDgC7ID2AdgHTIQA2YAxAMoAqAggErMDaADALqJQ+ErGTFygkAA9EAVgAsAJgo9FPAOyyAjAGYAHHp4A2WQBoQAT0Rb1yvfKO2t8nlqP6jAX0-m0mMLgE4pT4AE4kOHCiZFD0EORgVGQAbiQA1okAAujIFHhEpGRYfjC8AkggwqLBkjIICsqqGtr6hibmVgh6WhSKOrKKegCcRg5DQ+qj3r4Y2PnBFGERUcgx9GCh4aGLNOiEAGYkoagU2bnzhcWzYGWSVWKFtdYaPBRDPKpDam628maW1kGFG6WiG2j0o3UoPk0xAJQCF3IeRIqHwdEIkHotwq9xqFTqOj6b106n6Bg0Wj0ig6iB0NgobkJVPUpNkqh0sPhgQKSI2Wyx-DuIgeEnx1lBQxUbQGinUPD0rRpCEJynUDkUYPkQ0MGqG3h8IDIJAgcEkXMRZCF1UeYoQWCMSvtnOu3IW1DoVpFltt8npX19DlJinkBnUSrpsgoRg1CiGLkMCgczv8rsKi3CkVg0SgnrxoDqk0jCm6Wq+0bjDoBCAmFBZ+kmSnkvoVimTcyCaZwKLRYAxEFzNvziCUStlehU7l9we6elkCrbCI7vM2RwHoqHCC0Gp0KiGWlU6m6PG1hNHCqjDn02rjkw+HP1QA */
  id: 'image-caption',
  initial: 'idle',
  context: ({ input }) => ({
    url: input.url,
    caption: null,
    error: null,
  }),
  states: {
    idle: {
      always: {
        guard: 'hasValidUrl',
        target: 'processing',
      },
    },
    processing: {
      entry: 'reset',
      invoke: {
        id: '@ai.caption-image',
        src: 'caption',
        input: ({ context }) => ({
          url: context.url,
        }),
        onDone: {
          target: 'completed',
          actions: {
            type: 'setCaption',
            params: ({ event }) => ({ caption: event.output.caption }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'setError',
            params: ({ event }) => ({ error: event.error as string }),
          },
        },
      },
      description: 'Processing image for caption generation.',
    },
    completed: {
      type: 'final',
      output: ({ context }) => ({ caption: context.caption }),
      description: 'Image caption generated successfully',
    },
    error: {
      type: 'final',
      output: ({ context }) => ({ error: context.error }),
      description: 'An error occurred during image caption generation',
    },
  },
})
