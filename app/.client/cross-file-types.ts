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
 * Each registered lib's disposables, so a project switch can take them back
 * down. Both defaults get their own — `addExtraLib` is called once per.
 */
const libs = new Map<string, monaco.IDisposable[]>()
/** The project root everything above currently describes. */
let currentRootId: string | null = null
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

/** Project-config lookups in flight or already answered, by file id. */
const contexts = new Map<string, Promise<SourceContext | null>>()

/**
 * Fetch a file's project context (root, alias config, real path). Called from
 * the React layer in parallel with the Monaco chunk so it adds no latency, and
 * the result is used both to mount the model at its real path and to drive
 * cross-file acquisition. Returns `null` for files with no project around them.
 *
 * Deduped by file id, because the viewer's mount effect runs twice: measured
 * in the browser, both calls come off the same `Promise.all` in `code-viewer`
 * 4ms apart with identical stacks. Its `cancelled` flag stops the second
 * *editor* from being built but not the second request, which was already in
 * flight by then. Reopening a file later reuses the answer too — the walk's
 * `requested` and `addedLibs` already live this long for the same reason.
 */
export function fetchSourceContext(
  fileId: string
): Promise<SourceContext | null> {
  const cached = contexts.get(fileId)
  if (cached) return cached
  const request = postSource({ intent: 'project-config', fileId })
  contexts.set(fileId, request)
  // A failed lookup isn't an answer — drop it so the next open can retry.
  request.catch(() => contexts.delete(fileId))
  return request
}

/** A real path back to the logical path that would resolve to it. */
function logicalOf(path: string): string {
  return path.replace(/\.(d\.ts|[mc]?[jt]sx?)$/, '').replace(/\/index$/, '')
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
    // Paths already sitting in `queue`. `requested` only fills in once a path
    // has been spliced into a batch, so on its own it can't stop the same path
    // — pushed once per file that imports it — from being queued many times
    // over. Those copies then eat slots in the batch they're spliced with,
    // which costs a round-trip nobody needed.
    const queued = new Set(queue)
    const rootId = context.rootId
    let fetched = 0

    while (queue.length && fetched < MAX_FILES) {
      // The walk is fire-and-forget, so it can still be mid-batch when the
      // viewer moves to another project and `resetForRoot` clears the sets
      // underneath it. Registering the rest would put the old project's files
      // back at paths the new one now owns.
      if (currentRootId !== null && currentRootId !== rootId) return
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
      for (const { path, requested: asked, text, id, parentId } of files as {
        path: string
        requested: string
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
        // Fetching the file is only half of it. A project with no tsconfig gets
        // a *synthesized* alias map, which assumes an alias names the folder it
        // points at — true for `@/utils/*`, false for `@/ui/*`
        // (`components/ui`) and `@/services/*` (`.server`). The server finds
        // those anyway, but the compiler resolves the import through `paths`
        // and lands on the folder that was guessed, where nothing is. So put
        // something there.
        if (logicalOf(path) !== asked) addAliasShim(asked, path, id, parentId)
        // A fetched file sits at its real path, so its own relative imports
        // resolve against that directory — follow them too.
        for (const next of mapSpecifiers(importsOf(text), dirOf(path), matchers)) {
          if (requested.has(next) || queued.has(next)) continue
          queued.add(next)
          queue.push(next)
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
  libs.set(uri, [
    ts.typescriptDefaults.addExtraLib(code, uri),
    ts.javascriptDefaults.addExtraLib(code, uri),
  ])
}

/**
 * Drop everything acquired for the *previous* project, when the viewer moves to
 * a file under a different root.
 *
 * Libs are registered at their project-relative path (`file:///app/utils/x.ts`)
 * because that's what makes the compiler resolve them like on disk — which also
 * means the path carries no trace of *which* project it came from. Two uploads
 * that both contain `app/utils/x.ts` collide: `addedLibs` and `requested` would
 * report the second one as already handled, and project A's source would keep
 * answering project B's imports with no error anywhere to show for it.
 *
 * Disposing rides `onDidExtraLibsChange`, which patches the live worker — the
 * non-destructive channel (see `addAliasShim`). **Call it before the editor
 * mounts**, though: the new project's alias map usually differs, so
 * `applyAliasPaths` will restart the worker on the way in, and the restart
 * re-parses whatever is still registered. Clearing first is the difference
 * between re-parsing one project's libs and re-parsing every project the
 * session has opened.
 *
 * `contexts` is deliberately kept — it's keyed by file id, so it can't collide.
 */
export function resetForRoot(rootId: string): void {
  if (currentRootId === rootId) return
  currentRootId = rootId
  for (const disposables of libs.values()) {
    for (const disposable of disposables) disposable.dispose()
  }
  libs.clear()
  addedLibs.clear()
  requested.clear()
  sourceItems.clear()
}

/**
 * Make an import resolve where the compiler *looks*, for a file that turned out
 * not to be there — a declaration file at the guessed path, re-exporting the
 * real one.
 *
 * The obvious alternative is to re-point the specifier through `paths`, and
 * that is what this used to do. It cost far more than it looks: every
 * `setCompilerOptions` fires the defaults' `onDidChange`, and Monaco's worker
 * manager answers that by *destroying* the TypeScript worker. The replacement
 * re-imports Monaco's `typescriptServices` bundle — 43.5MB unbundled in dev, over
 * Chrome's per-entry cache ceiling so it re-downloads in full — and re-parses
 * every lib acquired so far. One mis-guessed alias bought a 45MB reload, and a
 * 250-file walk did it nine times over.
 *
 * `addExtraLib` goes down the other channel (`onDidExtraLibsChange`), which
 * patches the *live* worker in place. Same resolution, no restart, and it works
 * for a mis-resolved relative import too — `paths` could only ever fix aliases.
 *
 * Semantic validation is off for the viewer (`configureLanguageService`), so
 * re-exporting `default` costs nothing when the target hasn't got one, and
 * carries the common `export default` component when it has.
 */
function addAliasShim(
  asked: string,
  realPath: string,
  id: string,
  parentId: string | null
): void {
  const target = relativeFrom(dirOf(asked), logicalOf(realPath))
  const uri = `${VIRTUAL_ROOT}${asked}.d.ts`
  addExtraLib(
    `export * from '${target}'\nexport { default } from '${target}'\n`,
    uri
  )
  // Go to Definition on the *specifier* lands on the shim rather than the file
  // behind it, so the shim has to route to the same item the real lib does.
  if (id && parentId) sourceItems.set(uri, { itemId: id, folderId: parentId })
}

/** Relative specifier from `fromDir` to `toPath` (`services` → `.server/db` = `../.server/db`). */
function relativeFrom(fromDir: string, toPath: string): string {
  const from = fromDir ? fromDir.split('/') : []
  const to = toPath.split('/')
  let shared = 0
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) {
    shared++
  }
  const up = from.length - shared
  return (up ? '../'.repeat(up) : './') + to.slice(shared).join('/')
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
