# Stashly Project Roadmap

Last updated: **2026-08-14**

Stashly is a secure, intuitive, and powerful file storage and collaboration platform. This roadmap tracks shipped phases and remaining work.

For developer conventions and the actual project structure, see [`CLAUDE.md`](../CLAUDE.md). For the architecture overview, see [`project-overview.md`](project-overview.md).

---

## Phase 1: Foundation & Core (MVP) — ✅ Shipped

- [x] **User Authentication** — `better-auth` with OAuth (GitHub, Google, Microsoft)
- [x] **File Uploads** — multipart S3 with concurrent parts, ETag verification
- [x] **File Storage** — Tigris (S3-compatible) on Fly.io
- [x] **File Management** — view, organize, rename, move, trash, restore, delete
- [x] **Dashboard UI** — sidebar with `Library` / `Sharing` / `Manage` groups
- [x] **Subscription** — Stripe integration with webhook-driven state sync
- [x] **Storage Quotas** — quota state machine, deltas on trash/restore/delete

---

## Phase 2: File Management & Upload — ✅ Shipped

- [x] **Multipart upload** — `app/machines/upload/upload.machine.ts` parent spawns `app/machines/reviset/file.machine.ts` per file (the sibling `app/machines/upload/file.machine.ts` is dead code) plus `app/machines/quota/quota.machine.ts`. Concurrency is gated inside `upload.machine.ts` itself via `maxConcurrentUploads` (schema default 100); the standalone queue-machine copies that used to shadow this were deleted on 2026-08-14.
- [x] **Concurrent multipart** — parallel chunk uploads with ETag tracking ([spec](superpowers/specs/2026-04-02-concurrent-multipart-upload-design.md))
- [x] **Multipart contract tests** — Vitest suite over the streaming layer
- [x] **Post-upload DB chain** — `createDbItem` actor → `POST /api/items` → `createUploadedItem()`
- [x] **`itemCreated` gate** — solves race between S3 done and DB row write
- [x] **Folders** — self-referencing `parentId`, `childCount` maintained by Postgres trigger
- [x] **Collections** — many-to-many with item; size auto-maintained by triggers
- [x] **Favorites** — toggle, filter
- [x] **Pinned items** — `PinItem` per-user join row with `position`, `pin-actions.ts`, `/api/pins` resource route (`intent: pin|unpin|reorder|list|check`), `usePinItem` hook for optimistic toggling, `/:me/stash/pinned` page, sidebar entry
- [x] **Trash + restore + permanent delete** — quota deltas applied on each transition
- [x] **Storage overview route** — `app/routes/stash/storage.tsx` with `DataTable` + ops dashboard

---

## Phase 3: Collaboration & Sharing — 🚧 Partial

### Shipped

- [x] **Share Links** — `ShareLink` + `Permission` model; URL-based access (anonymous or scoped to users)
- [x] **Link Permissions** — read/write scopes
- [x] **Activity Feed** — full activity timeline (create/rename/move/trash/restore/delete/copy/share/comment/version), `ItemActivityDrawer`, `ActivityFeed` component on the gallery image sidebar
- [x] **Permission model** — `Permission` table; per-item access grants enforced in action functions
- [x] **Notifications** — live SSE feed: `/api/notifications/stream` fed by Postgres LISTEN/NOTIFY (`app/.server/notification-events.ts`), `NotificationsPanel` bell in the app header, `useNotificationStream` hook ([notifications-sse.md](notifications-sse.md)). Shipped with Prometheus instrumentation for the pool / SSE / NOTIFY path — `app/.server/metrics.ts` exposed at `/api/metrics`. The `/settings/notifications` preferences page is still a 17-line TODO stub.
- [x] **Client degradation telemetry** — the browser-side thumbnail and metadata/embedding stages fall back silently by design, which made a WebGPU or PDF.js regression invisible server-side. They now increment `stashly_client_degraded_total{stage,reason}` on the existing registry via `sendBeacon` to `POST /api/metrics` (closed enums, session-gated, no ids or stack traces), with a quiet dismissible notice shown only for capability-level failures. `app/utils/report-degraded.ts` + `core-components/degraded-notice.tsx`.
- [x] **Invitations (item + workspace)** — `invitation-actions.ts` + `/api/invitations`; received/sent views (`invitations-view.tsx` + `views/invitations/` detail panels), `NewInvitationDialog` invite flow covering files, folders, and workspaces; `/:me/stash/invitations` page

### Backend Only — Awaiting UI

These have working `*-actions.ts` files and API routes wired, but **no UI consumers** exist yet.

- [ ] **Comments** — `comment-actions.ts` + `/api/comments` exist; no UI. The unmounted `CommentsThreadPanel.tsx` was deleted in the 2026-08-14 purge, so the panel needs rebuilding (recover it from git history if the old markup is useful)
- [ ] **Versions** — `version-actions.ts` + `/api/versions` (flat + `items/:itemId/versions/:versionId?`) exist; no `VersionList` / `VersionHistory` component exists anywhere; no UI to trigger version creation or restore

### Workspaces — Routes Stubbed, Views Missing

The workspace URL space is registered in `app/routes.ts` for index/workspace/folder/file/collections/collection/members/settings/shares/favorites/recent/trash/gallery — but most route files are 13–22-line skeletons. **Only `workspaces/trash.tsx` (149 lines) and `workspaces/workspace.tsx` (141 lines, workspace detail rendering `WorkspaceOverview`) have any real UI**; `:workspaceId/gallery` borrows `routes/stash/gallery.tsx` outright. `workspaces/create.tsx` exists on disk but is not registered in `app/routes.ts` — there is no reachable creation URL.

- [x] Schema — `Workspace`, `WorkspaceMember`, role enum (Owner / Admin / Member / Viewer)
- [x] `workspace-actions.ts` — backend membership management
- [x] Routing structure — `/:me/workspaces/:workspaceId/*` registered
- [x] Workspace detail page — `workspace.tsx` loader + `WorkspaceOverview` view
- [ ] Workspace views — index, create, folder, file, collections, collection, members, settings, shares, favorites, recent are all stub files
- [ ] Member management UI
- [ ] Workspace creation flow
- [ ] Role change UI

See: [`docs/sharing-and-invitations.md`](sharing-and-invitations.md) for the share/invitation backend model.

---

## Phase 4: Advanced Features & Intelligence — 🚧 Partial

### Shipped

- [x] **Full-text search** — PostgreSQL `search` field with filters (type, date, workspace)
- [x] **Semantic search infrastructure** — pgvector extension installed; `Xenova/all-mpnet-base-v2` (768-dim embeddings, mean-pooled + L2-normalized for cosine/dot-product) runs on WebGPU in `app/workers/embedding.ai.ts`; `Search.vector` / `SearchChunk.vector` are both `Unsupported("vector(768)")` columns with dedicated indexes; query path can search by vector
- [x] **Living thumbnails** — 5-stage progressive WebP pipeline ([thumbnail-pipeline.md](thumbnail-pipeline.md))
  - Stage 0: hash → color placeholder
  - Stage 1: 8×8 blur preview
  - Stage 2: 512px resize
  - Stage 3: ViT saliency crop with face-aware crop via native `FaceDetector` API
  - Stage 4: Florence-2 caption overlay (currently hidden from gallery — capped at stage 3)
- [x] **On-demand thumbnail backfill** — items that never got a thumbnail (upload interrupted, tab closed mid-pipeline) are regenerated lazily when they scroll into view: `app/utils/thumbnail-backfill.ts` + `useThumbnailBackfill`, re-fetching the source through `/api/thumbnails/:itemId/source` (`BACKFILL_MAX_BYTES` = 16 MB cap), with `upload-thumbnail-runner.tsx` owning the fetchers so the runner isn't duplicated per card
- [x] **Browser-side AI inference** — Transformers.js + ONNX Runtime (WebGPU with WASM fallback)
  - Whisper transcription (120+ languages)
  - Image captioning
  - Multilingual embeddings
- [x] **Gallery views** — Grid / River / Waterfall layouts with View Transition API morph between gallery and detail overlay
- [x] **In-browser code viewer** — `app/components/views/item-page/code-viewer.tsx` with a document outline rail (`code-outline.tsx`), embedded-SQL highlighting, JSDoc hover, automatic type acquisition for imported npm packages, and go-to-definition that resolves across the user's other uploaded files (PR #20) ([code-viewer.md](code-viewer.md))
- [x] **Item-page stage loading** — `text-stage`, `markdown-stage`, `pdf-stage`, and `code-viewer` share one `StageSkeletonLoader` with a closed 2px frame while the streamed body resolves
- [x] **Stash UI pass** — path-rail toolbar, `FileCardDetail` card variant, indigo primary (PR #21)
- [x] **Filters system** — compound `Filters` (`app/components/filters/`), standalone `SearchInput`, `useFilters` hook; replaced old `FilterList` (commit `205ef51`)
- [x] **AI Studio (prototype)** — `app/routes/stash/ai-studio.tsx`, committed and routed at `/:me/stash/ai-studio`. Still a static mockup of the transcription / language detect / summarization / keyword extraction / tag generation pipeline — it renders hardcoded `TRANSCRIPT` / `SUMMARY` constants and imports no worker or machine.
- [x] **Pipeline machine extraction** — `pipeline.machine.ts` split into 6 dedicated sub-machines (`languageDetectionMachine`, `transcriptionMachine`, `textCorrectionMachine`, `summarizationMachine`, `keywordExtractionMachine`, `tagGenerationMachine`); pipelineMachine is now a pure orchestrator. Plus GPU resilience, long-audio content hints, and GPU load balancer for correction. ([plan](superpowers/plans/2026-03-21-pipeline-machine-extraction.md), commits `b617d76`, `6846882`, `2f1aba2`, `b6e896c`, `ec5275d`, `946f50f`)

### In Progress

- [ ] **Semantic search — end-to-end wiring**
  - [x] PDF: client-side text extraction (`extractPdfText` in `app/utils/pdf.ts`, run in the compute worker as `pdfText`) → `documentText` field on `save_media_metadata` → `upsertSearchContent(itemId, content)` writes `Search.content`. Schema migration: `Search.vector` made nullable.
  - [x] Markdown: `mdMeta` compute-worker job feeds body text into the same `documentText` path (`isMarkdownFile` covers `.md/.markdown/.mdown/.mkd`)
  - [x] Chunked indexing + client-side embedding: the server is authoritative for chunk boundaries (`chunkText` → `upsertSearchChunks` returns `{id, content}` pairs), the browser embeds them on WebGPU (`embedTexts`) and posts them back via the `save_search_chunk_embeddings` intent → `setSearchChunkVectors` (raw SQL, pgvector text-cast)
  - [ ] Apply the same pattern to the remaining text formats (`.txt`, `.docx`, source files, etc.)
  - [ ] OCR for images, transcript for audio/video, EXIF/captions for photos — gather and persist
  - [x] Client-side embedding backfill — on a later visit the browser asks for its own chunks with a NULL vector (`pending_search_embeddings` intent → `findUnembeddedChunks`) and re-runs them through the same model: `app/hooks/useEmbeddingBackfill.ts` + policy in `app/utils/embedding-backfill.ts`, mounted once in the authenticated layout. Idle-scheduled, batched and capped so a large backlog spreads across visits. Keeps embedding cost on the client.
  - [ ] Server-side embedding backfill — the client heal above only fires when the owner returns, so a document whose owner never comes back stays unembedded. Also still true of the document-level `Search.vector`, which nothing writes yet. Needs a server-side or resumable pass.
  - [ ] Re-embed on relevant content changes (rename, description edit)
  - [ ] Backfill embeddings for items uploaded before the chunk pipeline landed

### Not Started

- [ ] **AI-powered organization** — auto-tag and categorize files based on content
- [ ] **Desktop sync client**
- [ ] **Mobile apps** (iOS / Android)
- [ ] **Third-party integrations** — Google Drive, Dropbox, Slack, Zapier
- [ ] **Public API**

---

## Phase 5: Analytics, Monetization & Growth — ⏳ Not Started

- [ ] **Tiered Subscription Plans** — Free / Pro / Business with different feature sets
- [ ] **Pay-as-you-go** — additional storage purchases
- [ ] **Referral Program**
- [ ] **Affiliate Program**
- [ ] **Analytics Dashboard** — file usage, sharing patterns

---

## Phase 6: Enterprise & Teams — ⏳ Not Started

- [ ] **SSO** — Okta, Auth0, SAML
- [ ] **Advanced Admin Controls** — granular team management
- [ ] **Audit Logs** — full activity for security/compliance
- [ ] **Data Residency** — choose storage region
- [ ] **SLAs** — uptime and support guarantees

---

## Active Cleanup / Tech Debt

Some are blocking the OSS-quality bar — Stashly is positioned as a reference implementation, so pre-existing rot is not minor.

### Done

- [x] **Temp schema consolidation** — `_temp_a/b/c.schemas.ts` no longer present (verified 2026-05-10).
- [x] **Search infra decision** — `app/.server/search/` directory deleted (2026-05-10). Pure utilities salvaged to `app/utils/search-text.ts` (`cleanText`, `buildSearchTextFromItem`); server adapter `mapItemToSearch` moved to `app/.server/search-actions.ts`. The old `searchFactory`/`buildItemFilters` from that dir were duplicates of the canonical `@/utils/search` and `@/utils/filters/item.filters` — `item-actions.ts` migrated.
- [x] **Empty stub modules** — `app/routes/api/ai.ts` and `app/routes/api/images.ts` had bulk-commented bodies causing cascading typegen errors. Replaced with valid 501-returning loader/action stubs (2026-05-10).
- [x] **Directory drops** — dropping a folder now preserves its nested hierarchy: `createUploadedItem()` calls `findOrCreateFolderPath()` (`app/.server/item-actions.ts`) to walk/create the intermediate folders and returns the resolved `parentId` instead of flattening to `rootId`. Follow-ups shipped: duplicate-folder race fix (`271aff0`) and path preservation when normalizing ambiguous `.ts` files (`4611702`).
- [x] **Flat UI item routes** — the UI route space no longer registers flat item/file routes; `app/routes.ts` only has the nested `stash/folders/:folderId/files/:fileId` (and the workspace equivalent).

### Open

- [ ] **Flat API routes** — `routes.ts` still registers a flat top-level path *and* a nested `items/:itemId/...` path for `shares`, `favorites`, `versions`, `invitations`, and `comments/*`; migrate callers to the nested form and drop the flat registrations (`pins`/`locks` are flat-only and out of scope) — see [`TASKS.md`](../TASKS.md)
- [ ] **Unused shadcn components** — 14 remain in `app/components/ui/` with no importer reaching outside `ui/`. Kept deliberately in the 2026-08-14 purge (never imported means never bundled, and re-adding is one `shadcn add`). Running inventory: [`orphaned.md`](orphaned.md).
- [ ] **Models without action files** — `Favorite`, `AuditLog`, `Trash`/`TrashItem`, `View` (`Thumbnail` now has reads — `getThumbnailByItemId` / `getThumbnailSource` in `thumbnail-actions.ts`)
- [ ] **Package update type errors** — `stripe.ts`, `subscription.ts`, `permission-actions.ts` (`workspaceItem.service.ts` and `subscription.machine.ts` no longer exist). Baseline after the 2026-08-14 purge is 209 `tsc` errors, down from 248
- [ ] **`@/services/*` imports inside route files** — `CLAUDE.md` bans the alias in `app/routes/` (dot-server plugin), but 42 route files still use it (25 under `routes/api/`, 13 under `routes/stash/`, incl. the long-deferred `app/routes/api/shares.ts`). Either finish the migration or re-confirm the constraint still holds for the current plugin version.
- [ ] **Test runner globals** — `vitest.config.ts` sets `globals: true`, but `tsconfig.json` has no `types: ["vitest/globals"]`, so `app/.server/__tests__/collection-actions.test.ts` still references `describe`/`it`/`expect` with no types in scope

---

## Future Ideas

- [ ] **Real-time Document Editing** — collaborative editor (Etherpad-style)
- [ ] **Encrypted Vaults** — client-side encryption for sensitive folders
- [ ] **Blockchain / NFT** — file verification, decentralized storage options
