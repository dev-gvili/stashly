import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Routes never query Prisma directly (CLAUDE.md → Actions pattern). Queries
 * live in `app/.server/*-actions.ts`, next to the access checks, so a route
 * that forgets a check can't fail open. Stands in for the `no-restricted-imports`
 * rule until the repo has a linter (tech-debt items 12 and 23).
 *
 * `Prisma` *types* from `@/prisma/client` are fine; the client instance from
 * `@/services/db` is not.
 */
const ROUTES_DIR = path.resolve(__dirname, '..')

/**
 * Known exceptions, each with its reason. The test also fails when an entry no
 * longer imports the client, so this list can only shrink.
 */
const ALLOWED: Record<string, string> = {
  'workspaces/workspace.tsx':
    'workspace-only page; deferred to TASKS.md Someday per personal-first (2026-10-08)',
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === '+types' ? [] : routeFiles(full)
    }
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

const IMPORTS_DB_CLIENT = /from\s+['"]@\/services\/db['"]/

const offenders = routeFiles(ROUTES_DIR)
  .filter((file) => IMPORTS_DB_CLIENT.test(readFileSync(file, 'utf8')))
  .map((file) => path.relative(ROUTES_DIR, file).split(path.sep).join('/'))
  .sort()

describe('route modules do not import the Prisma client', () => {
  it('only the listed exceptions import @/services/db', () => {
    expect(offenders.filter((f) => !(f in ALLOWED))).toEqual([])
  })

  it('every listed exception still needs its entry', () => {
    expect(Object.keys(ALLOWED).filter((f) => !offenders.includes(f))).toEqual([])
  })
})
