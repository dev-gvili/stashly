# Type definition file error for '@webgpu/types'

| | |
|---|---|
| **Created** | 2026-02-24 18:54:29 |
| **Last Message** | 2026-02-24 18:54:29 |
| **Model** | Auto |
| **Mode** | ask |
| **User** | Unknown |
| **Session ID** | `8a47b7af-b9e5-4870-acfd-58ce3301c232` |

---

## User

*2026-02-24 18:54:30*

/fix Cannot find type definition file for '@webgpu/types'.

## Assistant (copilot/auto)

Make sure the compiler actually has the `@webgpu/types` package available and is told to include it.

1. In your workspace, install the definitions as a dev dependency:

   
```bash
   npm install --save-dev @webgpu/types
   ```


2. Tell TypeScript to pick them up – either by adding them to your `tsconfig.json` (or `jsconfig.json`):

   
```jsonc
   {
     "compilerOptions": {
       // …
       "types": ["@webgpu/types"],            // explicitly include
       "typeRoots": [                         // or ensure typeRoots include node_modules
         "./node_modules/@types",
         "./node_modules/@webgpu/types"
       ]
     }
   }
   ```


   (The `/// <reference types="@webgpu/types" />` comment at the top of your file then resolves correctly.)

3. After updating, reload/refresh the TypeScript language service by running the **TypeScript: Restart TS Server** command.

---

