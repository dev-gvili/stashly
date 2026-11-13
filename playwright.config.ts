import { defineConfig, devices } from '@playwright/test'
import { E2E_WORKERS } from './tests/e2e/constants'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  // Each worker signs in as its own seeded user (tests/e2e/constants.ts,
  // global-setup.ts), so workers share only the database and the dev server and
  // an upload in one file can't land inside another file's quota reading.
  // E2E_WORKERS (default 1) is how many; CI sets it.
  workers: E2E_WORKERS,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost',
    // retries is 0, so 'on-first-retry' never recorded a trace at all.
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // CI serves the production build (the workflow builds it first); local runs
    // use the dev server, or reuse the one already on port 80.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
