/**
 * Document outline for the code viewer — the symbol tree behind the left rail,
 * the same data VSCode's Outline view and its `@` quick-open list are built on.
 *
 * Symbols come from the *registered document-symbol providers*, not from a
 * parser of our own: whichever language services are configured in `monaco.ts`
 * (TypeScript/JavaScript via the TS worker's navigation tree, JSON, CSS/SCSS/
 * LESS, HTML) each contribute a provider, so every language the viewer already
 * understands gets an outline for free and anything else (plaintext, logs,
 * shell) simply reports none.
 *
 * That registry is not on Monaco's public API surface — `monaco.languages` can
 * only *register* a provider, never enumerate them — so the two imports below
 * reach into the editor's own service layer, which is exactly what Monaco's
 * built-in "Go to Symbol" does internally. Both paths exist in the ESM build
 * (same deep-import contract as the SQL grammar in `monaco.ts`); if a future
 * Monaco moves them, the failure mode is a rail that stays empty, not a crash.
 */
import * as monaco from 'monaco-editor'
// @ts-expect-error - no type declarations for this module path
import { ILanguageFeaturesService } from 'monaco-editor/esm/vs/editor/common/services/languageFeatures.js'
// @ts-expect-error - no type declarations for this module path
import { StandaloneServices } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js'

/** Settle time after a content change before the tree is rebuilt. */
const REBUILD_DEBOUNCE_MS = 250

/** Backoff for re-asking after a provider answered with nothing. */
const EMPTY_RETRY_MS = 400
const MAX_EMPTY_RETRIES = 3

/**
 * One node of the outline, flattened to plain data so it can cross into React
 * state — Monaco's own `DocumentSymbol` carries live `Range` instances and a
 * numeric `SymbolKind`, neither of which belongs in a component tree.
 */
export type OutlineSymbol = {
  /** Stable across rebuilds (path + name), so React keys survive a format. */
  id: string
  name: string
  /** Type/signature hint some providers supply; '' when there is none. */
  detail: string
  /** `SymbolKind` as a lowercase slug — 'function', 'class', 'property', … */
  kind: string
  /** The symbol's name, as a selectable range: what a click reveals. */
  line: number
  column: number
  endColumn: number
  /** The symbol's whole body — used to mark the node holding the cursor. */
  startLine: number
  endLine: number
  children: OutlineSymbol[]
}

/** Where a click in the rail should put the editor's selection. */
export type OutlineTarget = Pick<
  OutlineSymbol,
  'line' | 'column' | 'endColumn'
>

/** Monaco's `DocumentSymbol`, as much of it as this module reads. */
type DocumentSymbol = {
  name: string
  detail?: string
  kind: number
  range: monaco.IRange
  selectionRange: monaco.IRange
  children?: DocumentSymbol[]
}

type SymbolProvider = {
  provideDocumentSymbols: (
    model: monaco.editor.ITextModel,
    token: monaco.CancellationToken
  ) => DocumentSymbol[] | null | undefined | Promise<DocumentSymbol[] | null | undefined>
}

/**
 * The document-symbol provider registry. Providers register *lazily* — a
 * language's mode is only set up once a model of that language exists, and the
 * TS mode does it asynchronously — so the registry's own change event is a
 * rebuild trigger, not just the model's.
 */
type ProviderRegistry = {
  ordered: (model: monaco.editor.ITextModel) => SymbolProvider[]
  onDidChange: (listener: () => void) => monaco.IDisposable
}

function symbolRegistry(): ProviderRegistry | null {
  try {
    return StandaloneServices.get(ILanguageFeaturesService).documentSymbolProvider
  } catch (err) {
    console.error('[monaco] no document-symbol registry', err)
    return null
  }
}

/** `SymbolKind` (a numeric enum) → the slug the rail renders a glyph for. */
const KIND_SLUGS: Record<number, string> = {
  [monaco.languages.SymbolKind.File]: 'file',
  [monaco.languages.SymbolKind.Module]: 'module',
  [monaco.languages.SymbolKind.Namespace]: 'namespace',
  [monaco.languages.SymbolKind.Package]: 'package',
  [monaco.languages.SymbolKind.Class]: 'class',
  [monaco.languages.SymbolKind.Method]: 'method',
  [monaco.languages.SymbolKind.Property]: 'property',
  [monaco.languages.SymbolKind.Field]: 'field',
  [monaco.languages.SymbolKind.Constructor]: 'constructor',
  [monaco.languages.SymbolKind.Enum]: 'enum',
  [monaco.languages.SymbolKind.Interface]: 'interface',
  [monaco.languages.SymbolKind.Function]: 'function',
  [monaco.languages.SymbolKind.Variable]: 'variable',
  [monaco.languages.SymbolKind.Constant]: 'constant',
  [monaco.languages.SymbolKind.String]: 'string',
  [monaco.languages.SymbolKind.Number]: 'number',
  [monaco.languages.SymbolKind.Boolean]: 'boolean',
  [monaco.languages.SymbolKind.Array]: 'array',
  [monaco.languages.SymbolKind.Object]: 'object',
  [monaco.languages.SymbolKind.Key]: 'key',
  [monaco.languages.SymbolKind.Null]: 'null',
  [monaco.languages.SymbolKind.EnumMember]: 'enum-member',
  [monaco.languages.SymbolKind.Struct]: 'struct',
  [monaco.languages.SymbolKind.Event]: 'event',
  [monaco.languages.SymbolKind.Operator]: 'operator',
  [monaco.languages.SymbolKind.TypeParameter]: 'type-parameter',
}

function toOutlineSymbol(
  symbol: DocumentSymbol,
  path: string,
  index: number
): OutlineSymbol {
  const id = `${path}/${index}:${symbol.name}`
  // `selectionRange` is the name; `range` is the whole declaration. Providers
  // are allowed to omit the former, so fall back rather than read undefined.
  const name = symbol.selectionRange ?? symbol.range
  return {
    id,
    name: symbol.name,
    detail: symbol.detail ?? '',
    kind: KIND_SLUGS[symbol.kind] ?? 'variable',
    line: name.startLineNumber,
    column: name.startColumn,
    endColumn: name.endColumn,
    startLine: symbol.range.startLineNumber,
    endLine: symbol.range.endLineNumber,
    children: (symbol.children ?? []).map((child, i) =>
      toOutlineSymbol(child, id, i)
    ),
  }
}

// ---------------------------------------------------------------------------
// TypeScript / JavaScript — straight from the navigation tree
//
// Monaco's own OutlineAdapter reads the same tree but flattens it through a
// six-entry lookup (`outlineTypeTable`) whose default is `SymbolKind.Variable`.
// Everything it doesn't list collapses: a `type` alias, an import `alias`, a
// `const` and a `let` all arrive as "variable" — which is why a file of
// `export type X = z.infer<…>` reads as 35 variables here and 35 classes in
// VSCode. The raw `kind` string is far richer, so TS/JS asks the worker
// directly and keeps it.
// ---------------------------------------------------------------------------

/** A `ts.NavigationTree`, as much of it as this module reads. */
type NavigationTree = {
  text: string
  kind: string
  spans: { start: number; length: number }[]
  /** The identifier alone — a better click target than the whole declaration. */
  nameSpan?: { start: number; length: number }
  childItems?: NavigationTree[]
}

/**
 * `ScriptElementKind` → our slug, following VSCode's `getSymbolKind`
 * (typescript-language-features), plus `type` and `alias` — the two kinds
 * Monaco's own adapter collapses into "variable".
 *
 * `const`, `let` and `var` are deliberately *not* split, matching VSCode: how
 * a binding was declared says nothing about where it is, and the rail is for
 * finding things. `constant` stays in `KIND_SLUGS` for the languages whose
 * providers report it directly.
 */
const TS_KIND_SLUGS: Record<string, string> = {
  module: 'module',
  class: 'class',
  'local class': 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  'enum member': 'enum-member',
  var: 'variable',
  let: 'variable',
  const: 'variable',
  'local var': 'variable',
  function: 'function',
  'local function': 'function',
  method: 'method',
  getter: 'property',
  setter: 'property',
  property: 'property',
  constructor: 'constructor',
  call: 'method',
  index: 'property',
  construct: 'constructor',
  parameter: 'variable',
  'type parameter': 'type-parameter',
  alias: 'alias',
  string: 'string',
  script: 'file',
}

function fromNavigationTree(
  item: NavigationTree,
  model: monaco.editor.ITextModel,
  path: string,
  index: number
): OutlineSymbol {
  const id = `${path}/${index}:${item.text}`
  const body = item.spans[0]
  const name = item.nameSpan ?? body
  const nameStart = model.getPositionAt(name.start)
  const nameEnd = model.getPositionAt(name.start + name.length)
  return {
    id,
    name: item.text,
    detail: '',
    kind: TS_KIND_SLUGS[item.kind] ?? 'variable',
    line: nameStart.lineNumber,
    column: nameStart.column,
    // A name never wraps across lines, but a missing `nameSpan` falls back to
    // the whole declaration — clamp so the selection stays on one line.
    endColumn:
      nameEnd.lineNumber === nameStart.lineNumber
        ? nameEnd.column
        : nameStart.column,
    startLine: model.getPositionAt(body.start).lineNumber,
    endLine: model.getPositionAt(body.start + body.length).lineNumber,
    children: (item.childItems ?? []).map((child, i) =>
      fromNavigationTree(child, model, id, i)
    ),
  }
}

/**
 * The TS/JS outline, with the language service's own kinds intact. Returns
 * null when the service can't answer yet — the mode is set up lazily, so an
 * early call throws "TypeScript not registered!" and the caller falls back to
 * the generic provider path until a rebuild trigger fires.
 */
async function typeScriptSymbols(
  model: monaco.editor.ITextModel
): Promise<OutlineSymbol[] | null> {
  const language = model.getLanguageId()
  if (language !== 'typescript' && language !== 'javascript') return null
  try {
    const getWorker =
      language === 'javascript'
        ? await monaco.typescript.getJavaScriptWorker()
        : await monaco.typescript.getTypeScriptWorker()
    if (model.isDisposed()) return null
    const client = await getWorker(model.uri)
    const root: NavigationTree | undefined = await client.getNavigationTree(
      model.uri.toString()
    )
    if (!root || model.isDisposed()) return null
    // The root is the file itself; its children are the top-level symbols.
    return (root.childItems ?? []).map((item, i) =>
      fromNavigationTree(item, model, '', i)
    )
  } catch (err) {
    console.error('[monaco] navigation tree unavailable', err)
    return null
  }
}

/**
 * Ask each provider in turn and take the first that answers.
 *
 * VSCode merges every provider's result into one model; here the languages in
 * play contribute exactly one provider each, so first-answer-wins is the same
 * tree without the merge machinery — and it keeps a provider that throws from
 * blanking the rail.
 */
async function collectSymbols(
  registry: ProviderRegistry,
  model: monaco.editor.ITextModel,
  token: monaco.CancellationToken
): Promise<OutlineSymbol[]> {
  // TS/JS come from the worker directly, for the kinds Monaco's adapter drops.
  const fromTs = await typeScriptSymbols(model)
  if (fromTs?.length) return fromTs
  if (token.isCancellationRequested || model.isDisposed()) return []

  for (const provider of registry.ordered(model)) {
    if (token.isCancellationRequested || model.isDisposed()) return []
    try {
      const symbols = await provider.provideDocumentSymbols(model, token)
      if (symbols?.length) {
        return symbols.map((symbol, i) => toOutlineSymbol(symbol, '', i))
      }
    } catch (err) {
      console.error('[monaco] a document-symbol provider failed', err)
    }
  }
  return []
}

/**
 * A TS/JS model's outline also has to be rebuilt when the *compiler options*
 * change, which is not something the symbol registry announces.
 *
 * Monaco's worker manager answers a compiler-options change by *destroying*
 * the TypeScript worker (`_stopWorker`), so an outline request in flight dies
 * with it and nothing else ever fires. `createCodeViewer` now sets the viewer's
 * alias paths before the editor mounts precisely so this doesn't happen on the
 * hot path — this listener is the backstop for anything that reconfigures the
 * service later.
 *
 * `onDidExtraLibsChange` is deliberately not watched: acquired libs are pushed
 * to a *live* worker, and another file's types can't change the symbols this
 * document declares — subscribing would only rebuild the tree once per batch
 * for no change.
 */
function watchLanguageDefaults(
  model: monaco.editor.ITextModel,
  onChange: () => void
): monaco.IDisposable[] {
  const language = model.getLanguageId()
  if (language !== 'typescript' && language !== 'javascript') return []
  const defaults =
    language === 'javascript'
      ? monaco.typescript.javascriptDefaults
      : monaco.typescript.typescriptDefaults
  return [defaults.onDidChange(onChange)]
}

/**
 * Keep `report` fed with the model's outline: once at mount, again whenever a
 * provider registers (the TS worker arrives well after the editor paints) or
 * the language defaults change, and again after each content change — Format
 * Document rewrites every line, so a tree built from the original text would
 * send every click to the wrong place.
 *
 * Rebuilds are debounced and each one cancels the last, so a burst of changes
 * costs a single pass through the language service.
 *
 * An empty answer from a provider that *exists* is treated as "ask again
 * shortly" rather than "this file has no symbols": a worker restarted under us
 * returns nothing for a moment, and dropping the tree on that would leave the
 * rail permanently blank. A tree already on screen is kept while retrying, so
 * the rail never flickers empty. Returns a disposer.
 */
export function watchOutline(
  model: monaco.editor.ITextModel,
  report: (symbols: OutlineSymbol[]) => void
): { dispose: () => void } {
  const registry = symbolRegistry()
  if (!registry) return { dispose: () => {} }

  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: monaco.CancellationTokenSource | null = null
  let retries = 0

  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void build(), delay)
  }

  const build = async () => {
    if (disposed || model.isDisposed()) return
    pending?.cancel()
    const source = new monaco.CancellationTokenSource()
    pending = source
    const symbols = await collectSymbols(registry, model, source.token)
    if (disposed || source.token.isCancellationRequested || model.isDisposed()) {
      return
    }

    const answerable = registry.ordered(model).length > 0
    if (!symbols.length && answerable && retries < MAX_EMPTY_RETRIES) {
      retries += 1
      schedule(EMPTY_RETRY_MS * retries)
      return
    }

    retries = 0
    report(symbols)
  }

  /** A real trigger — the retry budget starts over. */
  const rebuild = (delay: number) => {
    retries = 0
    schedule(delay)
  }

  schedule(0)
  const change = model.onDidChangeContent(() => rebuild(REBUILD_DEBOUNCE_MS))
  const providers = registry.onDidChange(() => rebuild(0))
  const defaults = watchLanguageDefaults(model, () =>
    rebuild(REBUILD_DEBOUNCE_MS)
  )

  return {
    dispose: () => {
      disposed = true
      if (timer) clearTimeout(timer)
      pending?.cancel()
      change.dispose()
      providers.dispose()
      for (const listener of defaults) listener.dispose()
    },
  }
}
