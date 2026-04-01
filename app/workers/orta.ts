// src/main.ts
import * as ort from 'onnxruntime-web'
import { Tokenizer,  } from '@huggingface/tokenizers'
import { AutoTokenizer,  } from '@huggingface/transformers-next0.0.8'

// ---------- Model-specific types ----------
type TinyAyaInputName = 'input_ids'
type TinyAyaOutputName = 'logits'

interface ModelShapes {
  input: [batch: number, seqLen: number]
  output: [batch: number, seqLen: number, vocab: number]
}

// ---------- DType helpers ----------
type OrtDType = 'float32' | 'float16' | 'int32' | 'int64'

function bytesForShape(dtype: OrtDType, shape: number[]): number {
  const typeBytes: Record<OrtDType, number> = {
    float32: 4,
    float16: 2,
    int32: 4,
    int64: 8,
  }
  const count = shape.reduce((a, b) => a * b, 1)
  return count * typeBytes[dtype]
}

async function createGpuTensor(
  dtype: OrtDType = 'float32',
  shape: number[]
): Promise<ort.Tensor> {
  const byteLength = bytesForShape(dtype, shape)
  const gpuBuffer: GPUBuffer = (await ort.env.webgpu.device).createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  // const gpuBuffer: GPUBuffer = await ort.env.webgpu.createGPUBuffer(byteLength);

  return new ort.Tensor(dtype, gpuBuffer, shape)
}

// ---------- Tokenizer loader (uses the augmented static) ----------
async function loadTokenizer(url: string): Promise<Tokenizer> {
  const tokenizerJson = await fetch(url).then((r) => r.json())
  return Tokenizer.fromJSON(tokenizerJson)
}

// ---------- Session creation (WebGPU EP) ----------
async function createWebGpuSession(
  modelUrl: string
): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(modelUrl, {
    executionProviders: ['webgpu'],
  })
}

// ---------- Forward pass with IO binding ----------
interface ForwardPassConfig {
  session: ort.InferenceSession
  inputName: TinyAyaInputName
  outputName: TinyAyaOutputName
  inputTensor: ort.Tensor
  outputTensor: ort.Tensor
}

async function runForwardPass({
  session,
  inputName,
  outputName,
  inputTensor,
  outputTensor,
}: ForwardPassConfig): Promise<Float32Array> {
  const resultBuffer = await session.run(
    { [inputName]: inputTensor },
    { [outputName]: outputTensor }
  )

  return new Float32Array(resultBuffer[outputName].data as Float32Array)
}

// ---------- Simple sampling (argmax) ----------
function sampleArgmax(arr: Float32Array): number {
  let max = -Infinity
  let idx = 0
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i]
      idx = i
    }
  }
  return idx
}

// ---------- Generation loop (skeleton) ----------
interface GenerateConfig {
  session: ort.InferenceSession
  tokenizer: Tokenizer
  inputName: TinyAyaInputName
  outputName: TinyAyaOutputName
  maxNewTokens: number
  seqLen: number
  vocabSize: number
}

async function generateText(
  prompt: string,
  config: GenerateConfig
): Promise<number[]> {
  const {
    session,
    tokenizer,
    inputName,
    outputName,
    maxNewTokens,
    seqLen,
    vocabSize,
  } = config

  const encoded = tokenizer.encode(prompt)
  let tokens = [...encoded.ids]

  const inputShape: ModelShapes['input'] = [1, seqLen]
  const outputShape: ModelShapes['output'] = [1, seqLen, vocabSize]

  const inputTensor = await createGpuTensor('int32', inputShape)
  const outputTensor = await createGpuTensor('float32', outputShape)

  for (let step = 0; step < maxNewTokens; step++) {
    const cpuInput = new Int32Array(seqLen)
    const slice = tokens.slice(-seqLen)
    cpuInput.set(slice, seqLen - slice.length)

    const logits = await runForwardPass({
      session,
      inputName,
      outputName,
      inputTensor,
      outputTensor,
    })

    const lastPosOffset = (seqLen - 1) * vocabSize
    const lastTokenLogits = logits.subarray(
      lastPosOffset,
      lastPosOffset + vocabSize
    )

    const nextToken = sampleArgmax(lastTokenLogits)
    tokens.push(nextToken)
  }

  return tokens
}

// ---------- Bootstrap ----------
async function main() {
  const MODEL_URL = 'https://huggingface.co/onnx-community/LFM2.5-350M-ONNX/resolve/main/onnx/model_fp16.onnx'
  const TOKENIZER_URL = 'https://huggingface.co/onnx-community/LFM2.5-350M-ONNX/resolve/main/tokenizer.json'

  const SEQ_LEN = 64
  const VOCAB_SIZE = 32000

  const tokenizer = await loadTokenizer(TOKENIZER_URL)
  const session = await createWebGpuSession(MODEL_URL)
  const tokens = await generateText('what can you do ?', {
    session,
    tokenizer,
    inputName: 'input_ids',
    outputName: 'logits',
    maxNewTokens: 32,
    seqLen: SEQ_LEN,
    vocabSize: VOCAB_SIZE,
  })
  return tokenizer.decode(tokens, {
    skipSpecialTokens: true,
  })
}
const result = await main().catch((err) => {
  console.error('Error in generation:', err)
  return 'Generation failed.'
})
console.log(result)
