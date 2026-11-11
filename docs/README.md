# Stashly docs

How the code works, one page per subsystem. Day-to-day conventions are in
[`CLAUDE.md`](../CLAUDE.md) and the skills in `.claude/skills/`. Pages were
last checked against `main` on 2026-11-12.

## Start here

| Page | What it covers |
|---|---|
| [project-overview.md](project-overview.md) | The stack, how a request flows, the layout of `app/`, the data model, access, the API surface, and links to every subsystem |
| [roadmap.md](roadmap.md) | What is built, half built and missing |

## Subsystems

| Page | What it covers |
|---|---|
| [upload-multipart.md](upload-multipart.md) | Multipart upload to S3, the file and db machines, row creation, folder drops, the `itemCreated` gate |
| [quota-and-machines.md](quota-and-machines.md) | Per-drive quota: status, where it is charged and refunded, `/api/quota`, the client actors |
| [thumbnail-pipeline.md](thumbnail-pipeline.md) | Thumbnails made for visible cards, the scheduler lanes, stages, the compute worker, private storage and signing |
| [search.md](search.md) | The search feature (two-pass query, rankers, RRF, match kinds, view) and the `searchFactory` list queries and filters |
| [semantic-search.md](semantic-search.md) | The search index: text sources, chunking, embeddings, OCR, recovery, tunable parameters |
| [ai-pipeline.md](ai-pipeline.md) | Every model that runs in the browser and where it is used, the WebGPU queue, OCR engines, embedding backfill |
| [notifications-sse.md](notifications-sse.md) | Live notifications: Postgres `NOTIFY` → `LISTEN` bridge → SSE → client reducer; metrics and pooling |
| [sharing-and-invitations.md](sharing-and-invitations.md) | Share links (no route serves them yet) and invitations |
| [code-viewer.md](code-viewer.md) | The Monaco code viewer: language services, hover, outline, Go to Definition, Format Document, embedded SQL |
| [markdown-reader.md](markdown-reader.md) | The Markdown stage: streaming, sanitising, links, Monaco-coloured code blocks, Mermaid |
| [routing-and-ui.md](routing-and-ui.md) | Route handles, the multi-sidebar provider, `usePagination` and the server pagination helpers |
| [dev-notes.md](dev-notes.md) | Item and its facets, trigger-kept counters, typing patterns |

## Reference

| Page | What it covers |
|---|---|
| [data_profile_stashly _prisma_schema.md](data_profile_stashly%20_prisma_schema.md) | Every model and enum, indexes, and the current definition of each database function and trigger |
| [tech-debt.md](tech-debt.md) | The tech-debt register: each item with its evidence, fix and measurements |

## Records

Dated documents kept because other pages cite them. They describe the code as
it was on their date.

| Page | What it is |
|---|---|
| [code-viewer-cross-file-options.md](code-viewer-cross-file-options.md) | Why cross-file type resolution was built the way it was |
| [upload-call-audit.md](upload-call-audit.md) | Every call one upload made on 10 Oct 2026, re-measured 31 Oct; source of tech-debt items 31–44 |
| [Stashly upload load audit.pdf](Stashly%20upload%20load%20audit.pdf) | Upload load audit cited by tech-debt.md; also the scanned PDF the OCR engines were measured on |
| [project-analysis-2026-10-04.md](project-analysis-2026-10-04.md) | Read-only project analysis of 4 Oct 2026, cited by tech-debt.md |
| [superpowers/plans/2026-10-30-size-rollup-delta-log.md](superpowers/plans/2026-10-30-size-rollup-delta-log.md) | Plan and outcome of the upload size log (tech-debt item 42) |
| [design-critique/stash-browser-critique.md](design-critique/stash-browser-critique.md), [design-critique/item-page-critique.md](design-critique/item-page-critique.md) | UI reviews of 24 Sep 2026, cited by tech-debt.md |

The other files in this folder (session hand-overs, finished implementation
plans and specs, a session transcript, a duplicate of the
upload audit, an April file-tree snapshot and the old suggestions-view page)
are proposed for removal and wait for the owner's decision.
