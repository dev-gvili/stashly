# Stashly Project Roadmap

Last updated: **2026-05-16**

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

- [x] **Multipart upload** — `app/machines/upload/upload.machine.ts` parent + `file.machine.ts` per file, `actors/queue.machine.ts` (5-slot concurrency), `actors/quota.machine.ts`
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

### Backend Only — Awaiting UI

These all have working `*-actions.ts` files and API routes wired, but **no UI consumers** exist yet. The settings/notifications route is a 17-line stub returning `<div>Notifications Route</div>`.

- [ ] **Comments** — `comment-actions.ts` + `/api/comments` exist; `CommentsThreadPanel.tsx` component file is present but not mounted from any route or item view
- [ ] **Versions** — `version-actions.ts` + `/api/versions` exist; no `VersionList` / `VersionHistory` UI; no UI to trigger version creation or restore
- [ ] **Notifications** — `notification-actions.ts` + `/api/notifications` exist; settings route is a TODO stub; no notification feed UI, no toast/inbox surface
- [ ] **Workspace Invitations** — `invitation-actions.ts` exists; no invite-flow UI
- [ ] **Item Invitations** — backend wiring present; no invite-flow UI

### Workspaces — Routes Stubbed, Views Missing

The workspace URL space is registered in `app/routes.ts` and routes exist for index/create/folder/file/collection/members/settings/shares/favorites/recent — but every route file is a 13–30-line skeleton. **Only `workspaces/trash.tsx` (~149 lines) has any real UI.**

- [x] Schema — `Workspace`, `WorkspaceMember`, role enum (Owner / Admin / Member / Viewer)
- [x] `workspace-actions.ts` — backend membership management
- [x] Routing structure — `/:me/workspaces/:workspaceId/*` registered
- [ ] Workspace views — index, create, folder, file, collection, members, settings, shares, favorites, recent are all stub files
- [ ] Member management UI
- [ ] Workspace creation flow
- [ ] Role change UI

See: [`docs/sharing-and-invitations.md`](sharing-and-invitations.md) for the share/invitation backend model.

---

## Phase 4: Advanced Features & Intelligence — 🚧 Partial

### Shipped

- [x] **Full-text search** — PostgreSQL `search` field with filters (type, date, workspace)
- [x] **Semantic search infrastructure** — pgvector extension installed; `sentence-transformers/all-MiniLM-L6-v2` (384-dim embeddings, cosine distance) wired into the embed worker; query path can search by vector
- [x] **Living thumbnails** — 5-stage progressive WebP pipeline ([thumbnail-pipeline.md](thumbnail-pipeline.md))
  - Stage 0: hash → color placeholder
  - Stage 1: 8×8 blur preview
  - Stage 2: 512px resize
  - Stage 3: ViT saliency crop with face-aware crop via native `FaceDetector` API
  - Stage 4: Florence-2 caption overlay (currently hidden from gallery — capped at stage 3)
- [x] **Browser-side AI inference** — Transformers.js + ONNX Runtime (WebGPU with WASM fallback)
  - Whisper transcription (120+ languages)
  - Image captioning
  - Multilingual embeddings
- [x] **Gallery views** — Grid / River / Waterfall layouts with View Transition API morph between gallery and detail overlay
- [x] **Filters system** — compound `Filters` (`app/components/filters/`), standalone `SearchInput`, `useFilters` hook; replaced old `FilterList` (commit `205ef51`)
- [x] **AI Studio (prototype)** — `app/routes/stash/ai-studio.tsx` — UI mockup for transcription / language detect / summarization / keyword extraction / tag generation pipeline (uncommitted, not wired to real workers yet)
- [x] **Pipeline machine extraction** — `pipeline.machine.ts` split into 6 dedicated sub-machines (`languageDetectionMachine`, `transcriptionMachine`, `textCorrectionMachine`, `summarizationMachine`, `keywordExtractionMachine`, `tagGenerationMachine`); pipelineMachine is now a pure orchestrator. Plus GPU resilience, long-audio content hints, and GPU load balancer for correction. ([plan](superpowers/plans/2026-03-21-pipeline-machine-extraction.md), commits `b617d76`, `6846882`, `2f1aba2`, `b6e896c`, `ec5275d`, `946f50f`)

### In Progress

- [ ] **Semantic search — end-to-end wiring**
  - [x] PDF: client-side text extraction (`extractPdfText` in `app/utils/pdf.ts`) → `documentText` field on `save_media_metadata` → `upsertSearchContent(itemId, content)` writes `Search.content` (vector left null pending embedding). Schema migration: `Search.vector` made nullable.
  - [ ] Apply the same pattern to other text formats (`.txt`, `.md`, `.docx`, etc.)
  - [ ] OCR for images, transcript for audio/video, EXIF/captions for photos — gather and persist
  - [ ] Hook embedding generation into the upload completion path — backfill `Search.vector` after `Search.content` is written. Decide: server-side embedding (env-aware, slower) vs client-side worker.
  - [ ] Re-embed on relevant content changes (rename, description edit)
  - [ ] Backfill embeddings for existing items once the pipeline is live

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

Some are blocking the OSS-quality bar (see [`user_project_vision.md`](../C:/Users/PoshI/.claude/projects/x--stashly/memory/user_project_vision.md) — Stashly is positioned as a reference implementation; pre-existing rot is not minor).

### Done

- [x] **Temp schema consolidation** — `_temp_a/b/c.schemas.ts` no longer present (verified 2026-05-10).
- [x] **Search infra decision** — `app/.server/search/` directory deleted (2026-05-10). Pure utilities salvaged to `app/utils/search-text.ts` (`cleanText`, `buildSearchTextFromItem`); server adapter `mapItemToSearch` moved to `app/.server/search-actions.ts`. The old `searchFactory`/`buildItemFilters` from that dir were duplicates of the canonical `@/utils/search` and `@/utils/filters/item.filters` — `item-actions.ts` migrated.
- [x] **Empty stub modules** — `app/routes/api/ai.ts` and `app/routes/api/images.ts` had bulk-commented bodies causing cascading typegen errors. Replaced with valid 501-returning loader/action stubs (2026-05-10).

### Open

- [ ] **Flat item routes** — flat versions still registered alongside nested; migrate callers and remove flat
- [ ] **Orphaned UI components** — `dropbox ui/`, `Gemini3Dashboard*.tsx`, `FileManagementDashboard.tsx`, `file-uploader.tsx`, `Gallery.tsx` legacy etc. — substantial component dust. Many cause typecheck errors due to references to nonexistent modules / removed icon names.
- [ ] **Models without action files** — `Favorite`, `AuditLog`, `Thumbnail` (read), `Trash`/`TrashItem`, `View`
- [ ] **Package update type errors** — `workspaceItem.service.ts`, `stripe.ts`, `subscription.ts`, `subscription.machine.ts`, `upload/file.machine.ts`, `permission-actions.ts`
- [ ] **Directory drops** — nested intermediate folders are not currently created (files drop to `rootId`)
- [ ] **`app/routes/api/shares.ts`** — dot-server import fix deferred
- [ ] **Test runner globals** — `app/.server/__tests__/collection-actions.test.ts` references `describe`/`it`/`expect` without `vitest/globals` types in scope

---

## Future Ideas

- [ ] **Real-time Document Editing** — collaborative editor (Etherpad-style)
- [ ] **Encrypted Vaults** — client-side encryption for sensitive folders
- [ ] **Blockchain / NFT** — file verification, decentralized storage options
