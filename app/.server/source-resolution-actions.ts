/**
 * Cross-file type resolution for the code viewer.
 *
 * When a viewed `.ts`/`.tsx` file imports another *uploaded* file — usually via
 * a path alias like `@/types/stash.types` — the viewer needs that file's source
 * to resolve its types. This exposes two operations the client drives:
 *
 *  1. `getProjectConfig` — walk up from the viewed file to the nearest folder
 *     holding a `tsconfig.json`/`jsconfig.json`, and read its `baseUrl`/`paths`.
 *     That folder is the project root everything resolves against.
 *  2. `getSourceFiles` — given project-relative logical paths (already alias-
 *     mapped by the client), find each file under the root and return its text,
 *     resolving the extension/`index` the way TypeScript would.
 *
 * All reads are gated by the same `read` permission the viewer already enforces
 * on the opened file, checked against the project root.
 */
import { prisma } from '@/services/db'
import { getObjectText } from './s3'
import { hasItemPermission } from './permission-actions'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'

/** Config filenames that mark a project root, in priority order. */
const PROJECT_FILES = ['tsconfig.json', 'jsconfig.json']
/** Extensions tried, in order, when resolving an extensionless logical path. */
const RESOLVE_EXTS = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs']
/** Don't walk more than this many ancestors looking for a project root. */
const MAX_ANCESTOR_WALK = 40
/** Cap the files one `getSourceFiles` call will read. */
const MAX_FILES_PER_REQUEST = 60

export type ProjectConfig = {
  /** Item id of the folder that is the project root. */
  rootId: string
  /** `compilerOptions.baseUrl`, defaulting to `.`. */
  baseUrl: string
  /** `compilerOptions.paths`, e.g. `{ "@/*": ["app/*"] }`. */
  paths: Record<string, string[]>
  /** The viewed file's path relative to `rootId`, e.g. `app/.server/x.ts`. */
  filePath: string
}

export type SourceFile = {
  path: string
  text: string
  /** The file's item id — what Go to Definition navigates to. */
  id: string
  /**
   * Its folder, since the file page is addressed by both
   * (`/:me/stash/folders/:folderId/files/:fileId`).
   */
  parentId: string | null
}

/**
 * Describe a file's place in its uploaded project: the project root, the
 * viewed file's path under it, and the alias config.
 *
 * The root is the nearest ancestor holding a `tsconfig`/`jsconfig`; failing
 * that, the topmost uploaded folder (just under the user's drive root), or the
 * drive root itself for a file that sits directly in it. That fallback is
 * deliberate — mounting the viewed file at its *real* path lets its relative
 * imports (`./x`, `../y`) resolve on their own, so a project doesn't need a
 * tsconfig at all for those; a tsconfig only adds alias (`@/…`) support.
 * Returns `null` only when the file has no parent at all.
 */
export async function getProjectConfig(
  userId: string,
  fileId: string
): Promise<ProjectConfig | null> {
  if (!(await hasItemPermission(userId, fileId, 'read'))) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN)
  }

  const [user, file] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { rootId: true } }),
    prisma.item.findUnique({
      where: { id: fileId },
      select: { name: true, parentId: true },
    }),
  ])
  if (!file?.parentId) return null
  const driveRootId = user?.rootId ?? null

  // Walk parent → up, collecting the folder chain and the nearest tsconfig.
  const ancestors: Array<{ id: string; name: string }> = []
  let tsconfigRootId: string | null = null
  let tsconfigText: string | null = null
  let parentId: string | null = file.parentId

  for (let i = 0; i < MAX_ANCESTOR_WALK && parentId && parentId !== driveRootId; i++) {
    const currentId: string = parentId
    const folder = await prisma.item.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    })
    if (!folder) break
    ancestors.push({ id: folder.id, name: folder.name })
    if (!tsconfigRootId) {
      const config = await prisma.item.findFirst({
        where: { parentId: folder.id, type: 'file', name: { in: PROJECT_FILES } },
        select: { file: { select: { bucket: true, key: true } } },
      })
      if (config?.file) {
        tsconfigRootId = folder.id
        tsconfigText = await getObjectText(
          config.file.bucket,
          config.file.key
        ).catch(() => null)
      }
    }
    parentId = folder.parentId
  }
  // A file sitting directly inside the drive root has no ancestors to collect —
  // `root` itself is its project root, so don't bail. An empty chain whose
  // parent is *not* the drive root means a broken lookup, which still fails safe.
  if (ancestors.length === 0 && parentId !== driveRootId) return null

  // The walk above stops *before* the drive root (`parentId !== driveRootId`),
  // so a tsconfig sitting at the very top of the drive — the project uploaded
  // straight into the drive root rather than wrapped in a folder — is never
  // inspected, and every `@/…` alias silently fails to resolve while relative
  // imports still work. Scan the drive root itself as the last candidate. The
  // drive root is intentionally left out of `ancestors`, so the fallback root
  // (topmost uploaded folder) is unchanged when there's no tsconfig at all.
  if (!tsconfigRootId && driveRootId && parentId === driveRootId) {
    const config = await prisma.item.findFirst({
      where: { parentId: driveRootId, type: 'file', name: { in: PROJECT_FILES } },
      select: { file: { select: { bucket: true, key: true } } },
    })
    if (config?.file) {
      tsconfigRootId = driveRootId
      tsconfigText = await getObjectText(
        config.file.bucket,
        config.file.key
      ).catch(() => null)
    }
  }

  // Root: the tsconfig folder; else the topmost uploaded folder; else the drive
  // root itself, for a file that sits directly in it (no ancestors collected).
  const rootId =
    tsconfigRootId ?? ancestors[ancestors.length - 1]?.id ?? driveRootId
  if (!rootId) return null
  const rootIndex = ancestors.findIndex((a) => a.id === rootId)
  // Folders strictly between the file and the root, nearest-first → reverse to
  // root-first, then the file name: `app/.server/x.ts`.
  const between = ancestors.slice(0, rootIndex === -1 ? ancestors.length : rootIndex)
  const filePath = [...between.map((a) => a.name).reverse(), file.name].join('/')

  const { baseUrl, paths } = tsconfigText
    ? parseTsconfig(tsconfigText)
    : { baseUrl: '.', paths: await synthesizeAliasPaths(rootId) }
  return { rootId, baseUrl, paths, filePath }
}

/**
 * Alias sigils synthesized for a project that shipped no tsconfig. `@/`, `~/`
 * and `#/` are the near-universal conventions; a scoped npm package
 * (`@sentry/react`) always has characters before its slash, so a bare
 * sigil-then-slash key never captures those.
 */
const SYNTH_ALIAS_PREFIXES = ['@/', '~/', '#/']
/** Folders an alias commonly points at, tried in this order (then the root). */
const SYNTH_SOURCE_ROOTS = ['app', 'src']

/**
 * Fabricate a `paths` map for a project with no tsconfig, so `@/…` aliases
 * still resolve. There's no real mapping to read, so we point every common
 * sigil at every plausible source root as an *ordered target list* — TypeScript
 * (and the client's matcher) try `app/*`, then `src/*`, then the root itself,
 * and the first that actually holds the file wins. Only source roots that exist
 * under the project root are listed, plus a root-relative `*` fallback.
 *
 * Emitted unconditionally: an unused sigil is harmless (it simply never
 * matches), and a scoped-package import can't collide with a `@/`-prefixed key.
 */
async function synthesizeAliasPaths(
  rootId: string
): Promise<Record<string, string[]>> {
  const folders = await prisma.item.findMany({
    where: { parentId: rootId, type: 'folder', name: { in: SYNTH_SOURCE_ROOTS } },
    select: { name: true },
  })
  const present = new Set(folders.map((f) => f.name))
  const targets = [
    ...SYNTH_SOURCE_ROOTS.filter((r) => present.has(r)).map((r) => `${r}/*`),
    '*',
  ]
  const paths: Record<string, string[]> = {}
  for (const prefix of SYNTH_ALIAS_PREFIXES) paths[`${prefix}*`] = targets
  return paths
}

/**
 * Read the source of each requested logical path (project-root-relative, e.g.
 * `app/types/stash.types`). Missing files are skipped, so the client gets back
 * only what actually resolved.
 */
export async function getSourceFiles(
  userId: string,
  rootId: string,
  logicalPaths: string[]
): Promise<SourceFile[]> {
  if (!(await hasItemPermission(userId, rootId, 'read'))) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN)
  }

  const out: SourceFile[] = []
  const seen = new Set<string>()
  for (const logical of logicalPaths.slice(0, MAX_FILES_PER_REQUEST)) {
    const normalized = normalize(logical)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    const resolved = await resolveUnderRoot(rootId, normalized)
    if (resolved) out.push(resolved)
  }
  return out
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/** Candidate real paths for a logical path, mirroring TS's extension search. */
function candidatesFor(logical: string): string[] {
  if (/\.[mc]?[jt]sx?$/.test(logical) || logical.endsWith('.d.ts')) {
    return [logical]
  }
  return [
    ...RESOLVE_EXTS.map((ext) => `${logical}${ext}`),
    ...RESOLVE_EXTS.map((ext) => `${logical}/index${ext}`),
  ]
}

/** First candidate that exists as a file under `rootId`, with its text. */
async function resolveUnderRoot(
  rootId: string,
  logical: string
): Promise<SourceFile | null> {
  for (const candidate of candidatesFor(logical)) {
    const file = await findFileByPath(rootId, candidate)
    if (file) {
      const text = await getObjectText(file.bucket, file.key).catch(() => null)
      if (text != null) {
        return {
          path: candidate,
          text,
          id: file.id,
          parentId: file.parentId,
        }
      }
    }
  }
  return null
}

/** Walk the folder tree from `rootId` down a `/`-separated path to a File. */
async function findFileByPath(
  rootId: string,
  relPath: string
): Promise<{
  id: string
  parentId: string | null
  bucket: string
  key: string
} | null> {
  const segments = relPath.split('/').filter(Boolean)
  let parentId = rootId
  for (let i = 0; i < segments.length; i++) {
    const last = i === segments.length - 1
    const item = await prisma.item.findFirst({
      where: { parentId, name: segments[i] },
      select: {
        id: true,
        parentId: true,
        file: last ? { select: { bucket: true, key: true } } : false,
      },
    })
    if (!item) return null
    if (last) {
      // Spelled out rather than spread: `file` is selected behind a ternary,
      // so its type widens to the whole File model — whose own `id` would
      // silently overwrite the item's, which is the id we navigate by.
      return item.file
        ? {
            id: item.id,
            parentId: item.parentId,
            bucket: item.file.bucket,
            key: item.file.key,
          }
        : null
    }
    parentId = item.id
  }
  return null
}

/** Collapse `./` and `../` segments; drop a leading slash. */
function normalize(path: string): string {
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

/**
 * Extract `baseUrl` + `paths` from tsconfig text. tsconfig is JSONC (comments,
 * trailing commas), so it's lightly stripped before parsing. Any failure just
 * yields empty config — aliases won't resolve, which fails safe.
 */
function parseTsconfig(text: string | null): {
  baseUrl: string
  paths: Record<string, string[]>
} {
  if (!text) return { baseUrl: '.', paths: {} }
  try {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/(^|[^:"'\\])\/\/.*$/gm, '$1') // line comments (naive)
      .replace(/,(\s*[}\]])/g, '$1') // trailing commas
    const json = JSON.parse(stripped)
    const co = json?.compilerOptions ?? {}
    return {
      baseUrl: typeof co.baseUrl === 'string' ? co.baseUrl : '.',
      paths:
        co.paths && typeof co.paths === 'object'
          ? (co.paths as Record<string, string[]>)
          : {},
    }
  } catch {
    return { baseUrl: '.', paths: {} }
  }
}
