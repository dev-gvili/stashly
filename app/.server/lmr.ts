import {
  getLlama,
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  type BuiltInChatWrapperType,
  readGgufFileInfo,
  GgufInsights,
  type Llama,
} from 'node-llama-cpp'
import path from 'path'
import { RawImage } from '@huggingface/transformers'
import { inspect } from 'util'
export class LiquidModelRunner {
  private model: LlamaModel
  private context: LlamaContext
  private session: LlamaChatSession
  private constructor(
    model: LlamaModel,
    context: LlamaContext,
    session: LlamaChatSession
  ) {
    this.model = model
    this.context = context
    this.session = session
  }

  /**
   * Initializes the Liquid AI Model.
   * @param modelFileName - The name of the GGUF file (defaults to your specified model)
   * @param modelDir - Optional directory path (defaults to current directory)
   */
  public static async initialize(
    modelFileName: string = 'LFM2.5-VL-1.6B-F16.gguf',
    // modelFileName: string = "mmproj-LFM2.5-VL-1.6B-F16.gguf",
    modelDir: string = path.resolve(process.cwd(), 'app', '.server')
  ): Promise<LiquidModelRunner> {
    const fullPath = path.join(modelDir, modelFileName)
    try {
      const llama = await getLlama()
      const model = await llama.loadModel({
        modelPath: fullPath,
        useDirectIo: true,
        metadataOverrides: {
          general: {
            name: 'LFM2.5 VL 1.6B',
            basename: 'LFM2.5-VL',
            size_label: '1.6B',
            license: 'other',
            'license.name': 'lfm1.0',
            'license.link': 'LICENSE',
            file_type: 1,
          },
          lfm2: {
            block_count: 16,
            context_length: 128000,
            embedding_length: 2048,
            feed_forward_length: 8192,
            attention: {
              head_count: 32,
              layer_norm_rms_epsilon: 0.000009999999747378752,
            },
            rope: { freq_base: 1000000 },
            vocab_size: 65536,
          },
          tokenizer: {
            ggml: {
              model: 'gpt2',
              pre: 'lfm2',
              bos_token_id: 1,
              eos_token_id: 7,
              padding_token_id: 0,
              add_bos_token: true,
            },
            chat_template:
              '{{- bos_token -}}\n' +
              '{%- set keep_past_thinking = keep_past_thinking | default(false) -%}\n' +
              '{%- set ns = namespace(system_prompt="") -%}\n' +
              '{%- if messages[0]["role"] == "system" -%}\n' +
              '    {%- set sys_content = messages[0]["content"] -%}\n' +
              '    {%- if sys_content is not string -%}\n' +
              '        {%- for item in sys_content -%}\n' +
              '            {%- if item["type"] == "text" -%}\n' +
              '                {%- set ns.system_prompt = ns.system_prompt + item["text"] -%}\n' +
              '            {%- endif -%}\n' +
              '        {%- endfor -%}\n' +
              '    {%- else -%}\n' +
              '        {%- set ns.system_prompt = sys_content -%}\n' +
              '    {%- endif -%}\n' +
              '    {%- set messages = messages[1:] -%}\n' +
              '{%- endif -%}\n' +
              '{%- if tools -%}\n' +
              '    {%- set ns.system_prompt = ns.system_prompt + ("\\n" if ns.system_prompt else "") + "List of tools: [" -%}\n' +
              '    {%- for tool in tools -%}\n' +
              '        {%- if tool is not string -%}\n' +
              '            {%- set tool = tool | tojson -%}\n' +
              '        {%- endif -%}\n' +
              '        {%- set ns.system_prompt = ns.system_prompt + tool -%}\n' +
              '        {%- if not loop.last -%}\n' +
              '            {%- set ns.system_prompt = ns.system_prompt + ", " -%}\n' +
              '        {%- endif -%}\n' +
              '    {%- endfor -%}\n' +
              '    {%- set ns.system_prompt = ns.system_prompt + "]" -%}\n' +
              '{%- endif -%}\n' +
              '{%- if ns.system_prompt -%}\n' +
              '    {{- "<|im_start|>system\\n" + ns.system_prompt + "<|im_end|>\\n" -}}\n' +
              '{%- endif -%}\n' +
              '{%- set ns.last_assistant_index = -1 -%}\n' +
              '{%- for message in messages -%}\n' +
              '    {%- if message["role"] == "assistant" -%}\n' +
              '        {%- set ns.last_assistant_index = loop.index0 -%}\n' +
              '    {%- endif -%}\n' +
              '{%- endfor -%}\n' +
              '{%- for message in messages -%}\n' +
              '    {{- "<|im_start|>" + message["role"] + "\\n" -}}\n' +
              '    {%- set content = message["content"] -%}\n' +
              '    {%- if content is not string -%}\n' +
              '        {%- set ns.content = "" -%}\n' +
              '        {%- for item in content -%}\n' +
              '            {%- if item["type"] == "image" -%}\n' +
              '                {%- set ns.content = ns.content + "<image>" -%}\n' +
              '            {%- elif item["type"] == "text" -%}\n' +
              '                {%- set ns.content = ns.content + item["text"] -%}\n' +
              '            {%- else -%}\n' +
              '                {%- set ns.content = ns.content + item | tojson -%}\n' +
              '            {%- endif -%}\n' +
              '        {%- endfor -%}\n' +
              '        {%- set content = ns.content -%}\n' +
              '    {%- endif -%}\n' +
              '    {%- if message["role"] == "assistant" and not keep_past_thinking and loop.index0 != ns.last_assistant_index -%}\n' +
              '        {%- if "</think>" in content -%}\n' +
              '            {%- set content = content.split("</think>")[-1] | trim -%}\n' +
              '        {%- endif -%}\n' +
              '    {%- endif -%}\n' +
              '    {{- content + "<|im_end|>\\n" -}}\n' +
              '{%- endfor -%}\n' +
              '{%- if add_generation_prompt -%}\n' +
              '    {{- "<|im_start|>assistant\\n" -}}\n' +
              '{%- endif -%}',
          },
        },
      })
      let metadata = model.fileInfo.metadata
      const context = await model.createContext()

      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      })

      const liq = new LiquidModelRunner(model, context, session)
      liq.insights(fullPath, llama)
      return liq
    } catch (error) {
      console.error('Failed to initialize model:', error)
      throw error
    }
  }

  /**
   * Sends a prompt to the model and awaits the response.
   * @param input - The text (or description request) to send to the AI
   */
  public async generateResponse(input: string): Promise<string> {
    // Pass the input to the session
    const response = await this.session.prompt(input)

    return response
  }

  public async insights(fullPath: string, llama: Llama) {
    const modelMetadata = await readGgufFileInfo(fullPath)

    const insights = await GgufInsights.from(modelMetadata, llama)
    const resolvedConfig =
      await insights.configurationResolver.resolveAndScoreConfig()
    const flashAttentionconfig =
      await insights.configurationResolver.resolveAndScoreConfig({
        flashAttention: true,
      })

  }
}

// --- Usage Example ---
;(async () => {
  try {
    // 1. Instantiate the class
    const liquidBot = await LiquidModelRunner.initialize()
    let image = await RawImage.fromURL(
      'https://stashly-devgvili-bjwsinyq.fly.storage.tigris.dev/item_PFVshsTQt2a1j94UbOi5WQ/WhatsApp%20Image%202025-11-29%20at%2021.13.58.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=tid_Ykuer_SaroBliWI_XFZxcWc_RNxvVRwQraOKmdoiSmZJDFPnPL%2F20260211%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260211T004710Z&X-Amz-Expires=3600&X-Amz-Signature=f1585add6afc162c26a5725f2b05e9bc5ad21c1b8d5ca7e21769a70459c041c9&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject'
    )
    // 2. Run a prompt
    // const prompt = `Describe the image: ${image}`;
    const prompt = 'Can you generate a caption from an image ?'
    await liquidBot.generateResponse(prompt)
  } catch (error) {
    console.error('Error running the bot:', error)
  }
})()
