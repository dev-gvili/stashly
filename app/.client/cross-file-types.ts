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

type ProjectConfig = {
  rootId: string
  baseUrl: string
  paths: Record<string, string[]>
} | null

/** A compiled `paths` entry: literal prefix/suffix around the `*`, → targets. */
type AliasMatcher = { prefix: string; suffix: string; targets: string[] }

/**
 * Resolve types from other uploaded files for `source`. Fire-and-forget: as
 * libs land, Monaco re-syncs and hovers pick them up.
 */
export async function acquireCrossFileTypes(
  fileId: string,
  source: string
): Promise<void> {
  try {
    const config: ProjectConfig = await postSource({
      intent: 'project-config',
      fileId,
    })
    if (!config?.rootId) return

    applyAliasPaths(config.paths)
    const matchers = compileMatchers(config.paths)

    // Seed the queue from the viewed file's alias imports.
    const queue = mapSpecifiers(importsOf(source), null, matchers)
    let fetched = 0

    while (queue.length && fetched < MAX_FILES) {
      const batch = queue
        .splice(0, BATCH_SIZE)
        .filter((p) => !requested.has(p))
      if (!batch.length) continue
      for (const p of batch) requested.add(p)

      const { files } = await postSource({
        intent: 'source-files',
        rootId: config.rootId,
        logicalPaths: batch,
      })
      for (const { path, text } of files as {
        path: string
        text: string
      }[]) {
        addExtraLib(text, `${VIRTUAL_ROOT}${path}`)
        fetched++
        // A fetched file sits at its real path, so its own relative imports
        // resolve against that directory — follow them too.
        const dir = path.includes('/')
          ? path.slice(0, path.lastIndexOf('/'))
          : ''
        for (const next of mapSpecifiers(importsOf(text), dir, matchers)) {
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
 */
function applyAliasPaths(paths: Record<string, string[]>): void {
  const ts = monaco.typescript
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    const current = defaults.getCompilerOptions()
    defaults.setCompilerOptions({
      ...current,
      baseUrl: VIRTUAL_ROOT,
      paths: { ...(current.paths ?? {}), ...paths },
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

/** `@/*` → `{prefix:'@/', suffix:'', targets:['app/*']}`. */
function compileMatchers(paths: Record<string, string[]>): AliasMatcher[] {
  return Object.entries(paths).map(([pattern, targets]) => {
    const star = pattern.indexOf('*')
    return star === -1
      ? { prefix: pattern, suffix: '', targets } // exact (no wildcard)
      : {
          prefix: pattern.slice(0, star),
          suffix: pattern.slice(star + 1),
          targets,
        }
  })
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
        out.push(target.includes('*') ? target.replace('*', star) : target)
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
