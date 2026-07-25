/**
 * Automatic Type Acquisition for the read-only code viewer.
 *
 * Out of the box, `import { useState } from 'react'` hovers as `any` — the
 * viewer holds one file with no `node_modules`. This wires up `@typescript/ata`
 * (the same acquirer that powers the TypeScript Playground) to download the
 * `.d.ts` for a file's imported packages from jsdelivr and hand them to
 * Monaco's TypeScript service via `addExtraLib`, so those imports resolve to
 * their real types.
 *
 * ── Privacy ──────────────────────────────────────────────────────────────
 * ATA makes outbound requests to jsdelivr derived from the *import statements*
 * in whatever file a user opens — package names, never file contents, leave the
 * app. It is the one network dependency in an otherwise self-contained viewer.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────
 * ATA parses imports with the real `typescript` module, so both it and TS are
 * dynamic-imported the first time a TS/JS file is opened, and never for a user
 * who only views other file types.
 */
import * as monaco from 'monaco-editor'

/** Registered lib paths — dedups across files, and across ATA re-runs. */
const addedLibs = new Set<string>()

let ataRunner: ((source: string) => Promise<void>) | null = null
let ataSetup: Promise<void> | null = null

/** Lazily construct the ATA runner (loads `@typescript/ata` + `typescript`). */
function ensureAta(): Promise<void> {
  if (!ataSetup) {
    ataSetup = (async () => {
      const [{ setupTypeAcquisition }, tsModule] = await Promise.all([
        import('@typescript/ata'),
        import('typescript'),
      ])
      // typescript ships CJS; the namespace's `default` is the ts object.
      const typescript = (tsModule as { default?: typeof import('typescript') })
        .default ?? (tsModule as unknown as typeof import('typescript'))

      ataRunner = setupTypeAcquisition({
        projectName: 'stashly-code-viewer',
        typescript,
        fetcher: aliasAwareFetch,
        delegate: {
          receivedFile: (code, path) => addExtraLib(code, path),
          errorMessage: (message, error) =>
            console.error('[ata]', message, error),
        },
      })
    })()
  }
  return ataSetup
}

/**
 * ATA's import parser can't tell an npm package from an app path alias, so it
 * tries to fetch `@/utils`, `@/types`, `@/hooks` (and any bare specifier) from
 * jsdelivr — the `@/…` ones 400 because an empty scope is not a real package.
 * Short-circuit those to a synthetic 404 so ATA moves on without a network
 * round-trip or a console error. Aliases are internal modules; resolving them
 * is the job of cross-file acquisition, not npm.
 */
const aliasAwareFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (/\/npm\/@(?:%40)?\//.test(url)) {
    return Promise.resolve(new Response('', { status: 404 }))
  }
  return fetch(input, init)
}

/**
 * Register one declaration file with both the TS and JS language services.
 *
 * ATA hands paths like `/node_modules/@types/react/index.d.ts`; prefixing
 * `file://` yields the virtual `file:///node_modules/…` path TS resolves
 * against, so `import 'react'` finds it exactly as it would on disk.
 */
function addExtraLib(code: string, path: string): void {
  const uri = `file://${path}`
  if (addedLibs.has(uri)) return
  addedLibs.add(uri)
  const ts = monaco.typescript
  ts.typescriptDefaults.addExtraLib(code, uri)
  ts.javascriptDefaults.addExtraLib(code, uri)
}

/**
 * Acquire types for the packages imported by `source`. Fire-and-forget: as
 * libs land, Monaco re-syncs its worker and hovers pick the types up. Safe to
 * call for every opened TS/JS file — ATA dedups, and so do we.
 */
export async function acquireTypesForSource(source: string): Promise<void> {
  try {
    await ensureAta()
    await ataRunner?.(source)
  } catch (err) {
    console.error('[ata] type acquisition failed', err)
  }
}
