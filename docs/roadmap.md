# Engineering status

What is built, what is only half built, and what is missing, checked against
the code on 2026-11-12. The product roadmap is [`Roadmap.md`](../Roadmap.md)
at the repo root; open engineering problems with their evidence are in
[tech-debt.md](tech-debt.md).

## Built

| Area | What works | Docs |
|---|---|---|
| Accounts | better-auth with GitHub, Google and Microsoft; onboarding creates the bucket, subscription, drive, quota and root folder (`app/machines/onboard/`) | |
| Upload | multipart straight to S3, folder drops keep their structure, one-statement row creation with the quota charge, new rows appear without a reload | [upload-multipart.md](upload-multipart.md) |
| Files and folders | browse, rename, move, copy, trash, restore, permanent delete; trash view with folders inside it | `stashly-item-lifecycle` skill |
| Quota and billing | per-drive quota charged on the server, Stripe subscriptions with a webhook at `/api/stripe` | [quota-and-machines.md](quota-and-machines.md) |
| Collections, favorites, pins | pages under `/:me/stash/`, pins ordered by position | |
| Item page | viewers for images, video, audio, PDF, Markdown, text and code; Monaco code viewer with hover types, outline, Go to Definition across uploaded files, Format Document | [code-viewer.md](code-viewer.md), [markdown-reader.md](markdown-reader.md) |
| Thumbnails | made in the browser for visible cards, stored privately and signed on read | [thumbnail-pipeline.md](thumbnail-pipeline.md) |
| Search | keyword plus semantic ranking fused with RRF; PDFs, Markdown and text formats indexed, scanned PDFs read by OCR; unembedded chunks healed on a later visit | [search.md](search.md), [semantic-search.md](semantic-search.md) |
| Gallery | Images and Videos pages with grid, river and waterfall layouts | `stashly-gallery-views` skill |
| Invitations | item and workspace invitations, multi-recipient, accept / reject / undo / cancel, received and sent views | [sharing-and-invitations.md](sharing-and-invitations.md) |
| Shared with me | `/:me/stash/shares` lists items shared with the user (`getItemsSharedWithUser`) | |
| Notifications | live feed over SSE from Postgres `LISTEN`/`NOTIFY` | [notifications-sse.md](notifications-sse.md) |
| Storage | storage overview and the duplicates triage page | |
| Observability | Vinktar analytics and errors (server and browser), structured logs through `log`, Prometheus metrics at `/api/metrics` | CLAUDE.md → Integrations |
| CI | `check` (typecheck gate, unit tests against Postgres with pgvector), `e2e` (Playwright), `docker` (image build) | `.github/workflows/ci.yml` |

## Half built

- **Share links.** Can be created, changed and revoked through `/api/shares`,
  but no route serves a link's URL, so nobody can use one yet.
- **Workspaces.** Routes are registered under `/:me/workspaces/:workspaceId/*`.
  The workspace page (`workspace.tsx`) and trash (`trash.tsx`) have real views,
  and the folder and gallery routes reuse the stash ones. Index, file,
  collections, collection, members, settings, shares, favorites and recent are
  13 to 20-line placeholders. `workspaces/create.tsx` is not registered, so
  there is no way to create a workspace in the UI.
- **Comments and versions.** `comment-actions.ts` / `/api/comments` and
  `version-actions.ts` / `/api/versions` exist; no component calls them.
- **Audio pipeline.** Language detection, transcription, correction, summary,
  keywords and tags run in a worker, but only the `/:me/stash/demo` page uses
  it. `/:me/stash/ai-studio` is a static mock-up. `/api/ai/*` answers 501.
- **Notification settings.** `settings/notifications.tsx` is a placeholder.

## Known gaps

- Search covers only the user's own items, not items shared with them.
- A rename, edit or new version doesn't re-index an item; chunks whose owner
  never returns stay without vectors.
- Flat API routes are still registered next to the nested `items/:itemId/…`
  ones for shares, favorites, versions, invitations and comments
  (`app/routes.ts`); see [`TASKS.md`](../TASKS.md).
- `pnpm typecheck` has a baseline of known errors in `.claude/tsc-baseline.json`;
  CI fails only on new ones.

## Not started

Desktop and mobile clients, third-party integrations, a public API, SSO, and
organisation-level admin and audit features.
