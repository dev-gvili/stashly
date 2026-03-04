# GPUBufferUsage name resolution issue

| | |
|---|---|
| **Created** | 2026-02-24 18:53:37 |
| **Last Message** | 2026-02-24 18:53:37 |
| **Model** | Auto |
| **Mode** | ask |
| **User** | Unknown |
| **Session ID** | `100deccd-4da9-44d0-a5ab-0c70e0933f34` |

---

## User

*2026-02-24 18:53:39*

/fix Cannot find name 'GPUBufferUsage'.

## Assistant (copilot/auto)

Add the WebGPU types so `` is known to the compiler.  
You can do that with a triple‑slash reference at the top of the worker file:

```ts
/// <reference types="@webgpu/types" />

import {
  pipeline,
  env,
  type TaskType,
  type PretrainedModelOptions,
  type SupportedTasks,
} from '@huggingface/transformers'

// ...existing code...
```

This ensures the `` (and other WebGPU globals) are defined for TypeScript and the error goes away.

---

