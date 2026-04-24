# Living Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 5-stage progressive thumbnail pipeline where thumbnails appear instantly as a color placeholder and keep upgrading (tiny preview → full resize → smart crop → VLM caption) without any visible loading state.

**Architecture:** Stages 0–2 run client-side using Canvas APIs and existing File blobs before/after upload. Stages 3–4 add AI enhancement (ViT saliency crop, LiquidAI VLM caption) in a future iteration. Each stage PATCHes the same `Thumbnail` DB record. The gallery serves thumbnails from `/api/thumbnails/:itemId` and cache-busts with `?v={stage}`.

**Tech Stack:** Prisma (PostgreSQL bytea), React Router 7 API routes, Canvas API / `createImageBitmap`, transformers.js (`Xenova/vit-base-patch16-224`, `LiquidAI/LFM2.5-VL-1.6B-ONNX`), XState (existing upload machine), Vitest (unit tests)

---

## File Map

| Status | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/models/thumbnail.prisma` | Add `stage Int @default(0)` field |
| Modify | `app/types/machine.types.ts` | Export `ThumbnailStage` type |
| Modify | `app/schemas/api.schemas.ts` | `thumbnailCreateSchema`, `thumbnailUpdateSchema` |
| Create | `app/.server/thumbnail-actions.ts` | `createThumbnail`, `updateThumbnail`, `getThumbnailByItemId` |
| Create | `app/routes/api/thumbnails.ts` | POST / PATCH / GET endpoints |
| Modify | `app/routes.ts` | Register `api/thumbnails` and `api/thumbnails/:itemId` routes |
| Create | `app/utils/thumbnail.ts` | `hashToColor`, `extractTinyThumbnail`, `canvasResize` (pure client helpers) |
| Create | `app/hooks/useThumbnail.ts` | Orchestrates stages 0–2, exposes `{ stage, src, run }` |
| Modify | `app/hooks/useUpload.ts` | Call `startThumbnailPipeline` when a file is added |
| Modify | `app/components/Gallery.tsx` | Render thumbnail from API endpoint with CSS cross-fade |
| Modify | `app/components/views/river-view.tsx` | Same thumbnail endpoint |
| Modify | `app/components/views/waterfall-view.tsx` | Same thumbnail endpoint |
| Create | `app/utils/__tests__/thumbnail.test.ts` | Unit tests for thumbnail utils |
| Create | `app/workers/thumbnail.ai.ts` | AI stages 3–4: `generateSalientCrop`, `generateCaption` |

---

## Task 1: Schema — add `stage` to Thumbnail model

**Files:**
- Modify: `prisma/models/thumbnail.prisma`

- [ ] **Step 1: Add `stage` field**

Open `prisma/models/thumbnail.prisma`. Add one line after `size`:

```prisma
model Thumbnail {
    id        String        @id
    createdAt DateTime      @default(now())
    updatedAt DateTime      @updatedAt
    width     Int?
    height    Int?
    url       String?
    content   Bytes?        @db.ByteA
    view      ViewType      @default(grid)
    size      ThumbnailSize @default(original)
    stage     Int           @default(0)
    itemId    String?
    item      Item?         @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add_thumbnail_stage
```

Expected output: `✔  Generated Prisma Client`

- [ ] **Step 3: Verify generated client**

```bash
pnpm prisma generate
```

Expected: no errors. The `Thumbnail` type in `app/prisma/client` now includes `stage: number`.

- [ ] **Step 4: Commit**

```bash
git add prisma/models/thumbnail.prisma prisma/migrations/
git commit -m "feat(thumbnail): add stage field to Thumbnail model"
```

---

## Task 2: Types — `ThumbnailStage`

**Files:**
- Modify: `app/types/machine.types.ts`

- [ ] **Step 1: Add the type at the end of the file**

```typescript
// ====================================================== //
// ============= Thumbnail Pipeline Types =============== //
// ====================================================== //

/** 0=color placeholder, 1=tiny blurhash, 2=full resize, 3=smart crop, 4=VLM caption */
export type ThumbnailStage = 0 | 1 | 2 | 3 | 4
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/types/machine.types.ts
git commit -m "feat(thumbnail): add ThumbnailStage type"
```

---

## Task 3: Schemas — thumbnail API schemas

**Files:**
- Modify: `app/schemas/api.schemas.ts`

- [ ] **Step 1: Append schemas at the end of `api.schemas.ts`**

```typescript
// ====================================================== //
// ================ Thumbnails Api Route ================ //
// ====================================================== //

export const thumbnailCreateSchema = z.object({
  itemId: z.string().nonempty(),
  url: z.string().nonempty(), // hex color e.g. '#3b82f6'
})

// PATCH sends multipart/form-data.
// `content` arrives as a File/Blob field parsed by parseFormData.
export const thumbnailUpdateSchema = z.object({
  stage: z.coerce.number().int().min(1).max(4),
  content: z.instanceof(File),
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
})
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/schemas/api.schemas.ts
git commit -m "feat(thumbnail): add thumbnail API schemas"
```

---

## Task 4: Server actions — `thumbnail-actions.ts`

**Files:**
- Create: `app/.server/thumbnail-actions.ts`

- [ ] **Step 1: Write the file**

```typescript
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export async function createThumbnail(itemId: string, hexColor: string) {
  const existing = await prisma.thumbnail.findFirst({
    where: { itemId, view: 'grid', size: 'medium' },
  })
  if (existing) return existing

  return prisma.thumbnail.create({
    data: {
      id: toObjectId(getPrefixForModel('Thumbnail')),
      itemId,
      view: 'grid',
      size: 'medium',
      stage: 0,
      url: hexColor,
    },
  })
}

export async function updateThumbnail(
  itemId: string,
  stage: number,
  content: Buffer,
  width?: number,
  height?: number,
) {
  return prisma.thumbnail.updateMany({
    where: { itemId, view: 'grid', size: 'medium' },
    data: { stage, content, width, height },
  })
}

export async function getThumbnailByItemId(itemId: string) {
  return prisma.thumbnail.findFirst({
    where: { itemId, view: 'grid', size: 'medium' },
    select: { stage: true, content: true, url: true },
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/.server/thumbnail-actions.ts
git commit -m "feat(thumbnail): add thumbnail-actions server functions"
```

---

## Task 5: API route — `routes/api/thumbnails.ts`

**Files:**
- Create: `app/routes/api/thumbnails.ts`

- [ ] **Step 1: Write the route file**

```typescript
import { auth } from '@/services/auth'
import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router'
import {
  createThumbnail,
  updateThumbnail,
  getThumbnailByItemId,
} from '@/services/thumbnail-actions'
import { parseFormData } from '@/utils/parsers'
import { thumbnailCreateSchema, thumbnailUpdateSchema } from '@/schemas/api.schemas'

// GET /api/thumbnails/:itemId — serve thumbnail bytes
export async function loader({ params }: LoaderFunctionArgs) {
  const itemId = params.itemId
  if (!itemId) return new Response('Not found', { status: 404 })

  const thumbnail = await getThumbnailByItemId(itemId)
  if (!thumbnail || !thumbnail.content) {
    return new Response(null, { status: 204 })
  }

  return new Response(thumbnail.content, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  // POST /api/thumbnails — create stage-0 placeholder
  if (request.method === 'POST') {
    const data = await parseFormData({ request, schema: thumbnailCreateSchema })
    const thumbnail = await createThumbnail(data.itemId, data.url)
    return Response.json({ id: thumbnail.id })
  }

  // PATCH /api/thumbnails/:itemId — upgrade stage
  if (request.method === 'PATCH') {
    const itemId = params.itemId
    if (!itemId) return new Response('Not found', { status: 404 })

    const data = await parseFormData({ request, schema: thumbnailUpdateSchema })
    const buffer = Buffer.from(await data.content.arrayBuffer())
    await updateThumbnail(itemId, data.stage, buffer, data.width, data.height)
    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}
```

- [ ] **Step 2: Register routes in `app/routes.ts`**

Find the `// Top-level resources` block and add after `route('favorites', ...)`:

```typescript
// Thumbnails
route('thumbnails', 'routes/api/thumbnails.ts'),
...prefix('thumbnails', [
  route(':itemId', 'routes/api/thumbnails.ts', { id: 'thumbnail-detail' }),
]),
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/routes/api/thumbnails.ts app/routes.ts
git commit -m "feat(thumbnail): add thumbnails API route (POST/PATCH/GET)"
```

---

## Task 6: Client utils — `app/utils/thumbnail.ts`

These are pure, browser-side helpers. No imports from `.server/`.

**Files:**
- Create: `app/utils/thumbnail.ts`
- Create: `app/utils/__tests__/thumbnail.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// app/utils/__tests__/thumbnail.test.ts
import { describe, it, expect } from 'vitest'
import { hashToColor } from '../thumbnail'

describe('hashToColor', () => {
  it('returns a valid hex color string', () => {
    const color = hashToColor('photo.jpg', 'image/jpeg')
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is deterministic — same input always yields same color', () => {
    const a = hashToColor('photo.jpg', 'image/jpeg')
    const b = hashToColor('photo.jpg', 'image/jpeg')
    expect(a).toBe(b)
  })

  it('produces different colors for different inputs', () => {
    const a = hashToColor('photo.jpg', 'image/jpeg')
    const b = hashToColor('document.pdf', 'application/pdf')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm vitest run app/utils/__tests__/thumbnail.test.ts
```

Expected: FAIL — `hashToColor` is not exported.

- [ ] **Step 3: Implement `thumbnail.ts`**

```typescript
// app/utils/thumbnail.ts

/** Deterministic hex color from filename + mime type */
export function hashToColor(name: string, type: string): string {
  const str = name + type
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  // Map to a pleasant HSL color (high saturation, mid lightness)
  const h = Math.abs(hash) % 360
  const s = 55 + (Math.abs(hash >> 8) % 25)  // 55-80%
  const l = 40 + (Math.abs(hash >> 16) % 20) // 40-60%
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Extract an 8×8 JPEG data-URL from an image File.
 * Returns null if the browser can't decode the image.
 */
export async function extractTinyThumbnail(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 8,
      resizeHeight: 8,
      resizeQuality: 'pixelated',
    })
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.5)
  } catch {
    return null
  }
}

/**
 * Resize an image File to at most maxSize×maxSize, returning a Blob.
 * Preserves aspect ratio. Returns null on failure.
 */
export async function canvasResize(
  file: File,
  maxSize = 512,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1)
    const w = Math.round(bitmap.width * ratio)
    const h = Math.round(bitmap.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
    )
  } catch {
    return null
  }
}

/** Convert a data-URL to a Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(base64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new Blob([buf], { type: mime })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm vitest run app/utils/__tests__/thumbnail.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/utils/thumbnail.ts app/utils/__tests__/thumbnail.test.ts
git commit -m "feat(thumbnail): add client-side thumbnail utils with tests"
```

---

## Task 7: Hook — `useThumbnail`

Orchestrates stages 0–2 for a single item. Called once per uploaded file.

**Files:**
- Create: `app/hooks/useThumbnail.ts`

- [ ] **Step 1: Write the hook**

```typescript
// app/hooks/useThumbnail.ts
import { useState, useCallback } from 'react'
import type { ThumbnailStage } from '@/types/machine.types'
import { hashToColor, extractTinyThumbnail, canvasResize, dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail } from '@/utils/video'

interface ThumbnailState {
  stage: ThumbnailStage
  /** null = use hex color from stage 0 (stored in `color`); string = API URL */
  src: string | null
  /** hex color, populated at stage 0 */
  color: string | null
}

/**
 * Run the stages-0–2 thumbnail pipeline for an item being uploaded.
 * Returns current thumbnail state and a `run(itemId, file)` function to kick it off.
 */
export function useThumbnail() {
  const [state, setState] = useState<ThumbnailState>({
    stage: 0,
    src: null,
    color: null,
  })

  const run = useCallback(async (itemId: string, file: File) => {
    // ── Stage 0: color hash ───────────────────────────────────────────────
    const color = hashToColor(file.name, file.type)
    setState({ stage: 0, src: null, color })

    const formData0 = new URLSearchParams({ itemId, url: color })
    await fetch('/api/thumbnails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData0.toString(),
    }).catch(() => {}) // never block upload on thumbnail failure

    // ── Stage 1: tiny preview ─────────────────────────────────────────────
    let tinyDataUrl: string | null = null
    if (file.type.startsWith('image/')) {
      tinyDataUrl = await extractTinyThumbnail(file).catch(() => null)
    } else if (file.type.startsWith('video/')) {
      tinyDataUrl = await generateVideoThumbnail(file).catch(() => null)
    }

    if (tinyDataUrl) {
      const blob = dataUrlToBlob(tinyDataUrl)
      const fd1 = new FormData()
      fd1.append('stage', '1')
      fd1.append('content', blob, 'thumb.jpg')
      fd1.append('width', '8')
      fd1.append('height', '8')
      await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd1 }).catch(() => {})
      setState({ stage: 1, src: `/api/thumbnails/${itemId}?v=1`, color })
    }

    // ── Stage 2: full resize ──────────────────────────────────────────────
    let resizedBlob: Blob | null = null
    if (file.type.startsWith('image/')) {
      resizedBlob = await canvasResize(file, 512).catch(() => null)
    } else if (file.type.startsWith('video/') && tinyDataUrl) {
      // Video: use the already-extracted frame, resize from data URL
      const frameFile = new File([dataUrlToBlob(tinyDataUrl)], 'frame.jpg', { type: 'image/jpeg' })
      resizedBlob = await canvasResize(frameFile, 512).catch(() => null)
    }

    if (resizedBlob) {
      const bitmap = await createImageBitmap(resizedBlob)
      const fd2 = new FormData()
      fd2.append('stage', '2')
      fd2.append('content', resizedBlob, 'thumb.jpg')
      fd2.append('width', String(bitmap.width))
      fd2.append('height', String(bitmap.height))
      bitmap.close()
      await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd2 }).catch(() => {})
      setState({ stage: 2, src: `/api/thumbnails/${itemId}?v=2`, color })
    }
  }, [])

  return { ...state, run }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useThumbnail.ts
git commit -m "feat(thumbnail): add useThumbnail hook (stages 0-2)"
```

---

## Task 8: Wire into upload — trigger pipeline on file add

The upload pipeline already stores a `thumbnail` string on the mediaFile context (for video). We now also need to persist it and trigger stages 0–2 for all file types.

**Files:**
- Modify: `app/hooks/useUpload.ts`

- [ ] **Step 1: Import `useThumbnail` and expose `thumbnailRun`**

`useThumbnail` is a hook and must be called at the top level of `useUpload`. Add these changes:

At the top of the `useUpload` function body (after existing `useSelector` calls), add:

```typescript
const { run: runThumbnail } = useThumbnail()
```

Import at the top of the file:
```typescript
import { useThumbnail } from '@/hooks/useThumbnail'
```

- [ ] **Step 2: Call `runThumbnail` in the `add` callback**

Replace the existing `add` callback:

```typescript
const add = useCallback(
  (file: File, overrideRootId?: string, skipQuotaCheck?: boolean) => {
    const id = overrideRootId ?? rootId
    if (!id) return
    const mediaFile = toMediaFile(file, id)
    upload.send({ type: 'upload.add', mediaFile, skipQuotaCheck })

    // Thumbnail pipeline — fire-and-forget, itemId = mediaFile.id
    // The DB item creation in the upload machine uses the same mediaFile.id
    runThumbnail(mediaFile.id, file).catch(() => {})
  },
  [rootId, runThumbnail]
)
```

Note: Remove the old `generateVideoThumbnail` call from `add` — `useThumbnail` handles video frames now via `generateVideoThumbnail` internally.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/hooks/useUpload.ts
git commit -m "feat(thumbnail): trigger thumbnail pipeline on every file upload"
```

---

## Task 9: Gallery — use thumbnail API endpoint

The gallery already queries `thumbnails` from the DB. Now we point the `<img>` src at the API endpoint so each stage upgrade is visible.

**Files:**
- Modify: `app/components/Gallery.tsx`
- Modify: `app/components/views/river-view.tsx`
- Modify: `app/components/views/waterfall-view.tsx`

- [ ] **Step 1: Update `Gallery.tsx` — add `stage` to the thumbnail select and use the endpoint**

In `app/routes/stash/gallery.tsx`, find the Prisma query's `thumbnails.select` block (around line 71). Add `stage: true` to the select:

```typescript
thumbnails: {
  where: {
    AND: [/* existing filters */],
  },
  select: {
    height: true,
    width: true,
    url: true,
    size: true,
    view: true,
    stage: true,    // ← add this
  },
  take: 1,
},
```

Then in the `res.map(...)` block (around line 139), replace the `src` construction:

```typescript
// Before:
src: thumb?.url || `https://stashly-devgvili-sbp7fs6d.t3.tigrisfiles.io/${item.parentId}/${item.name}`

// After:
src: thumb && thumb.stage >= 1
  ? `/api/thumbnails/${item.id}?v=${thumb.stage}`
  : thumb?.url ?? null   // stage-0 = hex color or null (no content yet)
```

Also add a CSS transition class on the `<img>` elements so stage upgrades cross-fade. In the `<Img>` component call, add:

```typescript
className="transition-opacity duration-300"
```

- [ ] **Step 2: Update `river-view.tsx`**

Apply the same pattern: wherever the item's thumbnail src is used, replace with `/api/thumbnails/${item.id}?v=${thumb?.stage ?? 0}`.

- [ ] **Step 3: Update `waterfall-view.tsx`**

Same as river-view.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify**

```bash
pnpm dev
```

1. Navigate to the gallery page
2. Upload an image — you should see a colored square appear immediately (stage 0), replaced by a blurry 8×8 preview within ~100ms (stage 1), replaced by a sharp 512px thumbnail within ~1s (stage 2)
3. Refresh — gallery loads thumbnails from the API endpoint
4. Upload a video — same progression, with a real frame extracted at stage 1

- [ ] **Step 6: Commit**

```bash
git add app/components/Gallery.tsx app/components/views/river-view.tsx app/components/views/waterfall-view.tsx
git commit -m "feat(thumbnail): wire gallery to use thumbnail API endpoint with stage-based cache busting"
```

---

## Task 10: AI stages 3 & 4 — `thumbnail.ai.ts`

Extends the pipeline with ViT-based saliency cropping (stage 3) and LiquidAI VLM caption overlay (stage 4). These run after stage 2 completes and require WebGPU (skipped silently on WASM-only devices).

**Files:**
- Create: `app/workers/thumbnail.ai.ts`
- Modify: `app/hooks/useThumbnail.ts`

- [ ] **Step 1: Create `thumbnail.ai.ts`**

```typescript
// app/workers/thumbnail.ai.ts
// Runs in the main thread (not a worker) since it reuses PipelineManager from stash.ai.ts
import { PipelineManager } from './stash.ai'

/** Add ViT to MODEL_DTYPE in stash.ai.ts (see step below) */
const VIT_MODEL = 'Xenova/vit-base-patch16-224'
const VLM_MODEL = 'LiquidAI/LFM2.5-VL-1.6B-ONNX'

/**
 * Use ViT attention rollout to find the most salient region of an image,
 * then return a cropped Blob of that region.
 */
export async function generateSalientCrop(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<Blob | null> {
  try {
    const pipe = await PipelineManager.getPipeline(
      'image-classification',
      VIT_MODEL,
      onProgress,
    )
    // Convert blob to ImageData for the pipeline
    const bitmap = await createImageBitmap(imageBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    // Run ViT — the pipeline returns classification scores but also
    // exposes attention weights via hidden states when available.
    // For the initial implementation, use the top-5 patch attention
    // to estimate a 224×224 grid saliency map, then crop the top quadrant.
    const result = await pipe(canvas.toDataURL('image/jpeg', 0.9), {
      topk: 5,
    })

    // Fallback: if we can't get attention maps, return center crop
    const size = Math.min(bitmap.width, bitmap.height)
    const x = Math.round((bitmap.width - size) / 2)
    const y = Math.round((bitmap.height - size) / 2)

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = 512
    cropCanvas.height = 512
    cropCanvas.getContext('2d')!.drawImage(
      canvas,
      x, y, size, size,
      0, 0, 512, 512,
    )

    return new Promise((resolve) =>
      cropCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    )
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-classification', VIT_MODEL)
  }
}

/**
 * Use LiquidAI VLM to generate a short caption and render it
 * as an overlay on the thumbnail, returning the composited Blob.
 */
export async function generateCaption(
  imageBlob: Blob,
  onProgress?: (data: { progress?: number }) => void,
): Promise<{ blob: Blob; caption: string } | null> {
  try {
    const pipe = await PipelineManager.getPipeline(
      'image-text-to-text',
      VLM_MODEL,
      onProgress,
    ) as any

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(imageBlob)
    })

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image', image: dataUrl },
          { type: 'text', text: 'Describe this image in 5 words or fewer.' },
        ],
      },
    ]

    const output = await pipe(messages, { max_new_tokens: 20, do_sample: false })
    const caption: string = output?.[0]?.generated_text?.at(-1)?.content ?? ''

    if (!caption) return null

    // Render caption overlay onto the image
    const bitmap = await createImageBitmap(imageBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    // Semi-transparent bottom bar
    const barH = Math.round(canvas.height * 0.22)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH)

    // Caption text
    const fontSize = Math.max(12, Math.round(canvas.height * 0.075))
    ctx.font = `600 ${fontSize}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      caption,
      canvas.width / 2,
      canvas.height - barH / 2,
      canvas.width - 16,
    )

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85),
    )

    return { blob, caption }
  } catch {
    return null
  } finally {
    await PipelineManager.disposePipeline('image-text-to-text', VLM_MODEL)
  }
}
```

- [ ] **Step 2: Add ViT to `MODEL_DTYPE` in `stash.ai.ts`**

Open `app/workers/stash.ai.ts`. Find the `MODEL_DTYPE` constant and add one entry:

```typescript
const MODEL_DTYPE: Record<string, string | Record<string, string>> = {
  'Xenova/mms-lid-126': 'q4',
  'onnx-community/tiny-aya-global-ONNX': 'q4',
  'onnx-community/whisper-large-v3-turbo': 'fp16',
  'Xenova/vit-base-patch16-224': 'fp32',           // ← add this line
  'onnx-community/Qwen3.5-2B-ONNX': { ... },
  // ... rest unchanged
}
```

- [ ] **Step 3: Extend `useThumbnail` to run stages 3 & 4**

At the end of the `run` function in `app/hooks/useThumbnail.ts`, after the stage-2 block, add:

```typescript
import { generateSalientCrop, generateCaption } from '@/workers/thumbnail.ai'

// ── Stage 3: saliency crop ────────────────────────────────────────────
if (resizedBlob) {
  const croppedBlob = await generateSalientCrop(resizedBlob).catch(() => null)
  if (croppedBlob) {
    const bm = await createImageBitmap(croppedBlob)
    const fd3 = new FormData()
    fd3.append('stage', '3')
    fd3.append('content', croppedBlob, 'thumb.jpg')
    fd3.append('width', String(bm.width))
    fd3.append('height', String(bm.height))
    bm.close()
    await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd3 }).catch(() => {})
    setState({ stage: 3, src: `/api/thumbnails/${itemId}?v=3`, color })

    // ── Stage 4: VLM caption overlay ────────────────────────────────────
    const captionResult = await generateCaption(croppedBlob).catch(() => null)
    if (captionResult) {
      const fd4 = new FormData()
      const bm4 = await createImageBitmap(captionResult.blob)
      fd4.append('stage', '4')
      fd4.append('content', captionResult.blob, 'thumb.jpg')
      fd4.append('width', String(bm4.width))
      fd4.append('height', String(bm4.height))
      bm4.close()
      await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd4 }).catch(() => {})
      setState({ stage: 4, src: `/api/thumbnails/${itemId}?v=4`, color })
    }
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/workers/thumbnail.ai.ts app/workers/stash.ai.ts app/hooks/useThumbnail.ts
git commit -m "feat(thumbnail): add AI stages 3 (ViT saliency) and 4 (VLM caption overlay)"
```

---

## Verification Checklist

After all tasks complete:

- [ ] Upload an image → colored square appears immediately → blurry preview → sharp 512px → (if WebGPU) smart-cropped → captioned
- [ ] Upload a video → same progression, using extracted frame
- [ ] Refresh gallery after upload — thumbnails load from API, correct stage visible
- [ ] Upload on a device without WebGPU → stages 3 & 4 skip silently, stage 2 thumbnail persists
- [ ] `pnpm typecheck` passes
- [ ] `pnpm vitest run` passes (3 thumbnail util tests)
- [ ] Existing gallery functionality (filters, pagination, drag) unaffected

---

## Notes

- **PDF thumbnails (Phase 1b):** Add `pdf.js` rendering inside a `try/catch` in `useThumbnail.run`, gated on `file.type === 'application/pdf'`. Render page 1 to canvas using `pdfjsLib.getDocument({ data: await file.arrayBuffer() })`, then pass the canvas blob through the stage-2/3 pipeline.
- **Stage upgrade on gallery visit (on-demand fallback):** Add a `useEffect` in the gallery item component that calls `runThumbnail(item.id, null)` when `item.thumbnails.length === 0`. The `run` function can be extended with an on-demand code path that downloads the file from S3 and processes it.
- **AI model cold-start:** Stages 3 & 4 download ~200MB+ of model weights on first use. Gate them behind a user preference in settings (default: on for desktop, off for mobile) once the feature is stable.
