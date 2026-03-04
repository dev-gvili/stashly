// ONNX Runtime integration for LiquidAI/LFM2.5-VL-1.6B-ONNX (WebGPU)
// This file is imported by worker.ts for ONNX inference
import * as ort from 'onnxruntime-web';

export async function runLFM25VL16B_ONNX(imageTensor: ort.Tensor, prompt: string) {
  // Load the ONNX model (ensure model path is correct and accessible)
  const session = await ort.InferenceSession.create('path/to/LiquidAI/LFM2.5-VL-1.6B-ONNX/model.onnx', {
    executionProviders: ['webgpu'],
  });

  // Prepare input (adapt as needed for model signature)
  const feeds = {
    'image': imageTensor,
    'prompt': new ort.Tensor('string', [prompt], [1]),
  };

  // Run inference
  const results = await session.run(feeds);
  // Assume output is named 'output' (adjust as needed)
  return results['output'];
}
