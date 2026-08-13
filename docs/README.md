# Stashly Docs

Architecture and design documentation for the Stashly codebase.

## Architecture Docs

| File | Description |
|------|-------------|
| [project-overview.md](project-overview.md) | Full-stack architecture overview — tech stack, layer responsibilities, API surface, data model, key subsystems |
| [ai-pipeline.md](ai-pipeline.md) | AI inference pipeline — Transformers.js, WebGPU, Whisper transcription, language detection, Web Worker architecture |
| [upload-multipart.md](upload-multipart.md) | S3 multipart upload + post-upload DB item creation chain (`itemCreated` gate, `parentId` derivation) |
| [thumbnail-pipeline.md](thumbnail-pipeline.md) | 3-stage progressive WebP thumbnail pipeline — local blur preview, 512px resize, saliency crop — plus the compute worker and on-demand backfill |
| [semantic-search.md](semantic-search.md) | Chunked + hybrid (pg_trgm + pgvector) retrieval over document text — index pipeline, schema, tuning, roadmap |
| [quota-and-machines.md](quota-and-machines.md) | Storage quota — QuotaService singleton, `toUpdatedQuota` transformer, quota state machine, backend endpoint |
| [search.md](search.md) | Search architecture — pgvector semantic search, SearchFactory pattern, filter system |
| [routing-and-ui.md](routing-and-ui.md) | Route handles, dual-sidebar layout, pagination helpers, `runSearch` overloads |
| [sharing-and-invitations.md](sharing-and-invitations.md) | Share links + invitations — Permission model, link types, scopes, lifecycle, API reference |
| [suggestions-view.md](suggestions-view.md) | Suggestions view component — data flow, SQL aggregation patterns, route integration |
| [dev-notes.md](dev-notes.md) | TypeScript patterns, Prisma conventions, schema triggers, archived filter/search patterns |
| [notifications-sse.md](notifications-sse.md) | Live notification feed — Postgres `LISTEN`/`NOTIFY` bridge, SSE route, reconnect/reconcile, metrics |
| [upload-item-creation-summary.md](upload-item-creation-summary.md) | Post-upload DB chain — how an S3 key becomes an `Item`, including nested-folder resolution |
| [code-viewer.md](code-viewer.md) | Monaco-based code viewer — language support, go-to-definition across uploaded files |
| [code-viewer-cross-file-options.md](code-viewer-cross-file-options.md) | Decision record for cross-file navigation — the options weighed and the one that shipped |
| [roadmap.md](roadmap.md) | Product roadmap — shipped phases, current status, future work |
| [orphaned.md](orphaned.md) | Dead-code report — unimported files, re-verified 2026-08-13 (re-verify before deleting) |

## Reference

| File | Description |
|------|-------------|
| [data_profile_stashly _prisma_schema.md](data_profile_stashly%20_prisma_schema.md) | Prisma schema deep-dive — 56 models, 24 enums, entity relationships, index analysis |
| [stashly_structure_2026-04-01.txt](stashly_structure_2026-04-01.txt) | Full project file tree snapshot (generated 2026-04-01) |

## Superpowers Plans & Specs

Implementation plans and design specs for significant features. Plans use checkbox syntax for task tracking.

### Plans

| File | Status | Description |
|------|--------|-------------|
| [2026-03-20-pipeline-machine-in-worker.md](superpowers/plans/2026-03-20-pipeline-machine-in-worker.md) | Implemented | Move XState pipeline machine into `stash.worker.ts` so AI runs off the main thread |
| [2026-03-21-pipeline-machine-extraction.md](superpowers/plans/2026-03-21-pipeline-machine-extraction.md) | Implemented | Extract pipeline machine into 6 dedicated sub-machines (+ GPU resilience, content hints, GPU load balancer) |
| [2026-04-01-e2e-playwright.md](superpowers/plans/2026-04-01-e2e-playwright.md) | Implemented | Playwright E2E test setup — global-setup, fixtures, page object models |
| [2026-04-02-concurrent-multipart-upload.md](superpowers/plans/2026-04-02-concurrent-multipart-upload.md) | Implemented | Concurrent multipart upload — parallel chunk uploads, ETag tracking |
| [2026-04-04-multipart-upload-tests.md](superpowers/plans/2026-04-04-multipart-upload-tests.md) | Implemented | Contract tests for the multipart upload streaming layer |
| [2026-04-24-living-thumbnails.md](superpowers/plans/2026-04-24-living-thumbnails.md) | Implemented | 5-stage progressive thumbnail pipeline with WebP, race-condition fix |
| [2026-04-25-item-activities.md](superpowers/plans/2026-04-25-item-activities.md) | Implemented | Item activity timeline — create/rename/move/trash/share/comment/version events |
| [2026-05-15-pinned-items.md](superpowers/plans/2026-05-15-pinned-items.md) | Implemented | Pinned items — PinItem model, pin-actions.ts, /api/pins route, usePinItem hook, /:me/stash/pinned page |
| [2026-05-25-item-card-actions-compound.md](superpowers/plans/2026-05-25-item-card-actions-compound.md) | Implemented | Item card actions as a compound component — `ItemCard.Actions` with composable sub-actions |

### Specs

| File | Description |
|------|-------------|
| [2026-03-21-pipeline-machine-extraction-design.md](superpowers/specs/2026-03-21-pipeline-machine-extraction-design.md) | Design spec for pipeline machine extraction — XState 5 invocation chains, machine interfaces, error flow |
| [2026-04-01-e2e-playwright-design.md](superpowers/specs/2026-04-01-e2e-playwright-design.md) | Design spec for Playwright E2E — session injection, fixture pattern, test structure |
| [2026-04-02-concurrent-multipart-upload-design.md](superpowers/specs/2026-04-02-concurrent-multipart-upload-design.md) | Concurrent multipart upload design — parallel parts, completion ordering |
| [2026-04-04-multipart-upload-tests-design.md](superpowers/specs/2026-04-04-multipart-upload-tests-design.md) | Test design for multipart upload contract suite |
| [2026-04-24-living-thumbnails-design.md](superpowers/specs/2026-04-24-living-thumbnails-design.md) | Design spec for the 5-stage thumbnail pipeline |
| [2026-04-25-item-activities-design.md](superpowers/specs/2026-04-25-item-activities-design.md) | Design spec for the item activity timeline + drawer UI |
| [2026-05-25-item-card-actions-compound.md](superpowers/specs/2026-05-25-item-card-actions-compound.md) | Design spec for the item card actions compound component |
