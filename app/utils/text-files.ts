/**
 * Text-file classification — which uploads carry text we can read.
 *
 * Split out of `@/utils/text-thumbnail` because the same question is asked on
 * both sides of the wire: the browser asks it to decide whether to read a
 * file's body for the search index, and `@/services/search-actions` asks it to
 * decide which already-uploaded items the re-index tool should repair. The
 * server must not have to import an OffscreenCanvas renderer to find out.
 *
 * Keeping one list is the point — code files were renderable as thumbnails but
 * invisible to search precisely because the two subsystems answered "is this
 * text?" from different predicates.
 */

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

/**
 * Extensions rendered in a monospace face (code, scripts, config, data).
 * Everything else that passes `isTextRenderableFile` renders sans-serif
 * (prose: .txt, markdown, …). Many of these arrive as `text/plain` or
 * `application/octet-stream`, so extension wins over mime for font choice.
 */
export const MONO_EXTENSIONS = new Set([
  // web
  'html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml',
  'mjs', 'cjs', 'mts', 'cts', 'vue', 'svelte', 'astro', 'prisma',
  // backend / system
  'java', 'c', 'cpp', 'h', 'cs', 'php', 'py', 'rb', 'go', 'rs', 'swift', 'kt', 'dart',
  // scripts
  'ps1', 'psm1', 'psd1', 'sh', 'bat', 'cmd', 'zsh', 'bash',
  // config / data
  'yaml', 'yml', 'toml', 'ini', 'sql', 'graphql', 'env', 'gitignore',
  'csv', 'tsv', 'log', 'dockerfile', 'makefile',
])

export const PROSE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'mdown', 'mkd', 'text',
])

/**
 * Every extension whose bytes are text, as a flat array.
 *
 * Exported for the re-index candidate SQL, which can only match on the stored
 * name (`lower(i."name") LIKE ANY (…)`) — it has no `File` to hand to
 * `isTextRenderableFile`. Bare filenames like `Dockerfile` are in here as
 * "extensions" so the same `%suffix` match catches them too.
 */
export const TEXT_EXTENSIONS: readonly string[] = [
  ...MONO_EXTENSIONS,
  ...PROSE_EXTENSIONS,
]

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  // No dot → the whole name may be a known bare filename (Dockerfile, Makefile).
  return (dot === -1 ? name : name.slice(dot + 1)).toLowerCase()
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** True for files whose content is text we can screenshot into a thumbnail. */
export function isTextRenderableFile(file: { name: string; type?: string }): boolean {
  const ext = fileExtension(file.name)
  if (MONO_EXTENSIONS.has(ext) || PROSE_EXTENSIONS.has(ext)) return true
  const type = file.type ?? ''
  if (type.startsWith('text/')) return true
  return /\b(json|xml|javascript|typescript|yaml|sql)\b/.test(type)
}

/** True when the file renders monospaced (code/config/data vs prose). */
export function isMonoFile(file: { name: string; type?: string }): boolean {
  const ext = fileExtension(file.name)
  if (MONO_EXTENSIONS.has(ext)) return true
  if (PROSE_EXTENSIONS.has(ext)) return false
  // Unknown extension with a code-ish mime → monospace; plain text → prose.
  const type = file.type ?? ''
  return /\b(json|xml|javascript|typescript|yaml|sql|html|css)\b/.test(type)
}

// ---------------------------------------------------------------------------
// Search indexing
// ---------------------------------------------------------------------------

/**
 * Machine-written text that is technically indexable and never worth reading.
 *
 * A `package-lock.json` is 20k lines of hashes: it would out-chunk every real
 * source file in the drive and match nothing a person would ever type. Excluded
 * by name rather than by size — a large hand-written file is still worth
 * indexing, and a small lockfile still isn't.
 */
export const TEXT_NOISE_NAMES: readonly string[] = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'composer.lock',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  'bun.lock',
]

/**
 * Minified bundles and sourcemaps: text, but not prose anyone searches for.
 *
 * Kept as suffix strings rather than only a regex because the re-index
 * candidate SQL has to express the same exclusion as `NOT LIKE ALL (…)`. If
 * these two ever disagree, a lockfile is selected as a candidate and then
 * refused by `reindexTextItem` — it would sit at the head of the queue forever
 * and no real document behind it would ever be rebuilt.
 */
export const TEXT_NOISE_SUFFIXES: readonly string[] = [
  '.min.js',
  '.min.css',
  '.js.map',
  '.css.map',
]

const NOISE_NAMES = new Set(TEXT_NOISE_NAMES)

/**
 * Upper bound on how much of one file's body reaches `Search.content`.
 *
 * At `CHUNK_CHARS = 1500` this is ~350 passages for a single item, which is
 * already far past any hand-written source file. The cap exists so one stray
 * generated artifact can't flood `SearchChunk` and dominate the dense ranker's
 * `CHUNK_SCAN_DEPTH` nearest neighbours.
 */
export const MAX_INDEXED_TEXT_CHARS = 512 * 1024

/**
 * True when a file's body should be read into the search index.
 *
 * Markdown is deliberately *included* — callers that have a richer markdown
 * path (frontmatter, headings, the `Markdown` facet) test for that first and
 * only fall through to here for everything else.
 *
 * @example
 * isIndexableTextFile({ name: 'converters.ts', type: '' })       // true
 * isIndexableTextFile({ name: 'package-lock.json', type: '' })   // false
 * isIndexableTextFile({ name: 'photo.jpg', type: 'image/jpeg' }) // false
 */
export function isIndexableTextFile(file: { name: string; type?: string }): boolean {
  if (!isTextRenderableFile(file)) return false
  const lower = file.name.toLowerCase()
  if (NOISE_NAMES.has(lower)) return false
  return !TEXT_NOISE_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

/** Name-only form of `isIndexableTextFile`, for server code holding a row. */
export function isIndexableTextName(
  name: string | null | undefined,
  mimeType?: string | null,
): boolean {
  if (!name) return false
  return isIndexableTextFile({ name, type: mimeType ?? '' })
}
