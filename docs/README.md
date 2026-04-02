# Stashly Docs

Architecture and design documentation for the Stashly codebase.

## Architecture Docs

| File | Description |
|------|-------------|
| [project-overview.md](project-overview.md) | Full-stack architecture overview — tech stack, layer responsibilities, API surface, data model, key subsystems |
| [ai-pipeline.md](ai-pipeline.md) | AI inference pipeline — Transformers.js, WebGPU, Whisper transcription, language detection, Web Worker architecture |
| [upload-multipart.md](upload-multipart.md) | S3 multipart upload system — XState machine states, presigned URLs, Web Streams chunking, progress tracking |
| [quota-and-machines.md](quota-and-machines.md) | Storage quota — QuotaService singleton, `toUpdatedQuota` transformer, quota state machine, backend endpoint |
| [search.md](search.md) | Search architecture — pgvector semantic search, SearchFactory pattern, filter system |
| [routing-and-ui.md](routing-and-ui.md) | Route handles, dual-sidebar layout, pagination helpers, `runSearch` overloads |
| [suggestions-view.md](suggestions-view.md) | Suggestions view component — data flow, SQL aggregation patterns, route integration |
| [dev-notes.md](dev-notes.md) | TypeScript patterns, Prisma conventions, repository generation, archived filter/search patterns |
| [roadmap.md](roadmap.md) | Product roadmap — MVP phases, planned features, completion status |

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
| [2026-03-21-pipeline-machine-extraction.md](superpowers/plans/2026-03-21-pipeline-machine-extraction.md) | In progress | Extract pipeline machine into 6 dedicated sub-machines |
| [2026-04-01-e2e-playwright.md](superpowers/plans/2026-04-01-e2e-playwright.md) | Implemented | Playwright E2E test setup — global-setup, fixtures, page object models |

### Specs

| File | Description |
|------|-------------|
| [2026-03-21-pipeline-machine-extraction-design.md](superpowers/specs/2026-03-21-pipeline-machine-extraction-design.md) | Design spec for pipeline machine extraction — XState 5 invocation chains, machine interfaces, error flow |
| [2026-04-01-e2e-playwright-design.md](superpowers/specs/2026-04-01-e2e-playwright-design.md) | Design spec for Playwright E2E — session injection, fixture pattern, test structure |
