import libsamplerate from '@alexanderolsen/libsamplerate-js'
import {
  AutoModelForCausalLM,
  AutoProcessor,
  AutoTokenizer,
  env,
  Florence2ForConditionalGeneration,
  pipeline,
  type Florence2PreTrainedModel,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Processor,
  type SupportedTasks,
  type TaskType,
} from '@huggingface/transformers'
import {
  AVMEDIA_TYPE_AUDIO,
  Decoder,
  Demuxer,
  FFmpegError,
  Filter,
  Frame,
  WhisperDownloader,
  WhisperTranscriber,
  type Packet,
  type Stream,
  type WhisperSegment,
  type WhisperTranscriberOptions,
} from 'node-av'
import { formatSize, formatTime } from '../utils/formaters'

const { create, ConverterType } = libsamplerate
import {
  AV_SAMPLE_FMT_FLT,
  AV_CHANNEL_LAYOUT_MONO,
  EOF,
} from 'node-av/constants'
import { Rational } from 'node-av'

function floatToAudioFrame(samples: Float32Array, pts: bigint): Frame {
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
// function appendToBatch(
//   samples: Float32Array,
//   batchBuffer: Float32Array,
//   batchOffset: number,
//   pendingFrames: Frame[] = []
// ) {
//   if (batchOffset + samples.length > batchBuffer.length) {
//     // batch full → flush it
//     const slice = batchBuffer.slice(0, batchOffset)
//     flushBatch(slice, pendingFrames)
//     batchOffset = 0
//   }

//   batchBuffer.set(samples, batchOffset)
//   batchOffset += samples.length
// }

// function flushBatch(samples: Float32Array, pendingFrames: Frame[] = []) {
//   if (samples.length === 0) return

//   const pts16000 = nextPts // or your real timestamp logic
//   nextPts += BigInt(samples.length)

//   const frame = floatToAudioFrame(samples, pts16000)
//   pendingFrames.push(frame)
// }

// async function* framesToWhisperFrames(
//   decoder: Decoder,
//   demuxer: Demuxer,
//   audioStream: Stream
// ) {
//   const sourceRate = audioStream.codecpar.sampleRate
//   const channels = audioStream.codecpar.channels
//   const tb = audioStream.timeBase

//   const resampler = await create(1, sourceRate, 16000, {
//     converterType: ConverterType.SRC_SINC_FASTEST,
//   })

//   let resampleBuffer = new Float32Array(8192)

//   // ⭐ batching
//   const batchSize = 16000 * 2 // 2 seconds
//   let batchBuffer = new Float32Array(16000 * 2)
//   let batchOffset = 0
//   const pendingFrames: Frame[] = [] // This is local to framesToWhisperFrames

//   let nextPts = 0n

//   function flushBatch() {
//     if (batchOffset === 0) return

//     const samples = batchBuffer.slice(0, batchOffset)
//     const frame = floatToAudioFrame(samples, nextPts)
//     nextPts += BigInt(samples.length)

//     pendingFrames.push(frame)
//     batchOffset = 0
//   }

//   function appendToBatch(samples: Float32Array) {
//     if (batchOffset + samples.length > batchSize) {
//       flushBatch()
//     }
//     batchBuffer.set(samples, batchOffset)
//     batchOffset += samples.length
//   }

//   for await (const packet of demuxer.packets(audioStream.index)) {
//     if (!packet) continue
//     if (packet.streamIndex !== audioStream.index) {
//       packet.free?.()
//       continue
//     }

//     const frames = await decoder.decodeAll(packet)

//     for (const frame of frames) {
//       if (!frame.data) {
//         frame.free?.()
//         continue
//       }

//       const mono = toMono(frame.data, channels)

//       const estimated = Math.ceil(mono.length * (16000 / sourceRate) * 1.2)
//       if (resampleBuffer.length < estimated) {
//         resampleBuffer = new Float32Array(Math.ceil(estimated * 1.5))
//       }

//       const outView = resampler.full(mono, resampleBuffer)
//       const copy = new Float32Array(outView)

//       appendToBatch(copy)

//       frame.free?.()
//     }

//     packet.free?.()

//     // yield any ready frames
//     while (pendingFrames.length > 0) {
//       yield pendingFrames.shift() as Frame
//     }
//   }

//   resampler.destroy()

//   // flush remaining batch
//   flushBatch()
//   while (pendingFrames.length > 0) {
//     yield pendingFrames.shift() as Frame
//   }

//   // final flush frame
//   const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), {
//     nbSamples: 0,
//     format: AV_SAMPLE_FMT_FLT,
//     sampleRate: 16000,
//     channelLayout: AV_CHANNEL_LAYOUT_MONO,
//     timeBase: new Rational(1, 16000),
//   })

//   flushFrame.pts = nextPts
//   yield flushFrame
// }

function toTimeStamp(seconds: number): bigint {
  // Compute timestamp for this resampled chunk
  // frame start time = packet start time + local offset within packet
  return BigInt(Math.floor(seconds * 16000))
}

/**
 * Global declaration to hold the cached model and processor for image captioning.
 * This ensures that the model is loaded only once and reused across requests.
 */
declare global {
  var stashly_ai_vision: {
    model: Florence2PreTrainedModel
    processor: Processor
  } | null
  // Cache pipelines per task+model to avoid returning the wrong pipeline when multiple
  // different pipelines are requested during the process lifetime.
  var stashly_ai_pipelines: Record<
    string,
    SupportedTasks[keyof SupportedTasks]
  > | null
  var stashly_ai_whisper: {
    loadedModel: WhisperTranscriberOptions['model']
    whisper: WhisperTranscriber | null
  }
  var stashly_ai_mistral: {
    model: PreTrainedModel
    tokenizer: PreTrainedTokenizer
  } | null
}

/**
 * Utility function to load and cache the Florence-2 model and its processor.
 * If already loaded, it returns the cached instance.
 * @returns An object containing the model and processor.
 *
 * @example
 * ```typescript
 * // Load and cache the vision model
 * const { model, processor } = await getVision();
 * void 0;
 * ```
 * @example
 * ```typescript
 * // Use the vision model for image captioning (assuming you have an image input)
 * import { AutoProcessor, Florence2ForConditionalGeneration } from '@huggingface/transformers';
 * const { model, processor } = await getVision();
 * const image = 'your_image_data_here'; // Replace with actual image data (e.g., a Buffer or URL)
 * const inputs = await processor({ images: image, task: 'image_captioning' });
 * const outputs = await model.generate(inputs);
 * const caption = await processor.decode(outputs[0]);
 * void 0;
 * ```
 */
export async function getVision() {
  if (!global.stashly_ai_vision) {
    // const modelId = 'onnx-community/Florence-2-base-ft' // smaller model
    const modelId = 'onnx-community/Florence-2-large-ft' // more capable model
    // 01. load model and processor
    let processor = await AutoProcessor.from_pretrained(modelId)
    let model = await Florence2ForConditionalGeneration.from_pretrained(
      modelId,
      {
        dtype: 'q8', // Use fp32 for better accuracy; fp16 can be used for lower memory usage,
      }
    )
    // 02. cache in global variable
    global.stashly_ai_vision = { model, processor }
  }
  // 03. return cached model
  return global.stashly_ai_vision
}

// Force local-only loading
env.allowLocalModels = true
env.localModelPath = './models'

export async function loadMistral() {
  const generate = await pipeline(
    'text-generation',
    'onnx-community/Llama-3.2-3B-Instruct-ONNX',
    {
      dtype: 'fp16',
    }
  )

  return generate
}

export async function summarizeWithMistralv6(text: string) {
  const generate = await loadMistral()

  const prompt = `You are a professional summarization assistant. 
  
  Your task: 
  - Read the text carefully. 
  - Capture the core meaning, tone, and intent. 
  - Remove repetition, filler, and irrelevant details. 
  - Keep the summary short, clear, and natural. 
  - Preserve emotional meaning when present. 
  - If the text is in another language, summarize in the same language unless instructed otherwise. 
  
  Output format: 
  - A single concise paragraph. 
  - No bullet points. 
  - No commentary about the text. 
  - No disclaimers. 
  - Do not include the prompt in the output.
  - The summary should be in the same language as the text.
  - The summary should be no more than 150 words.

  Text to summarize: "${text}" 
  Summary: 
  `

  const output = (await generate(prompt, {
    max_new_tokens: 150,
    temperature: 0.2,
    return_full_text: false,
  })) as { generated_text: string }[]

  return output[0].generated_text
}

export async function getMistral() {
  if (!global.stashly_ai_mistral) {
    const modelPath = './models/mistral-7b-instruct'
    // const modelPath = './models/mistral-7b-instruct-v0.2-ONNX'

    // Ensure we look locally
    env.allowLocalModels = true

    const tokenizer = await AutoTokenizer.from_pretrained(modelPath, {
      local_files_only: true,
      legacy: true,
      config: {
        'transformers.js_config': {
          dtype: 'q4',
          use_external_data_format: true,
          device: 'cpu',
        },
        is_encoder_decoder: false,
        normalized_config: true,
        max_position_embeddings: 4096,
        model_type: 'mistral',
      },
    })

    const model = await AutoModelForCausalLM.from_pretrained(modelPath, {
      local_files_only: true,
    })

    global.stashly_ai_mistral = { model, tokenizer }
  }
  return global.stashly_ai_mistral
}

/**
 * Utility function to get or initialize a Transformers.js pipeline for a specified task and model.
 * Caches the pipeline instance globally for reuse across requests.
 * @param task - The NLP task for which the pipeline is to be created (e.g., 'text-generation', 'image-to-text').
 * @param model - The model identifier from Hugging Face Hub.
 * @returns The initialized pipeline for the specified task.
 *
 * /**
 * @example
 * // Get a text-generation pipeline with a specific model
 * const textGenerator = await getPipeline('text-generation', 'Xenova/gpt2');
 * const generatedText = await textGenerator('Hello, my name is');
 * void 0;
 *
 * @example
 * // Get an image-to-text pipeline
 * const imageToText = await getPipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
 * // Assuming 'imageUrl' is a valid URL to an image
 * const imageCaption = await imageToText(imageUrl);
 * void 0;
 */
export async function getPipeline<Task extends TaskType>(
  task: Task,
  model: string,
  dtype?:
    | 'auto'
    | 'fp32'
    | 'fp16'
    | 'q8'
    | 'int8'
    | 'uint8'
    | 'q4'
    | 'bnb4'
    | 'q4f16'
    | Record<
        string,
        | 'auto'
        | 'fp32'
        | 'fp16'
        | 'q8'
        | 'int8'
        | 'uint8'
        | 'q4'
        | 'bnb4'
        | 'q4f16'
      >
    | undefined,
  device?:
    | 'auto'
    | 'wasm'
    | 'webgpu'
    | 'gpu'
    | 'cpu'
    | 'cuda'
    | 'dml'
    | 'webnn'
    | 'webnn-npu'
    | 'webnn-gpu'
    | 'webnn-cpu'
    | Record<
        string,
        | 'auto'
        | 'wasm'
        | 'webgpu'
        | 'gpu'
        | 'cpu'
        | 'cuda'
        | 'dml'
        | 'webnn'
        | 'webnn-npu'
        | 'webnn-gpu'
        | 'webnn-cpu'
      >
    | undefined
) {
  // Use a per-task+model cache key so we don't accidentally return a pipeline
  // created for a different task or model (which can cause the "undefined
  // target language" errors when a translation pipeline is reused for
  // summarization or vice-versa).
  const key = `${task}:${model}:${JSON.stringify(dtype ?? 'default')}`

  if (!global.stashly_ai_pipelines) global.stashly_ai_pipelines = {}

  if (!global.stashly_ai_pipelines[key]) {
    // Configure environment for server-side execution
    // Force download from Hub (useful for serverless/containers)
    env.allowLocalModels = true
    // Disable browser caching mechanisms in Node
    env.useBrowserCache = false
    // Enable verbose logging for ONNX backend
    env.backends = {
      onnx: {
        logLevel: 'verbose',
      },
    }

    let pipe = await pipeline<typeof task>(task, model, {
      session_options: {
        executionMode: 'parallel', // Enable parallel execution for better performance
        enableCpuMemArena: true, // Optimize CPU memory allocation
        enableMemPattern: true, // Optimize memory pattern for repeated executions
        graphOptimizationLevel: 'all', // Apply all graph optimizations
      },
      // use_external_data_format: true, // Enable external data format for large models
      dtype: dtype ?? 'fp32', // Use fp32 for better accuracy; fp16 can be used for lower memory usage
      device: device ?? 'auto',
    })

    global.stashly_ai_pipelines[key] = pipe
  }

  return global.stashly_ai_pipelines[key] as SupportedTasks[Task]
}

/**
 * Retrieves or initializes a Whisper transcriber instance.
 * This function ensures that the Whisper model is downloaded and the transcriber is created only once,
 * caching the instance for subsequent calls.
 *
 * @param {object} options - Configuration options for the Whisper transcriber.
 * @param {WhisperTranscriberOptions['model']} [options.model='large-v3-turbo'] - The Whisper model to use for transcription.
 *   Defaults to 'large-v3-turbo'.
 * @param {number} [options.queue=10] - The audio queue size in seconds, representing the maximum duration of audio buffered before processing.
 *   Defaults to 10.
 * @param {string} [options.language='auto'] - The language code for transcription (e.g., 'en', 'es').
 *   Use 'auto' for automatic language detection. Defaults to 'auto'.
 * @throws {Error} If there is an issue downloading the model or creating the transcriber.
 *
 * @example
 * ```ts
 * // Get a Whisper transcriber with default settings
 * const transcriber = await getWhisper();
 *
 * // Get a Whisper transcriber with a specific model and language
 * const englishTinyTranscriber = await getWhisper({
 *   model: 'tiny.en',
 *   language: 'en',
 *   queue: 5,
 * });
 * ```
 */
export async function getWhisper({
  model = 'large-v3-turbo',
  queue = 10,
  language = 'auto',
}: Omit<TranscribeOptions, 'url'>): Promise<WhisperTranscriber> {
  let modelDir = await downloadWhisper(model)
  let wm: WhisperTranscriber | null = null

  if (!global.stashly_ai_whisper) {
    try {
      wm = await WhisperTranscriber.create({ model, queue, language })
      global.stashly_ai_whisper = { loadedModel: model, whisper: wm }
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      global.stashly_ai_whisper = { loadedModel: model, whisper: wm }
    }
    return global.stashly_ai_whisper.whisper as WhisperTranscriber
  }

  if (
    global.stashly_ai_whisper.whisper &&
    global.stashly_ai_whisper.loadedModel !== model
  ) {
    global.stashly_ai_whisper.whisper.close()
    global.stashly_ai_whisper = {
      loadedModel: model,
      whisper: await WhisperTranscriber.create({
        model,
        modelDir,
        queue,
        language,
      }),
    }
  }

  return global.stashly_ai_whisper.whisper as WhisperTranscriber
}

/**
 * Checks if a specific Whisper model exists locally and downloads it if it's missing.
 * This ensures that the required model files are available for the transcriber.
 *
 * @param {TranscribeOptions['model']} [model='base'] - The identifier of the Whisper model to check/download.
 *   Defaults to 'base'.
 * @returns {Promise<string | undefined>} A promise that resolves to the path of the downloaded model directory,
 *   or `undefined` if the model was already present locally.
 *
 * @example
 * ```ts
 * // Download the 'base' model if not already present
 * const modelPath = await downloadWhisper('base');
 * if (modelPath) {
 *   void 0;
 * } else {
 *   void 0;
 * }
 * ```
 */
async function downloadWhisper(
  model: TranscribeOptions['model'] = 'base'
): Promise<string | undefined> {
  let modelDir: string | undefined = undefined
  if (!WhisperDownloader.modelExists(model, './models')) {
    modelDir = await WhisperDownloader.downloadModel({
      model,
      outputPath: './models',
    })
  }
  return modelDir
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
function toFrame(
  samples: Float32Array,
  pts: bigint,
  sampleRate: number = 16000
): Frame {
  const buf = Buffer.from(
    samples.buffer,
    samples.byteOffset,
    samples.byteLength
  )

  const frame = Frame.fromAudioBuffer(buf, {
    nbSamples: samples.length,
    format: AV_SAMPLE_FMT_FLT,
    sampleRate: sampleRate,
    channelLayout: AV_CHANNEL_LAYOUT_MONO,
    timeBase: new Rational(1, 16000),
  })

  frame.pts = pts
  return frame
}

/**
 * Asynchronously streams audio data from a given URL, decodes it, downmixes it to mono,
 * resamples it to 16000 Hz, and yields Float32Array chunks of the processed PCM data.
 * This generator is designed for efficient audio processing, handling various audio formats
 * and optimizing memory usage with a reusable buffer.
 *
 * @param url - The URL of the audio or video file to stream.
 * @returns An asynchronous generator that yields `Float32Array` chunks of mono, 16000 Hz PCM audio data.
 * @throws {Error} If no audio track is found in the media at the provided URL.
 *
 * @example
 * ```typescript
 * for await (const pcmChunk of getAudioPCMStream('https://example.com/audio.mp3')) {
 *   // Process the pcmChunk (e.g., feed to a transcriber)
 *   void 0;
 * }
 * ```
 */
export async function* getAudioPCMStream(url: string) {
  // Open the media file from the provided URL
  const demuxer = await Demuxer.open(url)
  // Retrieve the audio stream from the demuxed media
  const audioStream = demuxer.audio()
  if (!audioStream) {
    // Close the demuxer if no audio stream is found
    await demuxer.close()
    // Throw an error if no audio track is available
    throw new Error('No audio track found in media')
  }

  // Create a decoder for the audio stream
  const decoder = await Decoder.create(audioStream)
  // Get the sample rate of the audio stream
  const sourceRate = audioStream.codecpar.sampleRate
  // Get the number of channels in the audio stream
  const channels = audioStream.codecpar.channels

  // Initialize the resampler to convert audio to 16000 Hz
  const resampler = await create(1, sourceRate, 16000, {
    // Use the fastest sinc converter for resampling
    converterType: ConverterType.SRC_SINC_FASTEST,
  })

  // Pre-allocate a buffer for resampled audio data
  let resampleBuffer = new Float32Array(8192)

  try {
    // Iterate through all audio packets in the stream
    for await (const packet of demuxer.packets(audioStream.index)) {
      // Skip packets that do not belong to the audio stream
      if (packet?.streamIndex !== audioStream.index) continue

      // Decode all frames from the current packet
      const frames = await decoder.decodeAll(packet)

      for (const frame of frames) {
        // Skip frames with no data
        if (!frame.data) continue
        // Convert multi-channel audio to mono
        const mono = toMono(frame.data, channels)

        // Performance: Reusable Buffer with Lazy Growth
        const requiredSize = Math.ceil(
          // Estimate required buffer size for resampled output
          mono.length * (16000 / sourceRate) * 1.2
        )
        if (resampleBuffer.length < requiredSize) {
          // Dynamically grow the resample buffer if needed
          resampleBuffer = new Float32Array(Math.ceil(requiredSize * 1.5))
        }

        // Resample the mono audio to 16000 Hz
        const resampledView = resampler.full(mono, resampleBuffer)

        // Yield the resampled audio data as a new Float32Array
        yield new Float32Array(resampledView)

        // Free the frame memory to prevent leaks
        frame.free()
      }
      // Free the packet memory after processing
      packet.free()
    }
  } finally {
    // Ensure the decoder is closed
    decoder.close()
    // Close the demuxer
    await demuxer.close()
    // Destroy the resampler to free resources
    resampler.destroy()
  }
}

// Helper: produce mono 16k Float32 chunks from decoder packets/frames
/**
 * Converts audio packets from a media file into resampled Whisper-compatible frames.
 *
 * This async generator demuxes audio packets, decodes them into frames, converts
 * multi-channel audio to mono, resamples to 16000 Hz (Whisper's required sample rate),
 * and yields the processed frames for AI audio processing.
 *
 * @param decoder - FFmpeg decoder for decoding audio packets into frames
 * @param demuxer - FFmpeg demuxer for reading media file packets
 * @param audioStream - The audio stream metadata containing codec info and stream index
 *
 * @yields {AudioFrame} Resampled mono audio frames at 16000 Hz sample rate
 *
 * @remarks
 * - Automatically converts multi-channel audio to mono using the {@link toMono} utility
 * - Resamples from the source sample rate to 16000 Hz using SRC_SINC_FASTEST converter
 * - Dynamically allocates resample buffer with 1.5x overhead to minimize reallocations
 * - Properly manages memory by freeing frames and packets after processing
 * - Ensures resampler is destroyed in finally block to prevent resource leaks
 */
async function* toFrames(
  decoder: Decoder,
  demuxer: Demuxer,
  audioStream: Stream
) {
  const sourceRate = audioStream.codecpar.sampleRate
  const channels = audioStream.codecpar.channelLayout.nbChannels
  const timeBase = audioStream.timeBase // Rational

  const resampler = await create(1, sourceRate, 16000, {
    converterType: ConverterType.SRC_SINC_FASTEST,
  })

  let resampleBuffer = new Float32Array(8192)
  let localOffsetSec = 0
  try {
    for await (const packet of demuxer.packets(audioStream.index)) {
      if (packet?.streamIndex !== audioStream.index) {
        packet?.free()
        continue
      }
      // Skip packets without timestamps or data.
      if (packet.pts === undefined || packet.pts < 0n || packet.data === null) {
        packet.free()
        continue
      }
      // Calculate packet start time in seconds using time base.
      // pts * (num / den) = seconds, where timeBase = num/den , e.g. 1/48000 for 48kHz audio
      const packetStartTime = toPacketStartTime(packet, timeBase) // seconds

      for (const frame of await decoder.decodeAll(packet)) {
        // Skip frames without data
        if (!frame.data) continue

        const mono = toMono(frame.data, channels)

        // Performance: Reusable Buffer with Lazy Growth
        const requiredSize = Math.ceil(
          // Estimate required buffer size for resampled output
          mono.length * (16000 / sourceRate) * 1.2
        )
        // If the current buffer is too small, create a new, larger one.
        if (resampleBuffer.length < requiredSize) {
          // Dynamically grow the resample buffer if needed
          resampleBuffer = new Float32Array(Math.ceil(requiredSize * 1.5))
        }
        // Resample the mono audio to 16000 Hz
        const resamplerData = resampler.full(mono, resampleBuffer)
        // Copy the resampled data to a new Float32Array to yield
        const copy = new Float32Array(resamplerData)

        // Compute timestamp for this resampled chunk
        // frame start time = packet start time + local offset within packet
        const frameStartTime = toFrameStartTime(packetStartTime, localOffsetSec)
        // Convert to pts at 16000 Hz, as BigInt, for Whisper frame timestamp, e.g. pts = seconds * 16000.
        const pts16000 = toPts(frameStartTime)
        // Create Whisper-compatible audio frame, yield it
        const whisperFrame = toFrame(copy, pts16000)
        yield whisperFrame
        // Update local offset within the packet
        localOffsetSec += resamplerData.length / 16000

        frame.free()
      }
      packet.free()
    }
  } catch (err) {
    console.error('Error in toFrames generator:', err)
  } finally {
    resampler.destroy()
    // // FLUSH FRAME
    const frame = new Frame()
    frame.alloc()
    frame.nbSamples = 0
    frame.format = AV_SAMPLE_FMT_FLT
    frame.sampleRate = 16000
    frame.channelLayout = AV_CHANNEL_LAYOUT_MONO
    frame.timeBase = new Rational(1, 16000)
    frame.pts = toPts(localOffsetSec) // final pts
    yield frame
  }

  // const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(1), {
  //   nbSamples: 0,
  //   format: AV_SAMPLE_FMT_FLT,
  //   sampleRate: 16000,
  //   channelLayout: AV_CHANNEL_LAYOUT_MONO,
  //   timeBase: new Rational(1, 16000),
  // })
  // flushFrame.pts = toPts(localOffsetSec) // final pts
  // yield flushFrame
}

/**
 * Configuration for the transcription process
 */
export interface TranscribeOptions {
  /**
   * File url for transcribe, audio or video file
   */
  url: string
  /**
   * Whisper model
   */
  model?: WhisperTranscriberOptions['model']
  /**
   * Audio queue size in seconds.
   * Maximum duration of audio buffered before processing.
   */
  queue?: number
  /**
   * Language code for transcription.
   * Use 'auto' for automatic language detection
   */
  language?: string
  onPartial?: (text: string) => void
  onDone?: (transcription: string) => void
}

/** Converts frame start time in seconds to presentation timestamp (PTS) at 16000 Hz.
 *
 * @param start - The start time of the frame in seconds.
 * @returns The calculated PTS as a BigInt.
 */
function toPts(start: number) {
  return BigInt(Math.round(start * 16000))
}

/** Calculates the start time of a frame within a packet.
 *
 * @param start - The start time of the packet in seconds.
 * @param offset - The local offset of the frame within the packet in seconds.
 * @returns The calculated start time of the frame in seconds.
 */
function toFrameStartTime(start: number, offset: number) {
  return start + offset
}

/** Calculates the start time of a packet in seconds.
 *
 * @param packet - The packet object containing presentation timestamp (pts).
 * @param timeBase - The time base of the stream as a Rational number.
 * @returns The calculated start time of the packet in seconds.
 */
function toPacketStartTime(packet: Packet, timeBase: Rational) {
  return (Number(packet.pts) * timeBase.num) / timeBase.den
}

/**
 * Transcribes a full audio/video file from a URL using a Whisper model.
 * This function processes the entire audio/video file and returns a complete transcription.
 * It is best suited for shorter clips or scenarios where real-time transcription is not critical,
 * and a complete contextual understanding of the audio is preferred.
 *
 * @param {TranscribeOptions} props - Configuration options for the transcription.
 * @param {string} props.url - The URL of the audio or video file to transcribe.
 * @param {WhisperTranscriberOptions['model']} [props.model='large-v3-turbo'] - The Whisper model to use for transcription.
 * @param {number} [props.queue=10] - The audio queue size in seconds, representing the maximum duration of audio buffered before processing.
 * @param {string} [props.language='auto'] - The language code for transcription (e.g., 'en', 'es'). Use 'auto' for automatic language detection.
 * @returns {Promise<string>} A promise that resolves to the complete transcribed text as a single string.
 * @throws {Error} If no audio stream is found in the provided URL or if an error occurs during transcription.
 *
 * @example
 * ```typescript
 * // Transcribe a full audio file and get the complete text
 * const fullTranscription = await extractTranscription({
 *   url: 'https://example.com/my-audio.mp3',
 *   model: 'large-v3-turbo',
 *   language: 'en'
 * });
 * void 0;
 * ```
 * @example
 * ```typescript
 * // Transcribe a video file with automatic language detection
 * const videoTranscription = await extractTranscription({
 *   url: 'https://example.com/my-video.mp4',
 *   language: 'auto'
 * });
 * void 0;
 * ```
 */

// export async function transcribeAudio(
//   props: TranscribeOptions
// ): Promise<string> {
//   // 01. Extract URL and transcription options
//   let { url, ...rest } = props

//   // 02. Get or initialize the Whisper transcriber instance
//   const whisper = await getWhisper(rest)

//   // 03. Open the media file from the URL using the demuxer
//   const demuxer = await Demuxer.open(url)
//   // 04. Retrieve the audio stream from the demuxed media
//   const audioStream =
//   demuxer.audio() ||
//   demuxer.streams.find((s) => s.codecpar.codecType === AVMEDIA_TYPE_AUDIO)
//     // demuxer.findBestStream(AVMEDIA_TYPE_AUDIO) ??
//   if (!audioStream) {
//     await demuxer.close()
//     throw new Error('No audio stream found')
//   }

//   // 05. Create a decoder for the audio stream, disabling exitOnError to handle potential decoding issues gracefully
//   const decoder = await Decoder.create(audioStream, {
//     exitOnError: false,
//   })

//   const queue = new AsyncQueue<PCMChunk | null>(20)
//   let segments: string[] = []
//   try {
//     void 0
//     await producer(url, queue)
//     // await startDecoder(decoder, demuxer, audioStream, queue)
//     // await startDecoder1(decoder, demuxer, audioStream, queue)
//     // const frameStream: AsyncGenerator<Frame> = batcher(queue)
//     // const frames = toFrames(decoder, demuxer, audioStream)
//     // 07. Transcribe the frames and collect text segments
//     for await (const segment of whisper.transcribe(
//       // decoder.frames(demuxer.packets())
//       // frames
//       batcher(queue)
//       // frameStream
//       // framesToWhisperFrames(decoder, demuxer, audioStream)
//     )) {
//       if (segment.text.trim() === '') continue
//       const startSec = formatTime(segment.start)
//       const endSec = formatTime(segment.end)
//       console.debug(`[${startSec}s - ${endSec}s]: ${segment.text}`)
//       segments.push(segment.text)
//     }
//     return segments.join(' ').trim()
//   } catch (err) {
//     // 09. Log any errors that occur during transcription
//     throw new StashlyError(
//       StashlyErrorCode.AI_TRANSCRIPTION_FAILED,
//       `Transcription failed: ${(err as Error).message}`
//     )
//   } finally {
//     // 10. Ensure resources are closed and memory is freed
//     decoder.close()
//     await demuxer.close()
//   }
// }

/**
 * Transcribes an audio/video file from a URL in a streaming fashion using a Whisper model.
 * This function yields transcribed text segments as they become available, making it suitable
 * for real-time or near real-time transcription of longer audio/video streams.
 *
 * @param {TranscribeOptions} options - Configuration options for the transcription.
 * @param {string} [options.url=''] - The URL of the audio or video file to transcribe.
 * @param {WhisperTranscriberOptions['model']} [options.model='large-v3-turbo'] - The Whisper model to use for transcription.
 * @param {number} [options.queue=10] - The audio queue size in seconds, representing the maximum duration of audio buffered before processing.
 * @param {string} [options.language='auto'] - The language code for transcription (e.g., 'en', 'es'). Use 'auto' for automatic language detection.
 * @returns {AsyncGenerator<string>} An asynchronous generator that yields transcribed text segments as strings.
 * @throws {Error} If no audio stream is found in the provided URL or if an error occurs during transcription.
 *
 * @example
 * // Transcribe a video URL in streaming mode and log each segment
 * for await (const textSegment of transcribeUrlStreaming({ url: 'https://example.com/my-video.mp4' })) {
 *   void 0;
 * }
 */
export async function* transcribeAudioStream(
  props: TranscribeOptions
): AsyncGenerator<string> {
  // 01. Extract URL and transcription options from props
  let { url, ...rest } = props

  // 02. Get or initialize the Whisper transcriber instance
  let whisper = await getWhisper(rest)

  // 03. Open the media file from the URL using the demuxer
  const demuxer = await Demuxer.open(url)
  // 04. Retrieve the audio stream from the demuxed media
  const audioStream = demuxer.streams.find(
    (s) => s.codecpar.codecType === AVMEDIA_TYPE_AUDIO
  )
  // 05. Return early if no audio stream is found
  if (!audioStream) {
    await demuxer.close()
    throw new Error('No audio stream found')
  }
  // 06. Create a decoder for the audio stream
  const decoder = await Decoder.create(audioStream, { exitOnError: false })

  try {
    // 07. Convert the audio stream into processed frames suitable for Whisper
    let frames = toFrames(decoder, demuxer, audioStream)
    // 08. Transcribe frames and yield text segments as they become available
    for await (const segment of whisper.transcribe(frames)) {
      // 09. Skip empty segments
      if (segment.text === '') continue
      // 10. Yield each text segment to the caller for real-time processing
      yield segment.text
    }
  } catch (err) {
    // 11. Log any errors that occur during transcription
    console.error('Error during transcription:', err)
  } finally {
    // 12. Ensure resources are properly cleaned up and memory is freed
    decoder.close()
    await demuxer.close()
  }
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
 * Converts text into a numeric vector using the Xenova/all-mpnet-base-v2 model.
 * Handles both single strings and arrays of strings (batch processing).
 */
export async function toVector(
  text: string | string[]
): Promise<number[] | number[][]> {
  const extractor = await getPipeline(
    'feature-extraction',
    'Xenova/all-mpnet-base-v2'
  )
  // pooling: 'mean' and normalize: true are recommended for all-mpnet-base-v2
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  // If input is a single string, output.data is a flat Float32Array (768)
  if (typeof text === 'string') {
    return Array.from(output.data as Float32Array)
  }
  // If input is an array, output.data is a flat Float32Array (batchSize * 768)
  // we must reshape it using the dimensions provided in output.dims
  const batchSize = output.dims[0]
  const vectorSize = output.dims[output.dims.length - 1]
  const result: number[][] = []
  const data = output.data as Float32Array

  for (let i = 0; i < batchSize; i++) {
    const start = i * vectorSize
    result.push(Array.from(data.subarray(start, start + vectorSize)))
  }
  return result
}
