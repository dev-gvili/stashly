import './env'
import { getClient, init } from '@vinktarhq/node'

/**
 * Vinktar (product analytics and error tracking) for the server.
 *
 * Configured only from the environment: `VINKTAR_KEY` (the project's public
 * write key), `VINKTAR_RELEASE` (the git SHA of the deploy) and, optionally,
 * `VINKTAR_ENVIRONMENT` (otherwise `NODE_ENV`). Without a key the SDK logs one
 * error and every call is a no-op; it never throws into the app.
 *
 * Off under Vitest: tests load `.env` through `./env`, and every
 * `createUploadedItem` test would otherwise send a real `file_uploaded`.
 *
 * Guarded by `getClient()` because the dev server re-evaluates this module on
 * edits, and the SDK refuses a second `init()` with a warning.
 */
if (!getClient()) {
  init({ enabled: process.env.NODE_ENV !== 'test', captureErrors: true })
}

export { captureException, track } from '@vinktarhq/node'
