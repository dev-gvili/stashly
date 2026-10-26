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

/**
 * The secret that signs Stashly's own cookies (`color-scheme`, `last-account`).
 *
 * Production refuses to start without `SESSION_SECRET`: callers read it when
 * their module loads, so a deploy that misses the secret fails at boot rather
 * than signing every cookie with a value anyone can read in the source
 * (tech-debt item 30). Elsewhere a missing secret falls back to a fixed,
 * clearly named dev value.
 *
 * @param env - The environment to read (default `process.env`).
 * @returns The signing secret.
 * @throws When `NODE_ENV` is `production` and `SESSION_SECRET` is unset.
 *
 * @example
 * createCookie('color-scheme', { secrets: [cookieSecret()] })
 */
export function cookieSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set; it signs the app’s cookies and is required in production')
  }
  return 'stashly-dev-only-cookie-secret'
}
