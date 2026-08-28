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
/** Cap the *misses* one call will re-try through the suffix fallback. */
const MAX_SUFFIX_LOOKUPS = 25
/** Cap the same-name files one suffix lookup will consider. */
const MAX_NAME_HITS = 8

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
  /**
   * The logical path the client asked for. Usually `path` minus its extension,
   * but the suffix fallback can answer `services/db` with `.server/db.ts` — and
   * the client needs the pairing to point the alias at where the file *is*.
   */
  requested: string
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

  // Exact resolution is authoritative when the project told us its aliases.
  // Without a tsconfig the alias map was *synthesized* (see
  // `synthesizeAliasPaths`), so a miss is as likely to be a wrong guess as a
  // missing file — that's the only case the suffix fallback is allowed to run.
  // The suffix fallback searches by file *name*, which needs an owner to scope
  // against: unscoped, the query sweeps every item in the database and its
  // `take` window fills with other users' identically-named files before
  // `pathUnderRoot` ever gets to reject them — so the caller's own file falls
  // outside the window and silently fails to resolve. Nothing leaked either
  // way; the containment check is what makes it safe, this is what makes it
  // work on a populated database.
  const [guessing, rootOwnerId] = await Promise.all([
    rootHasProjectFile(rootId).then((has) => !has),
    prisma.item
      .findUnique({ where: { id: rootId }, select: { ownerId: true } })
      .then((root) => root?.ownerId ?? null),
  ])
  const readText = createTextReader()
  const readFolder = createFolderReader()

  // Normalized and deduped up front, so every pass below works on distinct
  // paths and the batch resolver sees the whole set at once.
  const wanted: string[] = []
  const seen = new Set<string>()
  for (const logical of logicalPaths.slice(0, MAX_FILES_PER_REQUEST)) {
    const normalized = normalize(logical)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    wanted.push(normalized)
  }

  const exact = await resolveBatch(rootId, wanted, readText)

  const out: SourceFile[] = []
  /** Paths nothing could resolve on the first pass, retried against `hints`. */
  const pending: string[] = []
  const hints = new Map<string, string | null>()
  let suffixLookups = 0

  for (const normalized of wanted) {
    const resolved = exact.get(normalized)
    if (resolved) {
      out.push({ ...resolved, requested: normalized })
      continue
    }
    // No owner on the root means the row vanished under us; searching by name
    // with nothing to scope it is the one thing worse than not resolving.
    if (!guessing || !rootOwnerId) continue
    if (suffixLookups < MAX_SUFFIX_LOOKUPS) {
      suffixLookups++
      const fallback = await resolveByNameSuffix(
        rootId,
        rootOwnerId,
        normalized,
        readText,
        readFolder
      )
      if (fallback) {
        learnPrefix(hints, normalized, fallback.path)
        out.push({ ...fallback, requested: normalized })
        continue
      }
    }
    pending.push(normalized)
  }

  // Second pass. A name that appears in several folders is undecidable on its
  // own — `services/auth` matches `.server/auth.ts`, `.client/auth.ts` and two
  // more — but it isn't undecidable in context: if `services/db` already
  // resolved to `.server/db.ts` in this same request, then `services` demonstrably
  // means `.server` here, and the ambiguity collapses to one exact lookup. Only
  // prefixes proven by an unambiguous hit are used, so this widens what
  // resolves without widening what we're willing to guess.
  const retries: Array<{ requested: string; hinted: string }> = []
  for (const normalized of pending) {
    const hinted = applyPrefixHint(hints, normalized)
    if (hinted) retries.push({ requested: normalized, hinted })
  }
  if (retries.length) {
    const rehomed = await resolveBatch(
      rootId,
      retries.map((r) => r.hinted),
      readText
    )
    for (const { requested, hinted } of retries) {
      const resolved = rehomed.get(hinted)
      if (resolved) out.push({ ...resolved, requested })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Batched resolution
//
// Everything below answers a whole set of logical paths at once. The shape it
// replaced resolved one path at a time: `candidatesFor` yields up to fourteen
// candidates (seven extensions × the `x.ts` and `x/index.ts` shapes), and each
// was walked segment by segment with a `findFirst` per folder. A four-segment
// path was up to fifty-six sequential round-trips, a batch of twenty-five well
// over a thousand — which is what made a single batch take ~6.5s, with the
// S3 reads serialized behind it on top.
// ---------------------------------------------------------------------------

/** Reads a file's text, at most once per storage object per request. */
type TextReader = (bucket: string, key: string) => Promise<string | null>
/** Reads a folder row, at most once per id per request. */
type FolderReader = (
  id: string
) => Promise<{ name: string; parentId: string | null } | null>

/** A file that exists at a candidate path, before its text has been read. */
type CandidateFile = {
  path: string
  id: string
  parentId: string | null
  bucket: string
  key: string
}

/**
 * Two logical paths can land on the same file — `services/quota-actions` and a
 * relative import both resolving to `.server/quota-actions.ts` — and a single
 * path offers the same candidate to several shapes. Reading through this makes
 * each storage object one GET no matter how many times it's asked for.
 */
function createTextReader(): TextReader {
  const cache = new Map<string, Promise<string | null>>()
  return (bucket, key) => {
    const cacheKey = `${bucket} ${key}`
    let text = cache.get(cacheKey)
    if (!text) {
      text = getObjectText(bucket, key).catch(() => null)
      cache.set(cacheKey, text)
    }
    return text
  }
}

/** Same idea for the ancestor walks in `pathUnderRoot`, which retread folders. */
function createFolderReader(): FolderReader {
  const cache = new Map<
    string,
    Promise<{ name: string; parentId: string | null } | null>
  >()
  return (id) => {
    let folder = cache.get(id)
    if (!folder) {
      folder = prisma.item.findUnique({
        where: { id },
        select: { name: true, parentId: true },
      })
      cache.set(id, folder)
    }
    return folder
  }
}

/**
 * Resolve logical paths to files, TypeScript's extension/`index` order deciding
 * between candidates. One query per tree level to place the directories, one
 * more for every candidate file in them, then the texts in parallel.
 */
async function resolveBatch(
  rootId: string,
  logicalPaths: string[],
  readText: TextReader
): Promise<Map<string, Omit<SourceFile, 'requested'>>> {
  const out = new Map<string, Omit<SourceFile, 'requested'>>()
  if (!logicalPaths.length) return out

  const dirIds = await resolveDirs(rootId, logicalPaths)
  const candidates = await findCandidateFiles(dirIds, logicalPaths)

  await Promise.all(
    logicalPaths.map(async (logical) => {
      for (const candidate of candidatesFor(logical)) {
        const hit = candidates.get(candidate)
        if (!hit) continue
        // A candidate whose object can't be read falls through to the next one,
        // the way the per-candidate loop this replaced did.
        const text = await readText(hit.bucket, hit.key)
        if (text == null) continue
        out.set(logical, {
          path: hit.path,
          text,
          id: hit.id,
          parentId: hit.parentId,
        })
        return
      }
    })
  )
  return out
}

/**
 * Map every directory the batch needs onto its folder id, a level at a time.
 * Paths share prefixes heavily (`app/components/ui`, `app/components/views`),
 * so a breadth-first descent visits each folder once for the whole batch
 * instead of once per candidate per path.
 */
async function resolveDirs(
  rootId: string,
  logicalPaths: string[]
): Promise<Map<string, string>> {
  const ids = new Map<string, string>([['', rootId]])
  /** Every directory prefix the batch needs, grouped by depth. */
  const byDepth: Array<Set<string>> = []
  for (const logical of logicalPaths) {
    // Candidates live either beside the path (`x/y.ts`) or under it
    // (`x/y/index.ts`), so both directories have to be placed.
    for (const dir of [dirOfPath(logical), logical]) {
      if (!dir) continue
      const segments = dir.split('/')
      for (let depth = 0; depth < segments.length; depth++) {
        const at = (byDepth[depth] ??= new Set<string>())
        at.add(segments.slice(0, depth + 1).join('/'))
      }
    }
  }

  for (const level of byDepth) {
    // A directory whose parent didn't resolve can't resolve either.
    const paths = [...(level ?? [])].filter((p) => ids.has(dirOfPath(p)))
    if (!paths.length) continue
    const folders = await prisma.item.findMany({
      where: {
        type: 'folder',
        parentId: { in: [...new Set(paths.map((p) => ids.get(dirOfPath(p))!))] },
        name: { in: [...new Set(paths.map(baseOfPath))] },
      },
      select: { id: true, name: true, parentId: true },
    })
    // The two `in`s match a superset — the same folder name under an unrelated
    // parent — so pair them back up by (parent, name) rather than by name.
    const byParent = new Map<string, Map<string, string>>()
    for (const folder of folders) {
      if (!folder.parentId) continue
      const named = byParent.get(folder.parentId) ?? new Map<string, string>()
      named.set(folder.name, folder.id)
      byParent.set(folder.parentId, named)
    }
    for (const path of paths) {
      const parentId = ids.get(dirOfPath(path))!
      const id = byParent.get(parentId)?.get(baseOfPath(path))
      if (id) ids.set(path, id)
    }
  }
  return ids
}

/**
 * Every candidate file the batch could want, in one query, keyed by the
 * candidate path that would name it.
 */
async function findCandidateFiles(
  dirIds: Map<string, string>,
  logicalPaths: string[]
): Promise<Map<string, CandidateFile>> {
  const out = new Map<string, CandidateFile>()
  /** Folder id → the candidate directory it stands for, to rebuild paths. */
  const dirOfId = new Map<string, string>()
  const names = new Set<string>()
  for (const logical of logicalPaths) {
    for (const candidate of candidatesFor(logical)) {
      const id = dirIds.get(dirOfPath(candidate))
      if (!id) continue
      dirOfId.set(id, dirOfPath(candidate))
      names.add(baseOfPath(candidate))
    }
  }
  if (!dirOfId.size) return out

  const files = await prisma.item.findMany({
    where: {
      type: 'file',
      parentId: { in: [...dirOfId.keys()] },
      name: { in: [...names] },
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      file: { select: { bucket: true, key: true } },
    },
  })
  for (const item of files) {
    if (!item.file || !item.parentId) continue
    const dir = dirOfId.get(item.parentId)
    if (dir === undefined) continue
    out.set(dir ? `${dir}/${item.name}` : item.name, {
      path: dir ? `${dir}/${item.name}` : item.name,
      id: item.id,
      parentId: item.parentId,
      bucket: item.file.bucket,
      key: item.file.key,
    })
  }
  return out
}

/**
 * Record what an alias segment turned out to mean: `services/db` answered by
 * `.server/db.ts` proves `services` → `.server`. A segment that resolves two
 * different ways is poisoned (`null`) rather than picked between.
 */
function learnPrefix(
  hints: Map<string, string | null>,
  requested: string,
  realPath: string
): void {
  const asked = requested.split('/')
  if (asked.length < 2) return
  const real = logicalOfPath(realPath).split('/')
  // Everything above the part of the path the request actually named.
  const keep = real.length - (asked.length - 1)
  if (keep < 1) return
  const prefix = real.slice(0, keep).join('/')
  if (prefix === asked[0]) return // the guess was right; nothing to learn
  const known = hints.get(asked[0])
  hints.set(asked[0], known === undefined || known === prefix ? prefix : null)
}

/** Rewrite a logical path's first segment through a proven prefix, if any. */
function applyPrefixHint(
  hints: Map<string, string | null>,
  requested: string
): string | null {
  const [head, ...rest] = requested.split('/')
  const prefix = hints.get(head)
  if (!prefix || !rest.length) return null
  return [prefix, ...rest].join('/')
}

/** A real path back to the logical path that resolves to it. */
function logicalOfPath(path: string): string {
  return path.replace(/\.(d\.ts|[mc]?[jt]sx?)$/, '').replace(/\/index$/, '')
}

/** Does this root hold a `tsconfig.json`/`jsconfig.json` of its own? */
async function rootHasProjectFile(rootId: string): Promise<boolean> {
  const config = await prisma.item.findFirst({
    where: { parentId: rootId, type: 'file', name: { in: PROJECT_FILES } },
    select: { id: true },
  })
  return config !== null
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/** Candidate real paths for a logical path, mirroring TS's extension search. */
function candidatesFor(logical: string): string[] {
  // An ESM-style `./x.js` specifier standing for a `./x.ts` source. TypeScript
  // rewrites the extension when it resolves, and generated code leans on that
  // hard — the Prisma client reaches its own `PrismaClient` through
  // `import * as $Class from './internal/class.js'`. Taking `.js` literally
  // meant that import found nothing and every type behind it collapsed to
  // `any`. Try the literal file first (it may really be JavaScript), then the
  // sources it stands in for.
  const js = logical.match(/\.([mc]?)js(x?)$/)
  if (js) {
    const stem = logical.slice(0, logical.length - js[0].length)
    return [logical, `${stem}.${js[1]}ts${js[2]}`, `${stem}.d.${js[1]}ts`]
  }
  if (/\.[mc]?tsx?$/.test(logical) || logical.endsWith('.d.ts')) {
    return [logical]
  }
  return [
    ...RESOLVE_EXTS.map((ext) => `${logical}${ext}`),
    ...RESOLVE_EXTS.map((ext) => `${logical}/index${ext}`),
  ]
}

/**
 * Last-resort resolution for a project that shipped no tsconfig: find the file
 * by the *tail* of its logical path instead of its full path.
 *
 * Without a tsconfig the alias map is synthesized, and a synthesized map can
 * only assume an alias names the folder it points at. That holds for
 * `@/utils/*` → `utils/*` and breaks for every alias that was renamed on the
 * way — `@/ui/button` is really `components/ui/button`, `@/services/db` is
 * really `.server/db`. The tail is still right in both cases, so we search for
 * a file whose *name* matches and whose enclosing folders end with the logical
 * path's own directories, anywhere under the root.
 *
 * The risk is ambiguity, not cost: two folders both ending in `ui/` make the
 * alias genuinely undecidable, so a split verdict resolves nothing rather than
 * hand the viewer a plausible-looking wrong file. Only the extension is allowed
 * to be ambiguous, and TypeScript's own order breaks that tie.
 */
async function resolveByNameSuffix(
  rootId: string,
  rootOwnerId: string,
  logical: string,
  readText: TextReader,
  readFolder: FolderReader
): Promise<Omit<SourceFile, 'requested'> | null> {
  const segments = logical.split('/').filter(Boolean)
  const base = segments[segments.length - 1]
  if (!base) return null

  // The two shapes `candidatesFor` tries, as (folders, filenames) pairs:
  // `…/<base>.<ext>`, then `…/<base>/index.<ext>`.
  const shapes = [
    {
      dirs: segments.slice(0, -1),
      names: RESOLVE_EXTS.map((ext) => `${base}${ext}`),
    },
    { dirs: segments, names: RESOLVE_EXTS.map((ext) => `index${ext}`) },
    // Last resort: the filename alone, anywhere under the root. This is what
    // catches an alias whose folder was *renamed* rather than nested —
    // `@/services/db` is `.server/db.ts`, so even the tail folder is wrong.
    // Only a drive-wide unique match survives the ambiguity check below, which
    // is what keeps it honest: a second `db.ts` anywhere and we resolve nothing.
    ...(segments.length > 1
      ? [
          {
            dirs: [] as string[],
            names: RESOLVE_EXTS.map((ext) => `${base}${ext}`),
          },
        ]
      : []),
  ]

  for (const shape of shapes) {
    const parentName = shape.dirs[shape.dirs.length - 1]
    const hits = await prisma.item.findMany({
      where: {
        type: 'file',
        name: { in: shape.names },
        // Scoped to the root's owner so `take` is spent on files that could
        // plausibly be under this root. `pathUnderRoot` below is what actually
        // enforces containment — this keeps the window from being consumed by
        // rows that were never going to survive it.
        ownerId: rootOwnerId,
        // Pin the immediate folder when the logical path names one. Without it
        // a bare `index.ts` search sweeps the whole drive.
        ...(parentName ? { parent: { name: parentName } } : {}),
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        file: { select: { bucket: true, key: true } },
      },
      take: MAX_NAME_HITS,
    })

    // Flattened rather than kept as the row: `file` is optional on the select,
    // and narrowing it here keeps the storage keys non-null downstream.
    const matches: Array<{
      id: string
      parentId: string | null
      name: string
      bucket: string
      key: string
      path: string
    }> = []
    for (const hit of hits) {
      if (!hit.file) continue
      const path = await pathUnderRoot(
        rootId,
        hit.parentId,
        shape.dirs,
        hit.name,
        readFolder
      )
      if (!path) continue
      matches.push({
        id: hit.id,
        parentId: hit.parentId,
        name: hit.name,
        bucket: hit.file.bucket,
        key: hit.file.key,
        path,
      })
    }
    const folders = new Set(matches.map((m) => dirOfPath(m.path)))
    if (folders.size !== 1) continue

    // Same folder, several extensions — TypeScript's own order breaks the tie.
    matches.sort(
      (a, b) => shape.names.indexOf(a.name) - shape.names.indexOf(b.name)
    )
    const best = matches[0]
    const text = await readText(best.bucket, best.key)
    if (text == null) continue
    return { path: best.path, text, id: best.id, parentId: best.parentId }
  }
  return null
}

/**
 * Path of `<parentId>/<fileName>` relative to `rootId`, but only if the folders
 * directly above the file end with `dirs` — otherwise the name matched in an
 * unrelated part of the tree and this is not the file the import meant.
 * Returns `null` for anything outside the root.
 */
async function pathUnderRoot(
  rootId: string,
  parentId: string | null,
  dirs: string[],
  fileName: string,
  readFolder: FolderReader
): Promise<string | null> {
  const above: string[] = []
  let current = parentId
  for (let i = 0; i < MAX_ANCESTOR_WALK && current && current !== rootId; i++) {
    const folder = await readFolder(current)
    if (!folder) return null
    above.unshift(folder.name)
    current = folder.parentId
  }
  if (current !== rootId) return null
  const tail = above.slice(above.length - dirs.length)
  if (dirs.length && tail.join('/') !== dirs.join('/')) return null
  return [...above, fileName].join('/')
}

/** Folder part of a `/`-separated path (`a/b/c.ts` → `a/b`). */
function dirOfPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

/** Last segment of a `/`-separated path (`a/b/c.ts` → `c.ts`). */
function baseOfPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
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
