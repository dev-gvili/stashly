/**
 * Monaco (VS Code's editor) wired up as a read-only code viewer. Lives in
 * `.client/` so the server bundle never evaluates it — consumers dynamic-import
 * this module from a browser-only effect (same contract as `@/utils/pdf`).
 *
 * Monaco brings language tokenization, the find widget, folding, minimap and
 * — critically — virtualized rendering, so huge logs/scripts don't blow up the
 * DOM the way per-line React rendering did.
 *
 * Theming: the editor chrome is derived at runtime from the app's Ink design
 * tokens (`--card`, `--foreground`, …), so it stays in lock-step with
 * globals.css. Syntax is duotone — greys from the tokens plus one dusty
 * indigo reserved for strings — since a monochrome system has no hues to
 * inherit and Monaco's default rainbow fights the Ink shell.
 */
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { applyAliasPaths } from './cross-file-types'
import { watchOutline } from './monaco-outline'
import { canFormatLanguage, formatDocument } from './prettier'
import type { SourceContext } from './cross-file-types'
import type { OutlineSymbol, OutlineTarget } from './monaco-outline'

/**
 * Language services, keyed by worker label. Each workerManager passes its own
 * language id as the label (`label: this._defaults.languageId`), so these keys
 * are exactly the ids `languageForFile` returns.
 *
 * These are what back hover cards: types and JSDoc for TS/JS, schema-aware
 * structure for JSON, MDN property docs for CSS, and tag/attribute reference
 * for HTML. Anything not listed falls through to the base worker and
 * tokenizes on the main thread with Monarch, which is all a viewer needs.
 *
 * Vite only fetches a `?worker` chunk when its constructor runs, so each of
 * these is downloaded the first time someone opens a matching file and never
 * for anyone else — which matters most for TypeScript, far the largest.
 */
const LANGUAGE_WORKERS: Record<string, () => Worker> = {
  typescript: () => new TypeScriptWorker(),
  javascript: () => new TypeScriptWorker(),
  json: () => new JsonWorker(),
  css: () => new CssWorker(),
  scss: () => new CssWorker(),
  less: () => new CssWorker(),
  html: () => new HtmlWorker(),
  handlebars: () => new HtmlWorker(),
  razor: () => new HtmlWorker(),
}

self.MonacoEnvironment = {
  getWorker: (_workerId: string, label: string) =>
    LANGUAGE_WORKERS[label]?.() ?? new EditorWorker(),
}

/**
 * Put the language service in "one orphan file" mode.
 *
 * The viewer holds a single uploaded file with no tsconfig, no node_modules
 * and no sibling sources, so *semantic* diagnostics are guaranteed wrong —
 * every import resolves to nothing and every cross-file symbol is missing.
 * They're off. Syntax diagnostics stay on because those are real: they only
 * depend on the bytes in front of us.
 *
 * Hover is unaffected by either switch (it's `getQuickInfoAtPosition`), so
 * types still resolve for everything the file defines itself plus the whole
 * standard library, which ts.worker bundles.
 *
 * The built-in hover is replaced (see `registerTsHover`): Monaco's own
 * `tagToString` renders JSDoc far more crudely than VSCode does.
 */
function configureTypeScript() {
  const ts = monaco.typescript
  const compilerOptions: monaco.typescript.CompilerOptions = {
    allowJs: true,
    // Our model URIs aren't real paths; without this the service ignores them.
    allowNonTsExtensions: true,
    checkJs: false,
    esModuleInterop: true,
    // Preserve keeps JSX as written — the viewer shows source, never emit.
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmit: true,
    skipLibCheck: true,
    // Widest lib the worker ships (esnext + DOM), so `document`, `Promise`,
    // array methods and friends all hover with their real signatures.
    target: ts.ScriptTarget.ESNext,
  }
  const diagnosticsOptions: monaco.typescript.DiagnosticsOptions = {
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  }

  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    defaults.setCompilerOptions(compilerOptions)
    defaults.setDiagnosticsOptions(diagnosticsOptions)
    defaults.setEagerModelSync(true)
    // Turn off Monaco's own hover so our provider isn't a duplicate stacked
    // on top of it. Every other built-in feature stays on. tsMode reads this
    // when the language is first set up, which is why it must be set before
    // the first .ts/.js model is created.
    defaults.setModeConfiguration({
      ...defaults.modeConfiguration,
      hovers: false,
    })
  }

  registerTsHover()
}

// ---------------------------------------------------------------------------
// VSCode-parity JSDoc hover
//
// Monaco's built-in `tagToString` (languageFeatures.js) flattens JSDoc: it
// emits `@param name — - text` (a doubled dash, because the `-` in the source
// is never stripped), never fences `@example` code, and passes `{@link X}`
// through with its literal braces. VSCode's `previewer.ts` does none of that.
// This is a faithful port of that formatter over the same quick-info the
// worker already returns.
// ---------------------------------------------------------------------------

/** Command that reveals a `{@link}` target's definition; see `registerTsHover`. */
const REVEAL_TARGET_COMMAND = 'stashly.revealJsDocTarget'

/** A link part's `target`: which file + span the symbol is declared at. */
type TsLinkTarget = { fileName?: string; textSpan?: { start: number; length: number } }
/** A `ts.SymbolDisplayPart` — `{ text, kind }`, plus link `target` when kind is a link. */
type TsPart = { text: string; kind?: string; target?: TsLinkTarget }
/** A `ts.JSDocTagInfo`. `text` is parts in modern TS, a bare string in old. */
type TsTag = { name: string; text?: TsPart[] | string }
/** Everything the formatter needs about the hovered model to build links. */
type HoverContext = { uri: string }

/** Flatten display parts to plain text (used for the signature line). */
function partsToString(parts: TsPart[] | undefined): string {
  return parts ? parts.map((p) => p.text).join('') : ''
}

/**
 * Turn one resolved `{@link}` / `{@see}` reference into markdown.
 *
 * VSCode's three branches, kept intact:
 *  - target in *this* file → a command link that reveals the declaration.
 *    Cross-file targets (the stdlib, other modules) can't be revealed in a
 *    single-file viewer, so they fall through to text rather than dangle.
 *  - a bare URL → an ordinary markdown link.
 *  - anything else → plain text (never literal `{@link …}` braces).
 */
function linkToMarkdown(
  link: { name?: string; text?: string; target?: TsLinkTarget },
  ctx: HoverContext
): string {
  const label = link.text ?? link.name ?? ''
  if (!label) return ''

  const span = link.target?.textSpan
  if (span && link.target?.fileName === ctx.uri) {
    const arg = { uri: ctx.uri, start: span.start, length: span.length }
    const href = `command:${REVEAL_TARGET_COMMAND}?${encodeURIComponent(
      JSON.stringify([arg])
    )}`
    return `[${label}](${href})`
  }
  if (/^https?:\/\//i.test(label.trim())) {
    return `[${label}](${label.trim()})`
  }
  return label
}

/**
 * Render doc-comment parts to markdown. Link parts (`{@link}` and the ones
 * inside `@see`) become real links via `linkToMarkdown`; everything else is
 * passed through.
 */
function docPartsToMarkdown(
  text: TsPart[] | string | undefined,
  ctx: HoverContext
): string {
  if (!text) return ''
  if (typeof text === 'string') return stripInlineLinkTags(text)

  let out = ''
  let link: { name?: string; text?: string; target?: TsLinkTarget } | undefined
  for (const part of text) {
    if (part.kind === 'link') {
      if (link) {
        out += linkToMarkdown(link, ctx)
        link = undefined
      } else {
        link = {}
      }
    } else if (part.kind === 'linkName') {
      if (link) {
        link.name = part.text
        link.target = part.target
      }
    } else if (part.kind === 'linkText') {
      if (link) link.text = part.text
    } else if (!link) {
      out += part.text
    }
  }
  if (link) out += linkToMarkdown(link, ctx)
  return stripInlineLinkTags(out)
}

/** Fallback for `{@link}`/`{@linkcode}` the worker left as raw text. */
function stripInlineLinkTags(text: string): string {
  return text.replace(
    /\{@link(?:code|plain)?\s+([^}|]+?)(?:\|[^}]*)?\}/g,
    '$1'
  )
}

/** Wrap example/default bodies as a TS code block unless already fenced. */
function asCodeblock(text: string): string {
  if (/^\s*[~`]{3}/m.test(text)) return text
  return '```ts\n' + text + '\n```'
}

/** Split a tag body into `[name, description]`, dropping the source `-`. */
function splitNamedTag(body: string): [string, string] {
  const match = body.match(/^(\S+)\s*-?\s*([\s\S]*)$/)
  return match ? [match[1], match[2]] : ['', body]
}

/**
 * All `@param` tags as one markdown table (Name | Description). A table reads
 * far better than a stack of `*@param* \`x\` — …` lines once there are more
 * than one or two. Descriptions are flattened to a single line and their pipes
 * escaped so a stray `|` can't break the columns.
 */
function paramTable(params: TsTag[], ctx: HoverContext): string {
  const rows = params.map((tag) => {
    const [name, doc] = splitNamedTag(docPartsToMarkdown(tag.text, ctx))
    const desc = doc.replace(/\s*\r?\n\s*/g, ' ').replace(/\|/g, '\\|').trim()
    return `| \`${name}\` | ${desc || '—'} |`
  })
  return ['| Param | Description |', '| :--- | :--- |', ...rows].join('\n')
}

/** An `@example` body as a fenced code block, with no `@example` label. */
function exampleBlock(tag: TsTag, ctx: HoverContext): string {
  const body = docPartsToMarkdown(tag.text, ctx)
  const caption = body.match(/<caption>(.*?)<\/caption>\s*\r?\n/)
  return caption && caption.index === 0
    ? `_${caption[1]}_\n\n` + asCodeblock(body.slice(caption[0].length))
    : asCodeblock(body)
}

/** Nicely-cased labels for the tags that render as "**Label** — body". */
const TAG_LABELS: Record<string, string> = {
  returns: 'Returns',
  see: 'See',
  deprecated: 'Deprecated',
  throws: 'Throws',
  remarks: 'Remarks',
  default: 'Default',
  prop: 'Property',
  property: 'Property',
  template: 'Template',
  typeParam: 'Type param',
}

/** "**Returns**" from `returns`; falls back to a capitalised tag name. */
function tagLabel(name: string): string {
  return TAG_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Any tag that isn't `@param` or `@example` → a bold label followed by its
 * body, e.g. "**Returns** — The new record." The bold label matches the
 * description and the `@param` table so the whole card reads as one system,
 * rather than VSCode's dimmer `*@returns*` italic.
 */
function tagToMarkdown(tag: TsTag, ctx: HoverContext): string {
  const label = `**${tagLabel(tag.name)}**`

  if (['prop', 'property', 'template', 'typeParam'].includes(tag.name)) {
    const [name, doc] = splitNamedTag(docPartsToMarkdown(tag.text, ctx))
    if (name) {
      const named = `${label} \`${name}\``
      if (!doc) return named
      return named + (/\r\n|\n/.test(doc) ? '  \n' + doc : ` — ${doc}`)
    }
  }

  const body =
    tag.name === 'default'
      ? asCodeblock(docPartsToMarkdown(tag.text, ctx))
      : docPartsToMarkdown(tag.text, ctx)
  if (!body) return label
  return label + (/\r\n|\n/.test(body) ? '  \n' + body : ` — ${body}`)
}

/**
 * Assemble the hover body. Sections, in order:
 *  1. the description, emphasised in bold so it leads the card;
 *  2. a `@param` table;
 *  3. every other tag (`@returns`, `@see`, `@deprecated`, …);
 *  4. `@example` code blocks, unlabelled and each in its own section so they
 *     get real vertical breathing room.
 * Sections are joined by blank lines; that spacing is the whole visual point.
 */
function quickInfoDocsToMarkdown(
  info: { documentation?: TsPart[]; tags?: TsTag[] },
  ctx: HoverContext
): string {
  const sections: string[] = []

  const description = docPartsToMarkdown(info.documentation, ctx).trim()
  if (description) sections.push(boldParagraphs(description))

  const tags = info.tags ?? []
  const params = tags.filter((t) => t.name === 'param')
  const examples = tags.filter((t) => t.name === 'example')
  const rest = tags.filter((t) => t.name !== 'param' && t.name !== 'example')

  if (params.length) sections.push(paramTable(params, ctx))
  const others = rest.map((tag) => tagToMarkdown(tag, ctx)).join('  \n\n')
  if (others) sections.push(others)
  for (const example of examples) sections.push(exampleBlock(example, ctx))

  return sections.join('\n\n')
}

/**
 * Bold the description, one `**…**` span per paragraph.
 *
 * Intra-paragraph newlines are flattened to spaces first — Markdown emphasis
 * can't straddle a line break, so `**line1\nline2**` would print its literal
 * asterisks. Collapsing also matches how VSCode reflows wrapped JSDoc prose.
 * Inline code spans and `{@link}` links inside the run stay intact.
 */
function boldParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((line) => `**${line}**`)
    .join('\n\n')
}

/**
 * App-level CSS the viewer needs that Monaco doesn't ship:
 *  - hover tables (Monaco renders GFM tables border-less, columns collapsing)
 *    and spacing for stacked `@example` code blocks;
 *  - the embedded-SQL token classes (see `highlightEmbeddedSql`).
 *
 * Greys come from the app's Ink design tokens so they track light/dark; the
 * one syntax hue has no token, so it's hard-coded with a `data-theme` +
 * `prefers-color-scheme` override, matching how the rest of the shell themes.
 * SQL classes are scoped under `.view-lines` (specificity 0,3,0) so they win
 * over Monaco's generated `.monaco-editor .mtkN` token colors (0,2,0).
 *
 * Guarded on the tag itself rather than a module flag: a hot update of this
 * module resets the flag but not the DOM, and a second copy of these rules
 * would just stack.
 */
function injectViewerStyles() {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-stashly-monaco]')) return
  const style = document.createElement('style')
  style.dataset.stashlyMonaco = 'true'
  style.textContent = `
.monaco-hover .rendered-markdown table {
  border-collapse: collapse;
  margin: 8px 0;
}
.monaco-hover .rendered-markdown th,
.monaco-hover .rendered-markdown td {
  padding: 3px 0;
  border-bottom: 1px solid var(--border, #d7d7d7);
  text-align: left;
  vertical-align: top;
}
.monaco-hover .rendered-markdown th {
  color: var(--muted-foreground, #616161);
  font-weight: 600;
}
.monaco-hover .rendered-markdown th:first-child,
.monaco-hover .rendered-markdown td:first-child {
  padding-right: 18px;
  white-space: nowrap;
}
.monaco-hover .rendered-markdown tr:last-child td {
  border-bottom: none;
}
/* Space stacked @example blocks. They render as [data-code] divs with no
   margin, so give one air whenever it follows other content. Sibling-scoped
   so the lone signature block (an only child) is never pushed down. */
.monaco-hover .rendered-markdown p + [data-code],
.monaco-hover .rendered-markdown table + [data-code],
.monaco-hover .rendered-markdown [data-code] + [data-code],
.monaco-hover .rendered-markdown [data-code] + p,
.monaco-hover .rendered-markdown p + pre,
.monaco-hover .rendered-markdown [data-code] + pre {
  margin-top: 10px;
}

/* Embedded SQL (sql\`…\` in TS/JS). The whole template is one string token —
   the hue — so every SQL token is reset from that baseline: keywords,
   functions and strings take the hue (keywords bold), identifiers foreground,
   the rest muted. */
.monaco-editor .view-lines .stashly-sql-keyword {
  font-weight: 600;
}
.monaco-editor .view-lines .stashly-sql-identifier,
.monaco-editor .view-lines .stashly-sql-quoted,
.monaco-editor .view-lines .stashly-sql-number {
  color: var(--foreground, #232323);
}
.monaco-editor .view-lines .stashly-sql-operator {
  color: var(--muted-foreground, #616161);
}
.monaco-editor .view-lines .stashly-sql-comment {
  color: var(--muted-foreground, #616161);
  font-style: italic;
}
.monaco-editor .view-lines .stashly-sql-keyword,
.monaco-editor .view-lines .stashly-sql-string,
.monaco-editor .view-lines .stashly-sql-function {
  color: #5e6ad2;
}
@media (prefers-color-scheme: dark) {
  .monaco-editor .view-lines .stashly-sql-keyword,
  .monaco-editor .view-lines .stashly-sql-string,
  .monaco-editor .view-lines .stashly-sql-function {
    color: #96a0e8;
  }
}
:root[data-theme='light'] .monaco-editor .view-lines .stashly-sql-keyword,
:root[data-theme='light'] .monaco-editor .view-lines .stashly-sql-string,
:root[data-theme='light'] .monaco-editor .view-lines .stashly-sql-function {
  color: #5e6ad2;
}
:root[data-theme='dark'] .monaco-editor .view-lines .stashly-sql-keyword,
:root[data-theme='dark'] .monaco-editor .view-lines .stashly-sql-string,
:root[data-theme='dark'] .monaco-editor .view-lines .stashly-sql-function {
  color: #96a0e8;
}
`
  document.head.appendChild(style)
}

/**
 * Registrations parked on the Monaco instance rather than in module scope.
 *
 * `monaco-editor` is its own chunk and survives a hot update of *this* module,
 * so a module-scope "registered once" flag resets while the registration it
 * was guarding lives on. Monaco merges every provider's answer into one hover
 * card, so a second stacked provider renders the same signature twice. Keeping
 * the handle next to the thing it was registered against makes re-evaluation a
 * swap instead of a stack.
 */
const REGISTRY_KEY = '__stashlyMonacoRegistry'

type ViewerRegistry = { tsHover?: monaco.IDisposable }

function viewerRegistry(): ViewerRegistry {
  const store = globalThis as unknown as Record<
    string,
    ViewerRegistry | undefined
  >
  return (store[REGISTRY_KEY] ??= {})
}

/**
 * Replace Monaco's TS/JS hover with the VSCode-style formatter. The two
 * languages sync to two separate workers, so each provider must reach for its
 * own accessor; the quick-info shape is otherwise identical.
 *
 * Any previous registration is disposed first — see `viewerRegistry`.
 */
function registerTsHover() {
  const registry = viewerRegistry()
  registry.tsHover?.dispose()
  injectViewerStyles()

  const registered: monaco.IDisposable[] = []

  // Backs the `{@link}` / `@see` command links. The arg is the target's own
  // span; we find the editor showing that model and reveal it. Same-file only
  // — the link is only ever built when the target lives in the hovered model
  // (see `linkToMarkdown`), so a missing editor just means the tab was closed.
  const command = monaco.editor.registerCommand(
    REVEAL_TARGET_COMMAND,
    (_accessor, arg?: { uri: string; start: number; length: number }) => {
      if (!arg) return
      const model = monaco.editor
        .getModels()
        .find((m) => m.uri.toString() === arg.uri)
      const editor = monaco.editor
        .getEditors()
        .find((e) => e.getModel() === model)
      if (!model || !editor) return
      const start = model.getPositionAt(arg.start)
      const end = model.getPositionAt(arg.start + arg.length)
      const range = new monaco.Range(
        start.lineNumber,
        start.column,
        end.lineNumber,
        end.column
      )
      editor.setSelection(range)
      editor.revealRangeInCenterIfOutsideViewport(range)
      editor.focus()
    }
  )

  const accessorFor = (languageId: string) =>
    languageId === 'javascript'
      ? monaco.typescript.getJavaScriptWorker()
      : monaco.typescript.getTypeScriptWorker()

  registered.push(command)

  for (const languageId of ['typescript', 'javascript']) {
    const hover = monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position) => {
        const getWorker = await accessorFor(languageId)
        if (model.isDisposed()) return null
        const client = await getWorker(model.uri)
        const info = await client.getQuickInfoAtPosition(
          model.uri.toString(),
          model.getOffsetAt(position)
        )
        if (!info || model.isDisposed()) return null

        const signature = partsToString(info.displayParts)
        const docs = quickInfoDocsToMarkdown(info, { uri: model.uri.toString() })
        const start = model.getPositionAt(info.textSpan.start)
        const end = model.getPositionAt(info.textSpan.start + info.textSpan.length)

        const contents: monaco.IMarkdownString[] = [
          { value: '```typescript\n' + signature + '\n```' },
        ]
        // Trust only our one reveal command — command links are inert markup
        // otherwise. Scoped to this string, so nothing else can smuggle a
        // command: URI into the hover.
        if (docs) {
          contents.push({
            value: docs,
            isTrusted: { enabledCommands: [REVEAL_TARGET_COMMAND] },
          })
        }
        return {
          range: new monaco.Range(
            start.lineNumber,
            start.column,
            end.lineNumber,
            end.column
          ),
          contents,
        }
      },
    })
    registered.push(hover)
  }

  registry.tsHover = {
    dispose: () => {
      for (const registration of registered) registration.dispose()
    },
  }
}

/**
 * JSON: keep the validator, keep it offline, stop it moralising about JSONC.
 *
 * `enableSchemaRequest` already defaults to false, but it is set explicitly
 * because the consequence of it flipping is that the viewer starts fetching
 * whatever URL a `$schema` key inside an uploaded file points at. Comments and
 * trailing commas are downgraded from errors: a large share of real-world
 * .json files are tsconfig/eslintrc-style JSONC, where flagging them is wrong
 * more often than it's right.
 */
function configureJson() {
  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [],
    enableSchemaRequest: false,
    comments: 'ignore',
    trailingCommas: 'warning',
  })
}

/**
 * CSS/SCSS/LESS: structural validation on, style lint off.
 *
 * The defaults warn about vendor prefixes, duplicate properties, empty rules
 * and unknown properties — every one of which fires constantly on minified or
 * third-party stylesheets, and none of which the reader of a stashed file can
 * act on. Genuine mistakes (malformed hex, bad color-function arguments) stay
 * errors.
 *
 * `setOptions` replaces the options object wholesale, so `data` has to be
 * repeated: dropping it would turn off the default data provider, which is
 * where CSS property hover documentation comes from — the main reason to run
 * this service at all.
 */
function configureCss() {
  const options: monaco.css.Options = {
    validate: true,
    lint: {
      vendorPrefix: 'ignore',
      duplicateProperties: 'ignore',
      emptyRules: 'ignore',
      fontFaceProperties: 'ignore',
      unknownProperties: 'ignore',
      propertyIgnoredDueToDisplay: 'ignore',
      hexColorLength: 'error',
      argumentsInColorFunction: 'error',
    },
    data: { useDefaultDataProvider: true },
  }
  const css = monaco.css
  for (const defaults of [css.cssDefaults, css.scssDefaults, css.lessDefaults]) {
    defaults.setOptions(options)
  }
}

/**
 * Language id → the one-time setup for its service family. HTML is absent on
 * purpose: its defaults are already right for a viewer, so it needs a worker
 * but no configuration.
 */
const SERVICE_CONFIGURERS: Record<string, () => void> = {
  typescript: configureTypeScript,
  javascript: configureTypeScript,
  json: configureJson,
  css: configureCss,
  scss: configureCss,
  less: configureCss,
}

/**
 * Language-service defaults are global to the monaco instance, so each family
 * is configured once. Keying the guard on the function itself means css/scss/
 * less collapse to a single run for free.
 */
const configuredServices = new Set<() => void>()

function configureLanguageService(language: string) {
  const configure = SERVICE_CONFIGURERS[language]
  if (!configure || configuredServices.has(configure)) return
  configuredServices.add(configure)
  configure()
}

// ---------------------------------------------------------------------------
// Embedded SQL highlighting
//
// SQL written inside a tagged template literal — `sql`…`` or `Prisma.sql`…`` —
// is one big string token to the TypeScript grammar, so it renders flat. This
// finds those templates, tokenizes their bodies with Monaco's own SQL Monarch
// grammar, and lays down inline decorations. The viewer is read-only, so this
// runs once at mount and never re-syncs.
// ---------------------------------------------------------------------------

/** SQL token type (from `tokenize`) → the CSS class in `injectViewerStyles`. */
const SQL_TOKEN_CLASS: Record<string, string> = {
  'keyword.sql': 'stashly-sql-keyword',
  'predefined.sql': 'stashly-sql-function',
  'string.sql': 'stashly-sql-string',
  'string.double.sql': 'stashly-sql-string',
  'number.sql': 'stashly-sql-number',
  'comment.sql': 'stashly-sql-comment',
  'comment.quote.sql': 'stashly-sql-comment',
  'identifier.sql': 'stashly-sql-identifier',
  'identifier.quote.sql': 'stashly-sql-quoted',
  'operator.sql': 'stashly-sql-operator',
  'delimiter.sql': 'stashly-sql-operator',
  'delimiter.parenthesis.sql': 'stashly-sql-operator',
}

/**
 * An identifier chain (`Prisma.sql`, `prisma.$queryRaw`) in front of a
 * template backtick, with an optional generic type argument between them —
 * `$queryRaw<Array<{ id: string }>>`…``. The generic sub-pattern balances up
 * to three levels of `<…>` nesting, which covers real query result types;
 * anything deeper just isn't recognised (it degrades to no highlight, never a
 * mismatch). Requiring the trailing backtick keeps a plain `a < b` comparison
 * on a `sql`-named value from ever matching.
 */
const TAGGED_TEMPLATE =
  /(?<![.\w$])([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*(?:<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*)?`/g

/** The inner SQL of one template: where its body starts + the body text. */
type SqlTemplate = { bodyStart: number; sql: string }

/**
 * Template tags (the final identifier segment, lower-cased) whose body is SQL:
 * the `sql` helper plus Prisma's raw-query methods. Everything else — `css`,
 * `styled.div`, `gql` — is left alone.
 */
const SQL_TAGS = new Set([
  'sql',
  '$queryraw',
  '$executeraw',
  '$queryrawunsafe',
  '$executerawunsafe',
])

/**
 * Find `…sql`…`` / `…$queryRaw`…`` templates. Matching on the final segment of
 * the tag chain, so `Prisma.sql`, `prisma.$queryRaw` and a bare `sql` all
 * count while untagged templates and other tags don't.
 */
function findSqlTemplates(text: string): SqlTemplate[] {
  const out: SqlTemplate[] = []
  TAGGED_TEMPLATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAGGED_TEMPLATE.exec(text))) {
    const segments = match[1].split('.').map((s) => s.trim().toLowerCase())
    if (!SQL_TAGS.has(segments[segments.length - 1])) continue
    const bodyStart = TAGGED_TEMPLATE.lastIndex // char after the opening backtick
    const { end, sql } = scanTemplateBody(text, bodyStart)
    out.push({ bodyStart, sql })
    TAGGED_TEMPLATE.lastIndex = end + 1 // resume past the closing backtick
  }
  return out
}

/**
 * Walk a template body to its closing backtick. `${…}` interpolations and
 * escapes are blanked to equal-length whitespace (newlines preserved) so the
 * returned string lines up 1:1 with the source offsets — the SQL tokenizer
 * never sees a `${` hole, and those regions simply aren't decorated.
 */
function scanTemplateBody(
  text: string,
  start: number
): { end: number; sql: string } {
  const chars: string[] = []
  const len = text.length
  let i = start
  while (i < len) {
    const ch = text[i]
    if (ch === '\\') {
      chars.push(' ', ' ')
      i += 2
    } else if (ch === '`') {
      break
    } else if (ch === '$' && text[i + 1] === '{') {
      chars.push(' ', ' ')
      let depth = 1
      i += 2
      while (i < len && depth > 0) {
        const c = text[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        chars.push(c === '\n' ? '\n' : ' ')
        i++
      }
    } else {
      chars.push(ch)
      i++
    }
  }
  return { end: i, sql: chars.join('') }
}

/** Tokenize each template's SQL and turn the tokens into inline decorations. */
function embeddedSqlDecorations(
  model: monaco.editor.ITextModel,
  templates: SqlTemplate[]
): monaco.editor.IModelDeltaDecoration[] {
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  for (const { bodyStart, sql } of templates) {
    if (!sql.trim()) continue
    const lines = monaco.editor.tokenize(sql, 'sql')
    const sqlLines = sql.split('\n')
    let lineOffset = 0
    for (let li = 0; li < lines.length; li++) {
      const tokens = lines[li]
      const lineText = sqlLines[li] ?? ''
      for (let ti = 0; ti < tokens.length; ti++) {
        const token = tokens[ti]
        const nextOffset =
          ti + 1 < tokens.length ? tokens[ti + 1].offset : lineText.length
        const className = SQL_TOKEN_CLASS[token.type]
        if (!className || nextOffset <= token.offset) continue
        const from = model.getPositionAt(bodyStart + lineOffset + token.offset)
        const to = model.getPositionAt(bodyStart + lineOffset + nextOffset)
        decorations.push({
          range: new monaco.Range(
            from.lineNumber,
            from.column,
            to.lineNumber,
            to.column
          ),
          options: { inlineClassName: className },
        })
      }
      lineOffset += lineText.length + 1 // + the '\n' split removed
    }
  }
  return decorations
}

/** Lazily register Monaco's SQL Monarch grammar so `tokenize('…','sql')` works. */
let sqlGrammarPromise: Promise<void> | null = null
function ensureSqlGrammar(): Promise<void> {
  if (!sqlGrammarPromise) sqlGrammarPromise = loadSqlGrammar()
  return sqlGrammarPromise
}
async function loadSqlGrammar(): Promise<void> {
  try {
    // Deep basic-languages path — no co-located .d.ts. Its shape is
    // `{ conf: LanguageConfiguration, language: IMonarchLanguage }`.
    const { conf, language } = await import(
      // @ts-expect-error - no type declarations for this module path
      'monaco-editor/esm/vs/basic-languages/sql/sql.js'
    )
    monaco.languages.setMonarchTokensProvider('sql', language)
    monaco.languages.setLanguageConfiguration('sql', conf)
  } catch (err) {
    console.error('[monaco] could not load SQL grammar', err)
  }
}

/**
 * Decorate the SQL inside every `sql`…`` in a TS/JS model.
 *
 * The decorations are recomputed on every content change, not just at mount.
 * The viewer is read-only, but Format Document rewrites the whole model — the
 * SQL shifts to new positions and static decorations would smear across the
 * wrong characters. Re-scanning on change keeps them aligned through format
 * and revert alike. (Decoration edits don't fire change events, so no loop.)
 *
 * Fire-and-forget: finding templates is synchronous, but the SQL grammar loads
 * async, so the first highlight lands a beat after mount. Returns a disposer.
 */
function highlightEmbeddedSql(
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel
): { dispose: () => void } {
  // A SQL-free TS file can't grow a `sql`…`` by formatting, so skip the work
  // — no grammar load, no listener — when there's nothing embedded to begin.
  if (!findSqlTemplates(model.getValue()).length) return { dispose: () => {} }

  injectViewerStyles()
  const collection = editor.createDecorationsCollection([])
  const apply = () => {
    if (model.isDisposed()) return
    const templates = findSqlTemplates(model.getValue())
    collection.set(
      templates.length ? embeddedSqlDecorations(model, templates) : []
    )
  }
  void ensureSqlGrammar().then(apply)
  const change = model.onDidChangeContent(() => void ensureSqlGrammar().then(apply))
  return {
    dispose: () => {
      change.dispose()
      collection.clear()
    },
  }
}

let modelSequence = 0

/**
 * Build a model URI that ends in the file's real extension.
 *
 * The TS worker derives `ScriptKind` from the URI suffix alone
 * (`getScriptKind` in tsWorker.js), and Monaco's default `inmemory://model/1`
 * has none. The fallback there is `allowJs ? JS : TS`, and we set allowJs — so
 * without a suffix every .ts/.tsx file is parsed as *JavaScript* and its
 * TypeScript syntax is flagged wholesale: "'interface' declarations can only
 * be used in TypeScript files", "Type annotations can only be used in
 * TypeScript files". Naming the model `…/foo.tsx` is what makes that go away.
 *
 * The `file://` scheme matters too: acquired `@types` land at
 * `file:///node_modules/…` (see `type-acquisition.ts`), and TS's module
 * resolution only reaches them by walking up from the model's own directory.
 * A model under `inmemory://…` lives in a different virtual root, so
 * `import 'react'` would never find the libs — under `file:///stashly/…` it
 * walks up to `file:///node_modules` and resolves.
 *
 * The counter keeps two viewers on the same filename apart, since
 * `createModel` throws on a duplicate URI.
 */
function modelUriFor(fileName: string): monaco.Uri {
  const safe = fileName.replace(/[^\w.-]+/g, '_')
  return monaco.Uri.parse(`file:///stashly/${modelSequence++}/${safe}`)
}

/**
 * Prefer the file's real project path (`file:///app/.server/x.ts`) when we know
 * it — that's what lets the file's own `./relative` imports resolve against its
 * uploaded siblings. Without a project context (or on a URI collision from the
 * same file being open twice) fall back to the synthetic counter URI.
 */
function modelUriForContext(
  fileName: string,
  context: SourceContext | null | undefined
): monaco.Uri {
  if (context?.filePath) {
    const safe = context.filePath.replace(/[^\w./-]+/g, '_')
    const uri = monaco.Uri.parse(`file:///${safe}`)
    if (!monaco.editor.getModel(uri)) return uri
  }
  return modelUriFor(fileName)
}

/**
 * Resolve a Monaco language id from a filename using Monaco's own registry
 * (extensions + exact filenames, so `Dockerfile`/`Makefile` resolve too).
 */
export function languageForFile(name: string): string {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot === -1 ? '' : lower.slice(dot)
  for (const lang of monaco.languages.getLanguages()) {
    if (ext && lang.extensions?.some((e) => e.toLowerCase() === ext)) {
      return lang.id
    }
    if (lang.filenames?.some((f) => f.toLowerCase() === lower)) return lang.id
  }
  return 'plaintext'
}

/** App theme → dark flag. `data-theme` on <html> is the source of truth. */
function isDarkTheme(): boolean {
  const t = document.documentElement.dataset.theme
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// ---------------------------------------------------------------------------
// Ink theme — chrome from CSS design tokens, duotone syntax
// ---------------------------------------------------------------------------

type InkPalette = {
  /** editor background — `--card` */
  card: string
  /** default text — `--foreground` */
  fg: string
  /** comments, punctuation, line numbers — `--muted-foreground` */
  muted: string
  /** selection / hover surfaces — `--accent` (a grey in the Ink system) */
  surface: string
  /** guides, scrollbars — `--border` */
  border: string
  /** widget borders — `--input` */
  input: string
  /** the single syntax hue (strings) — hand-picked, not a design token */
  hue: string
  string: string
}

/** Fallbacks approximating globals.css if token resolution ever fails. */
const INK_FALLBACK: Record<'light' | 'dark', Omit<InkPalette, 'hue'>> = {
  light: {
    card: '#ffffff',
    fg: '#232323',
    muted: '#616161',
    surface: '#e2e2e2',
    border: '#d7d7d7',
    input: '#c8c8c8',
    string: '#616161',
  },
  dark: {
    card: '#1f1f1f',
    fg: '#f4f4f4',
    muted: '#a1a1a1',
    surface: '#393939',
    border: '#3e3e3e',
    input: '#373737',
    string: '#a1a1a1'
  },
}

/** Dusty indigo — desaturated enough to sit inside a monochrome shell. */
const INK_HUE = { light: '#5e6ad2', dark: '#96a0e8' }

/**
 * Resolve one CSS color value (any syntax the browser knows, incl. oklch) to
 * a `#rrggbb` hex by painting it on a 1×1 canvas and reading the pixel back —
 * `getComputedStyle` may serialize oklch as-is, which Monaco can't parse.
 */
function cssColorToHex(
  ctx: CanvasRenderingContext2D,
  value: string,
  fallback: string
): string {
  if (!value) return fallback
  try {
    ctx.fillStyle = fallback
    ctx.fillStyle = value.trim() // invalid values leave the fallback in place
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return fallback
  }
}

function resolveInkPalette(dark: boolean): InkPalette {
  const fallback = INK_FALLBACK[dark ? 'dark' : 'light']
  const hue = INK_HUE[dark ? 'dark' : 'light']
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { ...fallback, hue }

  const style = getComputedStyle(document.documentElement)
  const token = (name: string, fb: string) =>
    cssColorToHex(ctx, style.getPropertyValue(name), fb)

  return {
    card: token('--card', fallback.card),
    fg: token('--foreground', fallback.fg),
    muted: token('--muted-foreground', fallback.muted),
    surface: token('--accent', fallback.surface),
    border: token('--border', fallback.border),
    input: token('--input', fallback.input),
    string: token('--card-foreground', fallback.muted),
    hue,
  }
}

/**
 * Duotone syntax: role separation comes from grey value + weight + italics;
 * the indigo hue is reserved for string-like tokens only.
 */
function inkRules(p: InkPalette): monaco.editor.ITokenThemeRule[] {
  const c = (hex: string) => hex.slice(1)
  return [
    { token: '', foreground: c(p.fg) },
    { token: 'comment', foreground: c(p.input), fontStyle: 'italic' },
    { token: 'keyword', foreground: c(p.muted), fontStyle: 'bold' },
    { token: 'identifier', foreground: c(p.hue), fontStyle: 'bold' },
    { token: 'string', foreground: c(p.muted) },
    { token: 'string.escape', foreground: c(p.hue), fontStyle: 'bold' },
    { token: 'regexp', foreground: c(p.hue) },
    { token: 'attribute.value', foreground: c(p.muted) },
    { token: 'string.key.json', foreground: c(p.fg) },
    { token: 'string.value.json', foreground: c(p.hue) },
    { token: 'operator', foreground: c(p.muted) },
    { token: 'delimiter', foreground: c(p.muted) },
    { token: 'attribute.name', foreground: c(p.muted) },
    { token: 'metatag', foreground: c(p.muted) },
    { token: 'annotation', foreground: c(p.muted) },
    { token: 'namespace', foreground: c(p.muted) },
    { token: 'variable.predefined', foreground: c(p.muted) },
    { token: 'tag', foreground: c(p.fg), fontStyle: 'bold' },
    // Read-only viewer: never scream red at tokenizer hiccups.
    { token: 'invalid', foreground: c(p.fg) },
  ]
}

function inkColors(p: InkPalette): monaco.editor.IColors {
  return {
    'editor.background': p.card,
    'editor.foreground': p.fg,
    'editorGutter.background': p.card,
    'editorLineNumber.foreground': `${p.muted}99`,
    'editorLineNumber.activeForeground': p.fg,
    'editorCursor.foreground': p.fg,
    'editor.selectionBackground': p.surface,
    'editor.inactiveSelectionBackground': `${p.surface}80`,
    'editor.selectionHighlightBackground': `${p.surface}99`,
    'editor.wordHighlightBackground': `${p.surface}80`,
    'editor.findMatchBackground': `${p.hue}55`,
    'editor.findMatchHighlightBackground': `${p.surface}`,
    'editorLink.activeForeground': p.hue,
    'editorWhitespace.foreground': p.border,
    'editorIndentGuide.background1': `${p.border}66`,
    'editorIndentGuide.activeBackground1': p.border,
    'editorBracketMatch.background': p.surface,
    'editorBracketMatch.border': p.border,
    // Neutralize rainbow bracket-pair colorization into the duotone system.
    'editorBracketHighlight.foreground1': p.muted,
    'editorBracketHighlight.foreground2': p.fg,
    'editorBracketHighlight.foreground3': p.hue,
    'editorBracketHighlight.foreground4': p.muted,
    'editorBracketHighlight.foreground5': p.fg,
    'editorBracketHighlight.foreground6': p.hue,
    'editorBracketHighlight.unexpectedBracket.foreground': p.fg,
    // Syntax diagnostics from the TS service. The default rainbow squiggles
    // are the loudest thing on a monochrome page, so errors borrow the one
    // hue and everything softer drops to grey.
    'editorError.foreground': p.hue,
    'editorWarning.foreground': p.muted,
    'editorInfo.foreground': p.muted,
    'editorWidget.background': p.card,
    'editorWidget.foreground': p.fg,
    'editorWidget.border': p.input,
    'editorHoverWidget.background': p.card,
    'editorHoverWidget.foreground': p.fg,
    'editorHoverWidget.border': p.input,
    'editorHoverWidget.statusBarBackground': p.card,
    // JSDoc `{@link}` / `@see` links in the hover borrow the one syntax hue.
    'textLink.foreground': p.hue,
    'textLink.activeForeground': p.hue,
    'textCodeBlock.background': p.surface,
    'input.background': p.card,
    'input.foreground': p.fg,
    'input.border': p.input,
    'inputOption.activeBorder': p.fg,
    'editorStickyScroll.background': p.card,
    'editorStickyScrollHover.background': p.surface,
    'minimap.background': p.card,
    'minimapSlider.background': `${p.border}40`,
    'minimapSlider.hoverBackground': `${p.border}66`,
    'minimapSlider.activeBackground': `${p.border}88`,
    'scrollbarSlider.background': `${p.border}66`,
    'scrollbarSlider.hoverBackground': `${p.border}99`,
    'scrollbarSlider.activeBackground': `${p.border}aa`,
    'scrollbar.shadow': '#00000000',
    'editorOverviewRuler.border': '#00000000',
  }
}

/**
 * (Re)build the Ink theme from the live design tokens and activate it.
 * Called at mount and again on every theme flip — redefining under the same
 * name updates all editors, and reading tokens at flip time means the theme
 * follows globals.css exactly, light or dark.
 */
function applyInkTheme() {
  const dark = isDarkTheme()
  const palette = resolveInkPalette(dark)
  monaco.editor.defineTheme('stashly-ink', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: false,
    rules: inkRules(palette),
    colors: inkColors(palette),
  })
  monaco.editor.setTheme('stashly-ink')
}

const EDITOR_FONT = "'JetBrains Mono Variable'"
const EDITOR_FONT_SIZE = 13

/**
 * Wire Prettier into the context menu (plus Alt+Shift+F, VS Code's binding).
 *
 * Two paired actions share one context key so only one is ever visible. The
 * pair exists because a `readOnly` editor disables undo, which would otherwise
 * leave no way back to the bytes actually stored in S3 — formatting here is a
 * view of the file, never a write to it.
 *
 * Edits go through the *model*, not `editor.executeEdits`: the latter is a
 * no-op while `readOnly` is set, whereas the model has no such gate.
 */
function addFormatActions(
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  language: string,
  notify: (message: string) => void
) {
  // Compare and format on LF. A model created from CRLF text keeps CRLF and
  // re-normalizes anything pushed into it, so a raw comparison against
  // Prettier's LF output reports "changed" for a document that will render
  // byte-identical — the edit lands, nothing moves, and the menu flips to
  // Revert for no reason.
  const original = model.getValue().replace(/\r\n/g, '\n')
  const isFormatted = editor.createContextKey<boolean>(
    'stashlyFormatted',
    false
  )
  let running = false

  // Line counts shift under a full-range replace, so the scroll offset is only
  // approximately preserved — still far better than snapping back to line 1.
  const replaceAll = (next: string) => {
    const scrollTop = editor.getScrollTop()
    model.pushEditOperations(
      [],
      [{ range: model.getFullModelRange(), text: next }],
      () => null
    )
    editor.setScrollTop(scrollTop)
  }

  editor.addAction({
    id: 'stashly.formatDocument',
    label: 'Format Document',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 1,
    precondition: '!stashlyFormatted',
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    ],
    run: async () => {
      if (running) return
      running = true
      try {
        const formatted = await formatDocument(original, language)
        if (model.isDisposed()) return
        if (formatted === original) {
          // Common and easily mistaken for a broken action: source checked out
          // of a Prettier-formatted repo is already at its fixed point.
          notify('Already formatted — Prettier made no changes')
          return
        }
        replaceAll(formatted)
        isFormatted.set(true)
        notify('Formatted with Prettier')
      } catch (err) {
        // Usually a syntax error in the file itself — the viewer opens
        // arbitrary uploads, so "doesn't parse" is an ordinary outcome.
        console.error('[monaco] Prettier could not format this document', err)
        notify(`Could not format: ${firstLine(err)}`)
      } finally {
        running = false
      }
    },
  })

  editor.addAction({
    id: 'stashly.revertFormatting',
    label: 'Revert Formatting',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 1,
    precondition: 'stashlyFormatted',
    run: () => {
      if (model.isDisposed()) return
      replaceAll(original)
      isFormatted.set(false)
      notify('Reverted to the original file')
    },
  })
}

/**
 * Report the model's line count, at mount and after every content change.
 *
 * Format Document (and Revert Formatting) replaces the whole buffer, so the
 * count can't be derived from the text React handed us — a formatted file
 * routinely gains or loses hundreds of lines. The model is the only source
 * that tracks it. Returns a disposer.
 */
function watchLineCount(
  model: monaco.editor.ITextModel,
  report: (count: number) => void
): { dispose: () => void } {
  report(model.getLineCount())
  const change = model.onDidChangeContent(() => report(model.getLineCount()))
  return { dispose: () => change.dispose() }
}

/**
 * Alt+Z — VSCode's own binding for word wrap, plus a context-menu entry.
 *
 * Wrapping is the default here (see `createCodeViewer`), so this is the way
 * back to one-line-per-line: minified files, wide tables in a CSV, and
 * anything column-aligned read better unwrapped, and the horizontal scrollbar
 * is the right tool for those.
 *
 * The flag is a closure rather than a read of `getOption`, which reports the
 * *computed* wrapping mode and would need unpicking before it could be
 * flipped.
 */
function addWordWrapAction(editor: monaco.editor.IStandaloneCodeEditor) {
  let wrapping = true
  editor.addAction({
    id: 'stashly.toggleWordWrap',
    label: 'Toggle Word Wrap',
    contextMenuGroupId: '2_view',
    contextMenuOrder: 1,
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
    run: (target) => {
      wrapping = !wrapping
      target.updateOptions({ wordWrap: wrapping ? 'on' : 'off' })
    },
  })
}

/**
 * Prettier's parse errors carry the offending line and a caret diagram; only
 * the first line ("Unexpected token (3:12)") fits a one-line notice.
 */
function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.split('\n')[0].trim() || 'unknown error'
}

/** What React holds onto after mounting a viewer. */
export type CodeViewerHandle = {
  dispose: () => void
  /** Scroll a symbol into view and select its name — the outline rail's click. */
  reveal: (target: OutlineTarget) => void
}

/**
 * Mount a read-only Monaco viewer into `container`. Returns a handle that can
 * reveal a symbol, and a disposer that tears down the editor, its model, and
 * the theme listeners.
 */
export function createCodeViewer(
  container: HTMLElement,
  text: string,
  fileName: string,
  options: {
    /** Surfaces one-line results (formatting outcomes) back to React. */
    onNotice?: (message: string) => void
    /**
     * Surfaces the model's live line count back to React — fired at mount and
     * again whenever the buffer changes (Format Document / Revert Formatting).
     */
    onLineCount?: (count: number) => void
    /**
     * Surfaces the document's symbol tree back to React, rebuilt whenever the
     * language service or the buffer changes. Powers the outline rail.
     */
    onOutline?: (symbols: OutlineSymbol[]) => void
    /**
     * Surfaces the cursor's line, so the rail can mark the symbol it sits in.
     */
    onCursorLine?: (line: number) => void
    /**
     * The file's project context (root, alias paths, real path). When present,
     * the model is mounted at its real path so relative imports resolve, and
     * cross-file type acquisition runs. Fetched in the React layer.
     */
    sourceContext?: SourceContext | null
  } = {}
): CodeViewerHandle {
  // Web fonts load lazily — nothing else on the page uses JetBrains Mono, and
  // Monaco measures glyph widths at create time, so without this it sticks
  // with fallback-mono metrics forever. Kick the face into loading and
  // remeasure once it lands (remeasureFonts is global and safe post-dispose).
  document.fonts
    .load(`${EDITOR_FONT_SIZE}px ${EDITOR_FONT}`)
    .then(() => monaco.editor.remeasureFonts())
    .catch(() => {})

  applyInkTheme()
  const language = languageForFile(fileName)
  configureLanguageService(language)

  // Alias resolution has to be configured *before* anything asks the worker a
  // question: `setCompilerOptions` destroys the TypeScript worker, so applying
  // it once cross-file acquisition got going (as it used to) killed the
  // outline's first request — the rail only appeared once every type had
  // resolved. `acquireCrossFileTypes` calls this again with the same paths
  // further down; that call is a no-op.
  if (options.sourceContext?.paths) {
    applyAliasPaths(options.sourceContext.paths)
  }

  const model = monaco.editor.createModel(
    text,
    language,
    modelUriForContext(fileName, options.sourceContext)
  )
  const lineCount = options.onLineCount
    ? watchLineCount(model, options.onLineCount)
    : null
  const editor = monaco.editor.create(container, {
    model,
    readOnly: true,
    domReadOnly: true,
    automaticLayout: true,
    theme: 'stashly-ink',
    fontFamily: 'JetBrains Mono Variable',
    fontSize: EDITOR_FONT_SIZE,
    allowVariableFonts: true,
    fontLigatures: true,
    minimap: { enabled: true },
    stickyScroll: { enabled: true },
    scrollBeyondLastLine: false,
    // renderLineHighlight: 'none',
    wordWrapColumn: 80,
    // Wrap rather than scroll sideways. A viewer is for *reading*, and the
    // lines that overflow are the ones worth reading — a long Tailwind
    // `className`, a URL, a stringified payload. Prettier can't help with
    // those: it breaks JSX attributes onto their own lines but never inside a
    // string literal, so the line stays long however it is formatted.
    // Alt+Z turns it off (see `addWordWrapAction`).
    wordWrap: 'wordWrapColumn',
    // Continuation lines sit one level in from the line they belong to, so a
    // wrap is never mistaken for a new statement.
    wrappingIndent: 'indent',
    // The layout pass that measures real glyph widths — ligatures and the
    // variable font make the fast monospace estimate wrong.
    wrappingStrategy: 'advanced',
    // Bottom padding keeps the last lines clear of the floating stage toolbar.
    padding: { top: 12, bottom: 56 },
  })

  addWordWrapAction(editor)

  if (canFormatLanguage(language)) {
    addFormatActions(editor, model, language, (message) =>
      options.onNotice?.(message)
    )
  }

  const outline = options.onOutline
    ? watchOutline(model, options.onOutline)
    : null

  // The viewer is read-only, but the cursor still moves on click and with the
  // arrow keys, so the rail can follow along the way VSCode's outline does.
  const cursor = options.onCursorLine
    ? editor.onDidChangeCursorPosition((e) =>
        options.onCursorLine?.(e.position.lineNumber)
      )
    : null

  // Colorize SQL embedded in `sql`…`` template literals (TS/JS only).
  const embeddedSql =
    language === 'typescript' || language === 'javascript'
      ? highlightEmbeddedSql(editor, model)
      : null

  // Automatic type acquisition: fetch @types for imported packages so
  // `import … from 'react'` hovers with real types instead of `any`. Loaded on
  // demand (pulls typescript + @typescript/ata) so non-TS files pay nothing.
  if (language === 'typescript' || language === 'javascript') {
    void import('./type-acquisition').then((m) =>
      m.acquireTypesForSource(model.getValue())
    )
    // Cross-file resolution: fetch the other uploaded files this one imports
    // (relative + path aliases) so their types resolve too. The model is
    // already mounted at its real path, so relative imports line up.
    if (options.sourceContext) {
      const ctx = options.sourceContext
      void import('./cross-file-types').then((m) =>
        m.acquireCrossFileTypes(ctx, model.getValue())
      )
    }
  }

  // Follow app theme changes: Alt+T flips `data-theme`; 'system' follows the
  // OS media query. The observer fires after the attribute lands, so the CSS
  // tokens already hold their new values when the palette is re-resolved.
  const observer = new MutationObserver(applyInkTheme)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', applyInkTheme)

  return {
    // Selection without focus: the rail's filter box stays typeable, and the
    // theme already styles an inactive selection legibly.
    reveal: ({ line, column, endColumn }) => {
      if (model.isDisposed()) return
      const range = new monaco.Range(line, column, line, endColumn)
      editor.setSelection(range)
      editor.revealRangeInCenterIfOutsideViewport(
        range,
        monaco.editor.ScrollType.Smooth
      )
    },
    dispose: () => {
      observer.disconnect()
      media.removeEventListener('change', applyInkTheme)
      lineCount?.dispose()
      outline?.dispose()
      cursor?.dispose()
      embeddedSql?.dispose()
      editor.dispose()
      model.dispose()
    },
  }
}
