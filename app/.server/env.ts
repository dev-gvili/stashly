/**
 * Loads `.env` into `process.env`, once, when this module is first imported.
 *
 * Server modules that read configuration at import time (`db.ts`, `stripe.ts`)
 * import this first. That is what gives the dev server, a local `pnpm start`
 * and Vitest their `.env`; production has no file (it is excluded from the
 * image) and reads real environment variables.
 *
 * This used to be `@dotenvx/dotenvx`. Importing it ran hardware probes
 * (`systeminformation`, including a shell command on Windows) and cost
 * 597–709 ms per fresh process, against 0.6–1.1 ms for Node's own loader
 * (measured 2026-10-09, tech-debt item 24). This `.env` uses none of the
 * dotenvx features Node lacks: no encrypted values, no `${…}` expansion.
 *
 * Variables already set win over the file, so real environment variables
 * (Fly secrets, CI) are never replaced by a stray `.env`.
 */

/**
 * Loads `path` into `process.env` if it exists. A missing file is not an
 * error; any other failure (unreadable file, bad syntax) is.
 *
 * @param path - The file to load (default `.env` in the working directory).
 * @returns Whether a file was loaded.
 *
 * @example
 * loadDotEnv() // .env in the working directory, if there is one
 */
export function loadDotEnv(path = '.env'): boolean {
  try {
    process.loadEnvFile(path)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

loadDotEnv()
