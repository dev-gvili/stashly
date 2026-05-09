# Stashly Docs

Architecture and design documentation for the Stashly codebase.

## Architecture Docs

| File | Description |
|------|-------------|
| [project-overview.md](project-overview.md) | Full-stack architecture overview — tech stack, layer responsibilities, API surface, data model, key subsystems |
| [ai-pipeline.md](ai-pipeline.md) | AI inference pipeline — Transformers.js, WebGPU, Whisper transcription, language detection, Web Worker architecture |
| [upload-multipart.md](upload-multipart.md) | S3 multipart upload + post-upload DB item creation chain (`itemCreated` gate, `parentId` derivation) |
| [thumbnail-pipeline.md](thumbnail-pipeline.md) | 5-stage progressive WebP thumbnail pipeline — color hash, blur, resize, ViT saliency, Florence-2 caption |
| [quota-and-machines.md](quota-and-machines.md) | Storage quota — QuotaService singleton, `toUpdatedQuota` transformer, quota state machine, backend endpoint |
| [search.md](search.md) | Search architecture — pgvector semantic search, SearchFactory pattern, filter system |
| [routing-and-ui.md](routing-and-ui.md) | Route handles, dual-sidebar layout, pagination helpers, `runSearch` overloads |
| [sharing-and-invitations.md](sharing-and-invitations.md) | Share links + invitations — Permission model, link types, scopes, lifecycle, API reference |
| [suggestions-view.md](suggestions-view.md) | Suggestions view component — data flow, SQL aggregation patterns, route integration |
| [dev-notes.md](dev-notes.md) | TypeScript patterns, Prisma conventions, schema triggers, archived filter/search patterns |
| [roadmap.md](roadmap.md) | Product roadmap — shipped phases, current status, future work |

## Reference

| File | Description |
|------|-------------|
| [data_profile_stashly _prisma_schema.md](data_profile_stashly%20_prisma_schema.md) | Prisma schema deep-dive — 44 models, 17 enums, entity relationships, index analysis |
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

### Specs

| File | Description |
|------|-------------|
| [2026-03-21-pipeline-machine-extraction-design.md](superpowers/specs/2026-03-21-pipeline-machine-extraction-design.md) | Design spec for pipeline machine extraction — XState 5 invocation chains, machine interfaces, error flow |
| [2026-04-01-e2e-playwright-design.md](superpowers/specs/2026-04-01-e2e-playwright-design.md) | Design spec for Playwright E2E — session injection, fixture pattern, test structure |
| [2026-04-02-concurrent-multipart-upload-design.md](superpowers/specs/2026-04-02-concurrent-multipart-upload-design.md) | Concurrent multipart upload design — parallel parts, completion ordering |
| [2026-04-04-multipart-upload-tests-design.md](superpowers/specs/2026-04-04-multipart-upload-tests-design.md) | Test design for multipart upload contract suite |
| [2026-04-24-living-thumbnails-design.md](superpowers/specs/2026-04-24-living-thumbnails-design.md) | Design spec for the 5-stage thumbnail pipeline |
| [2026-04-25-item-activities-design.md](superpowers/specs/2026-04-25-item-activities-design.md) | Design spec for the item activity timeline + drawer UI |
