# Image captioning model type error

| | |
|---|---|
| **Created** | 2026-02-10 23:26:21 |
| **Last Message** | 2026-02-10 23:26:21 |
| **Model** | Auto |
| **Mode** | ask |
| **User** | Unknown |
| **Session ID** | `d0b31787-a28d-41f9-8b0e-c24343cb5084` |

---

## User

*2026-02-10 23:26:25*

Image captioning failed: Error: Unsupported model type: lfm2_vl
    at Function.from_pretrained (file:///X:/stashly/node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/webpack:/@huggingface/transformers/src/models.js:7912:1)
    at Function.caption (X:/stashly/app/.server/stashly-ai.liquidAI.ts:195:21)
    at action (X:/stashly/app/routes/api/ai.ts:91:23)
    at callRouteHandler (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-G3INQAYP.mjs:506:16)
    at file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:4663:19
    at callLoaderOrAction (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:4715:16)
    at async Promise.all (index 0)
    at defaultDataStrategy (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:4350:17)
    at callDataStrategyImpl (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:4609:17)
    at callDataStrategy (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:3677:19)
    at submit (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:3481:21)
    at queryImpl (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:3416:23)
    at Object.queryRoute (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-4WY6JWTD.mjs:3380:18)
    at handleResourceRequest (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-G3INQAYP.mjs:1439:18)
    at requestHandler (file:///X:/stashly/node_modules/.pnpm/react-router@7.9.6_react-do_d4a3e4c27e0cb30e84e7f4e67d54cb39/node_modules/react-router/dist/development/chunk-G3INQAYP.mjs:1159:18)
    at file:///X:/stashly/node_modules/.pnpm/@react-router+express@7.9.6_ddbac126437ec29f1963b97c9d5443cd/node_modules/@react-router/express/dist/index.mjs:28:22

## Assistant (copilot/auto)

<details>
<summary>💭 Thinking — Debugging model error</summary>

**Debugging model error**

I need to help debug the error related to the unsupported model type "lfm2_vl" from the Hugging Face transformers in the caption method. It seems like the library doesn't support this model type for AutoModelForImageTextToText.

To propose a fix, I could suggest switching to a supported model or using AutoModel.from_pretrained with the right type. There are helper functions that can assist in creating a pipeline for image-captioning, so I’ll want to inspect the relevant files and explore what's permitted.

</details>

I'll search the codebase for the helper functions and usages to understand supported models and pipelines. I'll fetch the relevant files next.

> **🔧 ✓ Searching for regex `getVision|getPipeline|AutoModelForImageTextToText|LFM2|LiquidAI`**

> **🔧 ✓ Reading [](file:///x%3A/stashly/app/.server/ai.utils.ts#1-1), lines 1 to 480**

> **🔧 ✓ Reading [](file:///x%3A/stashly/app/.server/ai.utils.ts#480-480), lines 480 to 1128**

> **🔧 ✓ Reading [](file:///x%3A/stashly/app/.server/stashly-ai.liquidAI.ts#1-1), lines 1 to 340**

> **🔧 ✓ Reading [](file:///x%3A/stashly/app/.server/stashly-ai.liquidAI.ts#340-340), lines 340 to 840**

<details>
<summary>💭 Thinking</summary>

**Updating to-do list**

I need to include a to-do list and mark tasks as completed. First, I'll investigate the error, find ai.utils getVision, and update the caption to use getVision. I’ll show the updated to-do list with checked boxes.

I'll also provide a progress update: "I inspected ai.utils and stashly-ai.liquidAI.ts; next, I'll propose the code change and paste the patch." I’ll make sure the tone is upbeat, and I’ll break down the request into clear, actionable steps at the beginning!

</details>

<details>
<summary>💭 Thinking</summary>

**Creating a to-do list**

I need to create a small to-do list with checkboxes, including three items: 1) Inspect code -> done; 2) Update caption method to use getVision -> implement; 3) Provide patch -> done. It’s important to show any incomplete tasks first, and then I’ll present the updated list after making changes. 

I'll include a progress update like: “Searched and opened files, found getVision in ai.utils and caption in stashly-ai.liquidAI.ts.” Finally, I’ll provide the code block changes and the updated to-do list with completed tasks!

</details>

<details>
<summary>💭 Thinking</summary>

**Providing testing instructions**

I need to explain how to test by calling the API endpoint that triggers the caption or running a unit test, but I should keep it brief. 

I also have to include fully qualified links for referenced symbols and files, like for `getVision` and `stashly-ai.liquidAI.ts`. This means using links in Markdown format, such as [`getVision`](x:/stashly/app/.server/ai.utils.ts) and ensuring I wrap filenames and symbols in backticks. I'll make sure to follow all the instructions for referencing correctly!

</details>

<details>
<summary>💭 Thinking</summary>

**Creating relative path links**

I’m going to make sure to use relative path links for the workspace files. This includes links like [app/.server/ai.utils.ts](app/.server/ai.utils.ts) and [`getVision`](app/.server/ai.utils.ts#L238), although I can’t include line anchors. I also need to reference the `stashly-ai.liquidAI.ts` file: [app/.server/stashly-ai.liquidAI.ts](app/.server/stashly-ai.liquidAI.ts), and maybe mention symbols like `StashlyLiquidAI.caption`.

I'll craft a response with a one-liner progress update: "I inspected `app/.server/ai.utils.ts` and `app/.server/stashly-ai.liquidAI.ts`; next, I'll update the caption method to use `getVision`." Then I’ll outline the initial to-do list, followed by the updated one after completing the coding!

</details>

<details>
<summary>💭 Thinking — Searched for regex and read multiple files</summary>

**Crafting the to-do list**

I’ll start by creating a clear plan and to-do list for myself:

- [ ] Inspect error and find code locations (I’ll mark this as done later)
- [ ] Replace unsupported LiquidAI model usage with `getVision` (this is the target change)
- [ ] Provide a patch for `app/.server/stashly-ai.liquidAI.ts`
- [ ] Suggest how to test the endpoint

For the progress update, I’ll say: "I searched and read `app/.server/ai.utils.ts` and `app/.server/stashly-ai.liquidAI.ts` and confirmed that `getVision` returns a Florence-2 model suitable for image captioning." After adding the patch code block, I’ll update the to-do list, marking completed items and providing minimal test steps. Then, I’ll show how to send a request to the route that triggers the caption by inspecting the relevant file!

</details>

> **🔧 ✓ Reading [](file:///x%3A/stashly/app/routes/api/ai.ts)**

I'll replace the unsupported LiquidAI model call with the project's supported Florence-2 vision helper (``) and provide a safe decode fallback.

Plan
- [ ] Inspect code to locate caption + vision helpers
- [ ] Replace the failing LiquidAI model usage with ``
- [ ] Provide patch for `stashly-ai.liquidAI.ts`
- [ ] Give a quick test instruction

Progress update: I inspected `ai.utils.ts` (which exposes ``) and `stashly-ai.liquidAI.ts` (the failing `` method). Links: `` — file: `ai.utils.ts`, target file: `stashly-ai.liquidAI.ts`.

Patch — replace the `` method in `stashly-ai.liquidAI.ts` with the version below:

````typescript
// ...existing code...
  static async caption(
    url: string
    // detailLevel: 'short' | 'long' = 'long'
  ): Promise<string> {
    try {
      // Use the project's Florence-2 vision helper (supports image captioning)
      const { model, processor } = await getVision()

      // Load image and prepare inputs via the processor
      const image = load_image(url)
      const inputs = await processor({ images: image, task: 'image_captioning', return_dict: true })

      // Generate caption tokens
      const outputs = (await model.generate({
        ...(inputs as any),
        max_new_tokens: 256,
        remove_invalid_values: true,
      })) as any

      // Decode robustly: try processor.decode, then batch_decode fallback
      let caption = ''
      try {
        caption = (await processor.decode(outputs[0])) as string
      } catch (e) {
        try {
          caption = (processor.batch_decode?.(outputs, { skip_special_tokens: true }) || [])[0]
        } catch (e2) {
          caption = String(outputs[0] ?? outputs)
        }
      }

      return caption?.trim() || ''
    } catch (err) {
      console.error('Image captioning failed:', err)
      return ''
    }
  }
// ...existing code...
````

Updated todo list
- [x] Inspect code to locate caption + vision helpers
- [x] Replace the failing LiquidAI model usage with ``
- [x] Provide patch for `stashly-ai.liquidAI.ts`
- [x] Give a quick test instruction

How to test
- POST a form to your AI route with intent=caption-image and url=<image-url>. Example (curl):
  ```
  curl -X POST 'http://localhost:5173/api/ai' \
    -F 'intent=caption-image' \
    -F 'url=https://example.com/image.jpg'
  ```
- The route that triggers this is in `ai.ts` (calls ``).

If you want, I can also:
- add a fallback that first tries the LiquidAI model and falls back to Florence-2 (if you'd prefer keeping LiquidAI attempts), or
- remove unused imports after this change. Which would you like?

---

