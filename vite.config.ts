import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'crypto'
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import {
  defineConfig,
  type Plugin,
  type PluginOption,
  type ViteDevServer,
} from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig(({ command }) => ({
  envDir: '.',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    cors: true,
    allowedHosts: ['*', 'localhost:80', '.ngrok-free.app', '.ngrok-free.dev'],
    host: true,
    // React Router typegen rm -rf's and rewrites these; on Windows a scandir
    // mid-delete yields UNKNOWN (not ENOENT), which chokidar re-emits and
    // Vite doesn't handle — the dev server exits. Types-only, nothing to HMR.
    watch: { ignored: ['**/.react-router/**'] },
  },
  // React Router 8 builds through Vite's Environment API, so the `isSsrBuild`
  // flag is never set and a top-level `build.rollupOptions.input` is ignored for
  // the server bundle. The plugin reads the custom server entry from
  // `environments.ssr` instead; without it, build/server/index.js is the React
  // Router server manifest (no `app` export) and `pnpm start` dies on
  // `app.use(undefined)`.
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: './server/app.ts',
        },
      },
      // Bundle every dependency into the server build (production only).
      // Left external, the server build loaded 1,697 separate files from
      // node_modules on its first request, and 81% of that import was spent
      // resolving and reading them (~2.7 ms per file on Windows): the first
      // page after a start took 4–15 s against ~0.1 s warm. Bundled, it loads
      // 38 files and the first page takes ~1 s (tech-debt item 24, measured
      // 2026-10-09). Dev is unchanged: Vite serves dependencies itself there.
      ...(command === 'build' ? { resolve: { noExternal: true } } : {}),
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  plugins: [
    tailwindcss({
      optimize: {
        minify: true,
      },
    }),
    svgr({
      svgrOptions: {
        typescript: true,
      },
    }),
    reactRouter(),
    // Copy PDF.js assets to public directory
    pdfjsHybridCopyPluginAsync(),
  ] as unknown as PluginOption[],
}))

/* -------------------------
   Shared constants & helpers
   ------------------------- */

const SOURCE_BASE = resolve('node_modules/pdfjs-dist')
const TARGET_BASE = resolve('public')
const FOLDERS_TO_COPY = ['pdfjs_cmaps', 'pdfjs_standard_fonts']
const CACHE_DIR = resolve('node_modules/.vite')

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // ignore
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function walkFilesAsync(
  dir: string,
  cb: (filePath: string) => Promise<void> | void
): Promise<void> {
  if (!(await pathExists(dir))) return
  const items = await readdir(dir)
  for (const item of items) {
    const full = join(dir, item)
    const stData = await stat(full)
    if (stData.isDirectory()) {
      await walkFilesAsync(full, cb)
    } else {
      await cb(full)
    }
  }
}

async function copyMissingFilesAsync(src: string, dest: string): Promise<void> {
  if (!(await pathExists(src))) return
  const items = await readdir(src)
  for (const item of items) {
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    const stat = await lstat(srcPath)
    if (stat.isDirectory()) {
      await ensureDir(destPath)
      await copyMissingFilesAsync(srcPath, destPath)
      continue
    }
    if (!(await pathExists(destPath))) {
      await copyFile(srcPath, destPath)
      console.log(`📄 Copied: ${destPath}`)
    } else {
      console.log(`⏭ Skipped existing: ${destPath}`)
    }
  }
}

async function computeFoldersHashAsync(
  base: string,
  folders: string[]
): Promise<string> {
  const hash = createHash('sha256')
  for (const folder of folders) {
    const folderPath = join(base, folder)
    await walkFilesAsync(folderPath, async (file) => {
      const rel = relative(base, file)
      hash.update(rel)
      const content = await readFile(file)
      hash.update(content)
    })
  }
  return hash.digest('hex')
}

async function loadCachedHashAsync(cacheFile: string): Promise<string | null> {
  if (!(await pathExists(cacheFile))) return null
  try {
    const raw = await readFile(cacheFile, 'utf8')
    return JSON.parse(raw)?.hash ?? null
  } catch {
    return null
  }
}

async function saveHashAsync(cacheFile: string, hash: string): Promise<void> {
  await ensureDir(dirname(cacheFile))
  await writeFile(cacheFile, JSON.stringify({ hash }, null, 2), 'utf8')
}

/* -------------------------
   Plugin 1: Hash-based (async)
   - Re-copies only when source hash changes
   - Copies only missing files (never overwrites)
   ------------------------- */

export function pdfjsHashCopyPluginAsync(): Plugin {
  const cacheFile = join(CACHE_DIR, 'pdfjs-hash-cache.json')
  let running = false

  async function runOnce(): Promise<void> {
    if (running) return
    running = true
    try {
      console.log('🔍 pdfjs-hash-copy (async): starting check')
      await ensureDir(CACHE_DIR)

      const currentHash = await computeFoldersHashAsync(
        SOURCE_BASE,
        FOLDERS_TO_COPY
      )
      const cachedHash = await loadCachedHashAsync(cacheFile)

      if (cachedHash === currentHash) {
        console.log('⏭ Hash unchanged — skipping copy')
        return
      }

      console.log('📦 Hash changed or missing — copying missing files')
      for (const folder of FOLDERS_TO_COPY) {
        const src = join(SOURCE_BASE, folder)
        const dest = join(TARGET_BASE, folder)
        await ensureDir(dest)
        await copyMissingFilesAsync(src, dest)
      }

      await saveHashAsync(cacheFile, currentHash)
      console.log('📝 Cache updated:', cacheFile)
    } catch (err) {
      console.warn('⚠ pdfjs-hash-copy error:', (err as Error).message)
    } finally {
      running = false
    }
  }

  return {
    name: 'pdfjs-hash-copy-async',
    async buildStart() {
      await runOnce()
    },
    async configureServer(_server: ViteDevServer) {
      await runOnce()
    },
  }
}

/* -------------------------
   Plugin 2: Hybrid (async)
   - Uses hash to detect source changes and update cache
   - Always performs a missing-file pass (cheap) so new files are synced
   - Never overwrites existing files
   ------------------------- */

export function pdfjsHybridCopyPluginAsync(): Plugin {
  const cacheFile = join(CACHE_DIR, 'pdfjs-hybrid-cache.json')
  let running = false

  async function runOnce(): Promise<void> {
    if (running) return
    running = true
    try {
      console.log('🔍 pdfjs-hybrid-copy (async): starting check')
      await ensureDir(CACHE_DIR)

      const currentHash = await computeFoldersHashAsync(
        SOURCE_BASE,
        FOLDERS_TO_COPY
      )
      const cachedHash = await loadCachedHashAsync(cacheFile)
      const changed = cachedHash !== currentHash

      if (changed)
        console.log('📦 Source changed — syncing new files (missing only)')
      else console.log('⏭ Hash unchanged — performing missing-file check')

      for (const folder of FOLDERS_TO_COPY) {
        const src = join(SOURCE_BASE, folder)
        const dest = join(TARGET_BASE, folder)
        await ensureDir(dest)
        await copyMissingFilesAsync(src, dest)
      }

      if (changed) {
        await saveHashAsync(cacheFile, currentHash)
        console.log('📝 Cache updated:', cacheFile)
      }

      console.log('✔ pdfjs-hybrid-copy: done')
    } catch (err) {
      console.warn('⚠ pdfjs-hybrid-copy error:', (err as Error).message)
    } finally {
      running = false
    }
  }

  return {
    name: 'pdfjs-hybrid-copy-async',
    async buildStart() {
      await runOnce()
    },
    async configureServer(_server: ViteDevServer) {
      await runOnce()
    },
  }
}
