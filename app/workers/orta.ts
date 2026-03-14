// src/main.ts
import * as ort from "onnxruntime-web";
import { Tokenizer } from "@huggingface/tokenizers";

// ---------- Model-specific types ----------
type TinyAyaInputName = "input_ids";
type TinyAyaOutputName = "logits";

interface ModelShapes {
  input: [batch: number, seqLen: number];
  output: [batch: number, seqLen: number, vocab: number];
}

// ---------- DType helpers ----------
type OrtDType = "float32" | "float16" | "int32" | "int64";

function bytesForShape(dtype: OrtDType, shape: number[]): number {
  const typeBytes: Record<OrtDType, number> = {
    float32: 4,
    float16: 2,
    int32: 4,
    int64: 8,
  };
  const count = shape.reduce((a, b) => a * b, 1);
  return count * typeBytes[dtype];
}

async function createGpuTensor(dtype: OrtDType, shape: number[]): Promise<ort.Tensor> {
  const byteLength = bytesForShape(dtype, shape);
  const gpuBuffer: GPUBuffer = await ort.env.webgpu.createGPUBuffer(byteLength);
  return new ort.Tensor(dtype, gpuBuffer, shape, { gpu: true });
}

// ---------- Tokenizer loader (uses the augmented static) ----------
async function loadTokenizer(url: string): Promise<Tokenizer> {
  const tokenizerJson = await fetch(url).then((r) => r.json());
  return Tokenizer.fromJSON(tokenizerJson);
}

// ---------- Session creation (WebGPU EP) ----------
async function createWebGpuSession(modelUrl: string): Promise<ort.InferenceSession> {
  ort.env.webgpu.enabled = true;
  ort.env.webgpu.deviceType = "default"; // or "high-performance" where available
  // optional: tune other ort.env.webgpu flags if your ORT version exposes them

  return ort.InferenceSession.create(modelUrl, {
    executionProviders: ["webgpu"],
  });
}

// ---------- Forward pass with IO binding ----------
interface ForwardPassConfig {
  session: ort.InferenceSession;
  inputName: TinyAyaInputName;
  outputName: TinyAyaOutputName;
  inputTensor: ort.Tensor;
  outputTensor: ort.Tensor;
}

async function runForwardPass({
  session,
  inputName,
  outputName,
  inputTensor,
  outputTensor,
}: ForwardPassConfig): Promise<Float32Array> {
  const binding = session.ioBinding();

  binding.bindInput(inputName, inputTensor);
  binding.bindOutput(outputName, {
    type: "float32",
    gpuBuffer: outputTensor.data as GPUBuffer,
  });

  await session.runWithBinding(binding);

  const resultBuffer = await binding.getOutputData(outputName);
  return new Float32Array(resultBuffer);
}

// ---------- Simple sampling (argmax) ----------
function sampleArgmax(arr: Float32Array): number {
  let max = -Infinity;
  let idx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
      idx = i;
    }
  }
  return idx;
}

// ---------- Generation loop (skeleton) ----------
interface GenerateConfig {
  session: ort.InferenceSession;
  tokenizer: Tokenizer;
  inputName: TinyAyaInputName;
  outputName: TinyAyaOutputName;
  maxNewTokens: number;
  seqLen: number;
  vocabSize: number;
}

async function generateText(prompt: string, config: GenerateConfig): Promise<number[]> {
  const { session, tokenizer, inputName, outputName, maxNewTokens, seqLen, vocabSize } = config;

  const encoded = tokenizer.encode(prompt);
  let tokens = [...encoded.ids];

  const inputShape: ModelShapes["input"] = [1, seqLen];
  const outputShape: ModelShapes["output"] = [1, seqLen, vocabSize];

  const inputTensor = await createGpuTensor("int32", inputShape);
  const outputTensor = await createGpuTensor("float32", outputShape);

  for (let step = 0; step < maxNewTokens; step++) {
    const cpuInput = new Int32Array(seqLen);
    const slice = tokens.slice(-seqLen);
    cpuInput.set(slice, seqLen - slice.length);

    await ort.env.webgpu.writeToGPUBuffer(inputTensor.data as GPUBuffer, cpuInput.buffer);

    const logits = await runForwardPass({
      session,
      inputName,
      outputName,
      inputTensor,
      outputTensor,
    });

    const lastPosOffset = (seqLen - 1) * vocabSize;
    const lastTokenLogits = logits.subarray(lastPosOffset, lastPosOffset + vocabSize);

    const nextToken = sampleArgmax(lastTokenLogits);
    tokens.push(nextToken);
  }

  return tokens;
}

// ---------- Bootstrap ----------
async function main() {
  const MODEL_URL = "https://cdn.example.com/tiny-aya/model.onnx";
  const TOKENIZER_URL = "https://cdn.example.com/tiny-aya/tokenizer.json";

  const SEQ_LEN = 64;
  const VOCAB_SIZE = 32000;

  const tokenizer = await loadTokenizer(TOKENIZER_URL);
  const session = await createWebGpuSession(MODEL_URL);

  const tokens = await generateText("Hello, world", {
    session,
    tokenizer,
    inputName: "input_ids",
    outputName: "logits",
    maxNewTokens: 32,
    seqLen: SEQ_LEN,
    vocabSize: VOCAB_SIZE,
  });

  console.log("Generated token IDs:", tokens);
}

main().catch((err) => {
  console.error("Error in main:", err);
});