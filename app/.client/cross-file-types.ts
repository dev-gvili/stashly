/**
 * Cross-file type resolution for the code viewer.
 *
 * ATA (`type-acquisition.ts`) resolves *npm* imports. This resolves imports of
 * the user's *other uploaded files* — the `@/types/…`, `@/services/…` path
 * aliases a real project uses. It asks the backend for the project's alias
 * config, applies it to Monaco's TypeScript service, then walks the import
 * graph, fetching each referenced source file and registering it as an extra
 * lib at its real project path so `import '@/types/x'` resolves like on disk.
 *
 * v1 covers **alias** imports (and relative imports *between* fetched files,
 * which sit at their real paths). The viewed file's own relative imports aren't
 * followed — its model lives at a synthetic URI, not its real project path.
 */
import * as monaco from 'monaco-editor'

/** Matches the virtual root the acquired libs are registered under. */
const VIRTUAL_ROOT = 'file:///'
/** Overall cap on files pulled for one viewed document. */
const MAX_FILES = 250
/** Files requested per backend round-trip. */
const BATCH_SIZE = 25

/** Logical paths already requested — dedups across the walk (and re-runs). */
const requested = new Set<string>()
/** Virtual lib paths already registered with Monaco. */
const addedLibs = new Set<string>()
/**
 * Virtual lib URI → the uploaded file behind it. The import walk is the only
 * place both are known at once: the language service deals in `file:///…`
 * paths and knows nothing about items, while the app routes by item id. Go to
 * Definition joins them here (see `sourceItemFor`).
 */
const sourceItems = new Map<string, SourceItemRef>()

/** Enough to address a file's page: `/:me/stash/folders/:folderId/files/:fileId`. */
export type SourceItemRef = { itemId: string; folderId: string }

/** The uploaded file a virtual lib URI came from, if it came from one at all. */
export function sourceItemFor(uri: string): SourceItemRef | null {
  return sourceItems.get(uri) ?? null
}

export type SourceContext = {
  rootId: string
  baseUrl: string
  paths: Record<string, string[]>
  /** The viewed file's path relative to `rootId`, e.g. `app/.server/x.ts`. */
  filePath: string
}

/** A compiled `paths` entry: literal prefix/suffix around the `*`, → targets. */
type AliasMatcher = { prefix: string; suffix: string; targets: string[] }

/**
 * Fetch a file's project context (root, alias config, real path). Called from
 * the React layer in parallel with the Monaco chunk so it adds no latency, and
 * the result is used both to mount the model at its real path and to drive
 * cross-file acquisition. Returns `null` for files with no project around them.
 */
export function fetchSourceContext(
  fileId: string
): Promise<SourceContext | null> {
  return postSource({ intent: 'project-config', fileId })
}

/** Directory of a project-relative path (`app/.server/x.ts` → `app/.server`). */
function dirOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

/**
 * Resolve types from a file's other uploaded files. Fire-and-forget: as libs
 * land, Monaco re-syncs and hovers pick them up. The model is expected to be
 * mounted at `context.filePath` already, so the viewed file's own relative
 * imports resolve — we seed the walk from its directory.
 */
export async function acquireCrossFileTypes(
  context: SourceContext,
  source: string
): Promise<void> {
  try {
    if (!context?.rootId) return

    applyAliasPaths(context.paths)
    const matchers = compileMatchers(context.paths)

    // Seed from the viewed file's imports — relative ones resolve against its
    // real directory (the model is mounted there), aliases via the matchers.
    const queue = mapSpecifiers(importsOf(source), dirOf(context.filePath), matchers)
    const rootId = context.rootId
    let fetched = 0

    while (queue.length && fetched < MAX_FILES) {
      const batch = queue
        .splice(0, BATCH_SIZE)
        .filter((p) => !requested.has(p))
      if (!batch.length) continue
      for (const p of batch) requested.add(p)

      const { files } = await postSource({
        intent: 'source-files',
        rootId,
        logicalPaths: batch,
      })
      for (const { path, text, id, parentId } of files as {
        path: string
        text: string
        id: string
        parentId: string | null
      }[]) {
        const uri = `${VIRTUAL_ROOT}${path}`
        addExtraLib(text, uri)
        // A file directly in the drive root has no folder to route through;
        // it resolves for types, it just can't be navigated to.
        if (id && parentId) sourceItems.set(uri, { itemId: id, folderId: parentId })
        fetched++
        // A fetched file sits at its real path, so its own relative imports
        // resolve against that directory — follow them too.
        for (const next of mapSpecifiers(importsOf(text), dirOf(path), matchers)) {
          if (!requested.has(next)) queue.push(next)
        }
      }
    }
  } catch (err) {
    console.error('[cross-file] type resolution failed', err)
  }
}

// ---------------------------------------------------------------------------
// Monaco wiring
// ---------------------------------------------------------------------------

/**
 * Point the compiler's alias resolution at the virtual root. `baseUrl` must be
 * the `file:///` root the libs live under (verified: `.`/`/` don't match the
 * scheme); `paths` come straight from tsconfig, since their values are
 * baseUrl-relative (`app/*` → `file:///app/*`).
 *
 * **Call this before the editor mounts.** `setCompilerOptions` fires the
 * defaults' `onDidChange`, and Monaco's worker manager answers that by
 * *destroying* the TypeScript worker — taking every request in flight with it.
 * Run after mount, it throws away the worker the viewer just warmed up, which
 * is why `createCodeViewer` applies the paths up front.
 *
 * Idempotent for the same reason: re-applying a set of paths the service
 * already has would cost a worker restart for no change at all.
 */
export function applyAliasPaths(paths: Record<string, string[]>): void {
  const ts = monaco.typescript
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    const current = defaults.getCompilerOptions()
    const merged = { ...(current.paths ?? {}), ...paths }
    const unchanged =
      current.baseUrl === VIRTUAL_ROOT &&
      JSON.stringify(merged) === JSON.stringify(current.paths ?? {})
    if (unchanged) continue
    defaults.setCompilerOptions({
      ...current,
      baseUrl: VIRTUAL_ROOT,
      paths: merged,
    })
  }
}

function addExtraLib(code: string, uri: string): void {
  if (addedLibs.has(uri)) return
  addedLibs.add(uri)
  const ts = monaco.typescript
  ts.typescriptDefaults.addExtraLib(code, uri)
  ts.javascriptDefaults.addExtraLib(code, uri)
}

// ---------------------------------------------------------------------------
// Import graph
// ---------------------------------------------------------------------------

const IMPORT_PATTERNS = [
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|[^.\w])import\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

/** Every import specifier in `source`. */
function importsOf(source: string): string[] {
  const specs = new Set<string>()
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source))) specs.add(match[1])
  }
  return [...specs]
}

/**
 * `@/*` → `{prefix:'@/', suffix:'', targets:['app/*']}`, sorted so the most
 * specific pattern wins — TypeScript resolves the longest matching prefix, so
 * `@/services/*` (→ app/.server/*) must beat the catch-all `@/*` (→ app/*),
 * regardless of their order in tsconfig.
 */
function compileMatchers(paths: Record<string, string[]>): AliasMatcher[] {
  return Object.entries(paths)
    .map(([pattern, targets]) => {
      const star = pattern.indexOf('*')
      return star === -1
        ? { prefix: pattern, suffix: '', targets } // exact (no wildcard)
        : {
            prefix: pattern.slice(0, star),
            suffix: pattern.slice(star + 1),
            targets,
          }
    })
    .sort((a, b) => b.prefix.length - a.prefix.length || b.suffix.length - a.suffix.length)
}

/**
 * Turn specifiers into project-root-relative logical paths. Relative specifiers
 * resolve against `fromDir` (only known for already-placed files); aliases go
 * through the matchers; bare npm specifiers are dropped (ATA's job).
 */
function mapSpecifiers(
  specs: string[],
  fromDir: string | null,
  matchers: AliasMatcher[]
): string[] {
  const out: string[] = []
  for (const spec of specs) {
    if (spec.startsWith('.')) {
      if (fromDir !== null) out.push(joinPath(fromDir, spec))
      continue
    }
    for (const m of matchers) {
      if (!spec.startsWith(m.prefix) || !spec.endsWith(m.suffix)) continue
      const star = spec.slice(m.prefix.length, spec.length - m.suffix.length)
      for (const target of m.targets) {
        const mapped = target.includes('*') ? target.replace('*', star) : target
        // tsconfig targets are baseUrl-relative (`./app/.server/*`); strip the
        // leading `./` so the logical path lines up with the file paths the
        // server returns and registers (`app/.server/x.ts`).
        out.push(mapped.replace(/^\.\//, ''))
      }
      break
    }
  }
  return out
}

/** Resolve `../x` / `./x` against `dir`, returning a normalized logical path. */
function joinPath(dir: string, rel: string): string {
  const out = dir ? dir.split('/') : []
  for (const seg of rel.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

// ---------------------------------------------------------------------------

async function postSource(body: object): Promise<any> {
  const res = await fetch('/api/source-types', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok ? res.json() : null
}
