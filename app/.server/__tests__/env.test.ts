import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { cookieSecret, loadDotEnv } from '../env'

/**
 * `loadDotEnv` replaced `@dotenvx/dotenvx` as the `.env` loader for the server
 * (tech-debt item 24). These pin the three behaviours the app relies on.
 */
const dir = mkdtempSync(path.join(tmpdir(), 'stashly-env-'))
const KEYS = ['STASHLY_ENV_TEST_A', 'STASHLY_ENV_TEST_B', 'STASHLY_ENV_TEST_Q']

function envFile(contents: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}.env`)
  writeFileSync(file, contents)
  return file
}

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadDotEnv', () => {
  it('loads the file’s variables, including quoted values', () => {
    const loaded = loadDotEnv(envFile('STASHLY_ENV_TEST_A=one\nSTASHLY_ENV_TEST_Q="two words"\n'))
    expect(loaded).toBe(true)
    expect(process.env.STASHLY_ENV_TEST_A).toBe('one')
    expect(process.env.STASHLY_ENV_TEST_Q).toBe('two words')
  })

  // Real environment variables (Fly secrets, CI) must never be replaced by a
  // stray .env.
  it('leaves a variable that is already set alone', () => {
    process.env.STASHLY_ENV_TEST_A = 'from the environment'
    loadDotEnv(envFile('STASHLY_ENV_TEST_A=from_file\nSTASHLY_ENV_TEST_B=from_file\n'))
    expect(process.env.STASHLY_ENV_TEST_A).toBe('from the environment')
    expect(process.env.STASHLY_ENV_TEST_B).toBe('from_file')
  })

  // Production has no .env: it is excluded from the image.
  it('treats a missing file as nothing to load', () => {
    expect(loadDotEnv(path.join(dir, 'does-not-exist.env'))).toBe(false)
  })
})

// Tech-debt item 30: both signed cookies used to fall back to 'secret',
// production included.
describe('cookieSecret', () => {
  it('returns SESSION_SECRET when it is set', () => {
    expect(cookieSecret({ NODE_ENV: 'production', SESSION_SECRET: 's3cret' })).toBe('s3cret')
  })

  it('refuses to run in production without SESSION_SECRET', () => {
    expect(() => cookieSecret({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
    expect(() => cookieSecret({ NODE_ENV: 'production', SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/)
  })

  it('falls back to a dev-only value outside production', () => {
    expect(cookieSecret({ NODE_ENV: 'development' })).toBe('stashly-dev-only-cookie-secret')
    expect(cookieSecret({})).toBe('stashly-dev-only-cookie-secret')
  })
})
