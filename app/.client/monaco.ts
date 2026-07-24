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
import { canFormatLanguage, formatDocument } from './prettier'

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
  const ts = monaco.languages.typescript
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
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
  const diagnosticsOptions: monaco.languages.typescript.DiagnosticsOptions = {
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

/** One JSDoc tag → a markdown line, matching VSCode's `getTagDocumentation`. */
function tagToMarkdown(tag: TsTag, ctx: HoverContext): string {
  const label = `*@${tag.name}*`

  // Named tags: "*@param* `name` — description", with the source `-` dropped.
  if (['param', 'prop', 'property', 'template', 'typeParam'].includes(tag.name)) {
    const body = docPartsToMarkdown(tag.text, ctx)
    const match = body.match(/^(\S+)\s*-?\s*([\s\S]*)$/)
    if (match) {
      const [, name, doc] = match
      const named = `*@${tag.name}* \`${name}\``
      if (!doc) return named
      return named + (/\r\n|\n/.test(doc) ? '  \n' + doc : ` — ${doc}`)
    }
  }

  let body = docPartsToMarkdown(tag.text, ctx)
  if (tag.name === 'example' || tag.name === 'default') {
    const caption = body.match(/<caption>(.*?)<\/caption>\s*\r?\n/)
    body =
      caption && caption.index === 0
        ? caption[1] + '\n\n' + asCodeblock(body.slice(caption[0].length))
        : asCodeblock(body)
  }
  if (!body) return label
  return label + (/\r\n|\n/.test(body) ? '  \n' + body : ` — ${body}`)
}

/** The doc-comment body plus all tags, as one markdown string. */
function quickInfoDocsToMarkdown(
  info: { documentation?: TsPart[]; tags?: TsTag[] },
  ctx: HoverContext
): string {
  const docs = docPartsToMarkdown(info.documentation, ctx)
  const tags = (info.tags ?? []).map((tag) => tagToMarkdown(tag, ctx)).join('  \n\n')
  return [docs, tags].filter(Boolean).join('\n\n')
}

/** Registered once — hover providers are global to the monaco instance. */
let tsHoverRegistered = false

/**
 * Replace Monaco's TS/JS hover with the VSCode-style formatter. The two
 * languages sync to two separate workers, so each provider must reach for its
 * own accessor; the quick-info shape is otherwise identical.
 */
function registerTsHover() {
  if (tsHoverRegistered) return
  tsHoverRegistered = true

  // Backs the `{@link}` / `@see` command links. The arg is the target's own
  // span; we find the editor showing that model and reveal it. Same-file only
  // — the link is only ever built when the target lives in the hovered model
  // (see `linkToMarkdown`), so a missing editor just means the tab was closed.
  monaco.editor.registerCommand(
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
      ? monaco.languages.typescript.getJavaScriptWorker()
      : monaco.languages.typescript.getTypeScriptWorker()

  for (const languageId of ['typescript', 'javascript']) {
    monaco.languages.registerHoverProvider(languageId, {
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
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
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
  const options: monaco.languages.css.Options = {
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
  const css = monaco.languages.css
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
 * The counter keeps two viewers on the same filename apart, since
 * `createModel` throws on a duplicate URI.
 */
function modelUriFor(fileName: string): monaco.Uri {
  const safe = fileName.replace(/[^\w.-]+/g, '_')
  return monaco.Uri.parse(`inmemory://stashly/${modelSequence++}/${safe}`)
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
  },
  dark: {
    card: '#1f1f1f',
    fg: '#f4f4f4',
    muted: '#a1a1a1',
    surface: '#393939',
    border: '#3e3e3e',
    input: '#373737',
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
    { token: 'comment', foreground: c(p.muted), fontStyle: 'italic' },
    { token: 'keyword', foreground: c(p.muted), fontStyle: 'bold' },
    { token: 'identifier', foreground: c(p.hue), fontStyle: 'bold' },
    { token: 'string', foreground: c(p.fg) },
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
 * Prettier's parse errors carry the offending line and a caret diagram; only
 * the first line ("Unexpected token (3:12)") fits a one-line notice.
 */
function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.split('\n')[0].trim() || 'unknown error'
}

/**
 * Mount a read-only Monaco viewer into `container`. Returns a disposer that
 * tears down the editor, its model, and the theme listeners.
 */
export function createCodeViewer(
  container: HTMLElement,
  text: string,
  fileName: string,
  options: {
    /** Surfaces one-line results (formatting outcomes) back to React. */
    onNotice?: (message: string) => void
  } = {}
): { dispose: () => void } {
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
  const model = monaco.editor.createModel(text, language, modelUriFor(fileName))
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
    renderLineHighlight: 'none',
    // Bottom padding keeps the last lines clear of the floating stage toolbar.
    padding: { top: 12, bottom: 56 },
  })

  if (canFormatLanguage(language)) {
    addFormatActions(editor, model, language, (message) =>
      options.onNotice?.(message)
    )
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
    dispose: () => {
      observer.disconnect()
      media.removeEventListener('change', applyInkTheme)
      editor.dispose()
      model.dispose()
    },
  }
}
