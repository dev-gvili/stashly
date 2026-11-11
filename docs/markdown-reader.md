# Markdown Reader

The stage that renders an uploaded `.md` file at `/:me/stash/folders/:folderId/files/:fileId` (`app/routes/stash/file.tsx`). Body text streams from S3, headings become a navigable outline, fenced code is tokenized by the *editor's* tokenizer, and ```mermaid fences are drawn as diagrams — all client-side, all in the Ink palette.

Entry point: `app/components/views/item-page/markdown-stage.tsx`, with `app/components/views/item-page/mermaid-block.tsx` and the two `.client/` modules it lazily reaches for. Block styling lives in `.markdown-stage` in `app/styles/globals.css` — those nodes come out of react-markdown and are outside Tailwind's reach.

---

## Table of Contents

1. [Streaming the Document](#1-streaming-the-document)
2. [Pipeline and Sanitization](#2-pipeline-and-sanitization)
3. [Links](#3-links)
4. [Code Blocks — the Monaco Ink Theme](#4-code-blocks--the-monaco-ink-theme)
5. [Mermaid Diagrams](#5-mermaid-diagrams)
6. [Theme Flips](#6-theme-flips)

---

## 1. Streaming the Document

The file loader reads the Markdown body from S3 and returns it as an **unawaited promise** (React Router deferred data). `MarkdownStage` consumes it with `<Suspense>` + `<Await>`, so the page shell — breadcrumbs, item panel, toolbar — paints immediately while the document is still in flight. This is the canonical example of the "stream large/slow loader payloads" rule in `CLAUDE.md`.

`markdownDoc` resolves to `{ text, headings }`. Headings are extracted server-side (`app/utils/markdown.ts`) so the outline rail can render in the same pass as the body, rather than waiting for a DOM walk after hydration.

The `errorElement` and the `null` case are both handled by `MarkdownError` — a document that fails to load says so instead of rendering an empty stage.

## 2. Pipeline and Sanitization

```
remark-gfm  →  rehype-sanitize  →  rehype-slug
```

Order matters: **sanitize runs before slug**, so the heading ids `rehype-slug` adds are never stripped by the sanitizer that would otherwise not recognise them.

The schema starts from `rehype-sanitize`'s GitHub-flavoured default — which already blocks `javascript:` hrefs, event handlers and `<script>` — and additionally allows:

| Addition | Why |
|---|---|
| `className` on `*` | Task-list classes and the `language-*` fence classes the code path keys off |
| `target` / `rel` on `a` | External links open in a new tab |
| `loading` on `img` | Lazy loading |
| `style` on `td` / `th` | Per-cell `text-align` from GFM tables |

Uploaded Markdown is **untrusted content**. Every decision below that looks over-cautious — mermaid's security level, the escaped colorizer output — follows from that one fact.

## 3. Links

`MarkdownLink` splits three cases, because one document mixes them freely:

| Href | Rendered as | Why |
|---|---|---|
| `#heading` | plain `<a>` | `rehype-slug` already put the id on the heading; a router navigation would lose the scroll |
| `https://…`, `mailto:…`, `//host` | plain `<a target="_blank">` | leaves the app |
| anything relative | router `<Link>` | points at another *uploaded* file — the file route re-renders in place |

Relative hrefs resolve through `new URL(href, base)` rather than `<Link relative="path">`: React Router treats the current pathname as a directory, so `other.md` would land on `/…/files/current/other.md`, while a browser treats the last segment as a file and yields `/…/files/other.md` — which is what an author writing `[x](other.md)` means. The dummy origin keeps this working during SSR, where there is no `window.location`.

The resulting `:fileId` is a **file name, not an item id**. The file loader (`app/routes/stash/file.tsx`) resolves a `:fileId` that isn't an item id against the containing folder before anything else runs, which is what makes `[spec](upload-multipart.md)` work inside a stash.

## 4. Code Blocks — the Monaco Ink Theme

Two different mechanisms, on purpose:

**Inline code** (`` `useThumbnail` ``) is styled by CSS alone — `--muted` background, `--md-ink-hue` text. A backticked span is almost always an identifier, and identifiers carry the hue in the Ink rules.

**Fenced blocks** are tokenized by Monaco itself. `colorizeCode(code, lang)` in `app/.client/monaco.ts` resolves the fence info-string to a language id through the same extension registry the code viewer uses (so `ts`, `sh`, `py` and friends resolve for free, and anything unknown falls back to `plaintext`), applies the Ink theme, and returns HTML of `<span class="mtkN">` tokens. One theme object serves both the editor and the reader — there is no second palette to keep in sync.

> **The trap: `ensureTokenStyles`.** Monaco's standalone theme service writes its `.mtkN` colour rules only for *registered editor containers*. `setTheme()` updates stylesheets it has already emitted and emits none if no editor was ever created — so on a page with no editor, colorized spans render unstyled and inherit `--foreground`, producing a block that looks exactly as flat as an untokenized one. `ensureTokenStyles()` mounts one throwaway 0×0 editor and disposes it immediately; Monaco's container registration returns `Disposable.None`, so the global style element outlives the editor and keeps tracking later theme flips.

The block's chrome comes from `.markdown-stage pre` in `globals.css` and maps 1:1 onto the editor: `--card` is `editor.background`, `--input` is `editorWidget.border`, and the type is 13px JetBrains Mono (`EDITOR_FONT_SIZE`). A `::before` badge labels the block by its `language-*` class.

`--md-ink-hue` is scoped to `.markdown-stage` deliberately and mirrors `INK_HUE` in `monaco.ts`. It is hand-picked syntax colour, **not a design token** — do not promote it to `:root`.

## 5. Mermaid Diagrams

A ```mermaid fence renders as an SVG figure. `MarkdownPre` intercepts it at the `<pre>` level — a diagram has no business inside a `white-space: pre` monospace box — and hands the source to `MermaidBlock`; every other fence falls through untouched and is coloured by the code path above.

**Rendering is client-side, and that is a decision, not an accident:**

- Mermaid lays graphs out by measuring rendered text (`getBBox` on live SVG). jsdom does not implement it, so server rendering means headless Chromium in the image — not a library.
- The SVG it emits carries literal hex, never CSS variables. A server render bakes in one palette, and a theme flip would have to swap between two of them.
- Diagram source is uploaded content, and diagrams can reference external images. Rendering that server-side turns any shared `.md` into an SSRF primitive against the internal network; in the reader's browser the same request is merely cross-origin.
- It matches the house pattern — OCR, embeddings and the thumbnail pipeline all run in the browser here.

`app/.client/mermaid.ts` owns the render. Points that will bite anyone editing it:

| Concern | Handling |
|---|---|
| **oklch** | Mermaid runs every theme colour through khroma, which cannot parse the `oklch()` that `getComputedStyle` returns for this repo's tokens — an unparseable colour throws mid-layout. Colours are flattened to `#rrggbb` through a 1×1 canvas first. `monaco.ts` holds a twin of that helper; sharing it would pull the whole editor into the diagram chunk and defeat the lazy load. |
| **Security** | `securityLevel: 'strict'` with `flowchart.htmlLabels: false`. Mermaid's `'loose'` level lets node labels carry arbitrary HTML — stored XSS in any shared document. `<br/>` still breaks a line via SVG `<text>`. |
| **Palette** | Nodes are `--muted` filled and outlined in `--md-ink-hue`, the same indigo identifiers wear in a code block. Edges stay `--muted-foreground` so arrows don't wash the diagram in accent; subgraphs read as a `--border` frame on `--card`. Read from the block's own element, not `:root`, because `--md-ink-hue` is scoped to `.markdown-stage`. |
| **Config timing** | Mermaid keeps one global config with no per-call theme override, so it is re-initialized per render. |
| **Failure** | A diagram that does not parse falls back to the ordinary tokenized code block with the error named beneath it. The source is the content; blanking it would lose what someone wrote. |
| **Weight** | `mermaid` is reachable only through a dynamic `import()` inside an effect. A document with no diagram never downloads it. |

## 6. Theme Flips

Both code blocks and diagrams listen to the same two signals — a `data-theme` mutation on `<html>` (Alt+T) and the `prefers-color-scheme` media query behind 'system' — but they respond differently, and the difference is worth understanding before "optimizing" either one:

- **Code blocks re-tokenize.** Monaco emits colour-map *indices*, not colours. A flip rebuilds the map, so the `mtkN` numbers already in the DOM point at the wrong colours. Restyling cannot fix that; only re-running `colorizeCode` can.
- **Diagrams redraw.** Mermaid bakes hex into the SVG it emits, leaving no CSS variables to re-resolve.

---

## Related Documentation

- [`docs/code-viewer.md`](code-viewer.md) — the Monaco viewer whose theme and tokenizer this stage borrows
- [`docs/routing-and-ui.md`](routing-and-ui.md) — route handles and the dual-sidebar layout the reader sits in
- [`docs/semantic-search.md`](semantic-search.md) — how the same Markdown body gets chunked and indexed
