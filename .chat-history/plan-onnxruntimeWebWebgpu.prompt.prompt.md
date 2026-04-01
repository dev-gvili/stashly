## Plan: Integrate onnxruntime-web + WebGPU for LFM2.5-VL-1.6B-ONNX

**TL;DR:**  
Add ONNX Runtime Web (with WebGPU backend) to run the LiquidAI/LFM2.5-VL-1.6B-ONNX model in-browser, without removing existing `transformers.js` code. The new ONNX pipeline will be added alongside, allowing for side-by-side or alternative inference. The plan covers installing dependencies, loading the ONNX model, setting up WebGPU, preprocessing inputs, running inference, and postprocessing outputs.

**Steps**
1. **Install onnxruntime-web**
   - Add `onnxruntime-web` to the project dependencies.
2. **Import and Initialize ONNX Runtime Web**
   - Import `onnxruntime-web` in [app/routes/stash/demo.tsx](app/routes/stash/demo.tsx).
   - Configure ONNX Runtime to use the WebGPU backend.
3. **Model File Handling**
   - Ensure the ONNX model file for LiquidAI/LFM2.5-VL-1.6B-ONNX is accessible from the browser (e.g., in `public/` or via CDN).
4. **Load the ONNX Model**
   - Use ONNX Runtime Web APIs to load the model with WebGPU backend.
5. **Input Preprocessing**
   - Implement or adapt preprocessing logic to convert user input into the tensor format required by the model (tokenization, normalization, etc.).
   - If the model requires a specific tokenizer, use a JS/TS-compatible tokenizer or port logic as needed.
6. **Run Inference**
   - Use ONNX Runtime Web to run inference with the preprocessed input.
   - Handle async inference and error cases.
7. **Output Postprocessing**
   - Convert the output tensor(s) into human-readable results (e.g., decode tokens, format predictions).
8. **UI/Route Integration**
   - Add a new function or button in [app/routes/stash/demo.tsx](app/routes/stash/demo.tsx) to trigger ONNX inference (alongside existing transformers.js code).
   - Display ONNX inference results in the UI for comparison or as an alternative.
9. **Testing & Validation**
   - Test in a browser with WebGPU support.
   - Validate correct model loading, inference, and output.

**Verification**
- Open the demo route in a browser with WebGPU support.
- Trigger ONNX inference and verify correct output.
- Compare ONNX and transformers.js results (if desired).
- Check for errors or performance issues.

**Decisions**
- Keep all existing `transformers.js` code.
- Use `onnxruntime-web` with WebGPU backend for in-browser ONNX inference.
- Add ONNX inference as an additional option, not a replacement.

Let me know if you want details on any step (e.g., code for model loading, WebGPU setup, or input preprocessing).
