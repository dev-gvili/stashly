# E2E Testing with Playwright — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Playwright E2E tests covering unauthenticated redirects, sign-in page rendering, and authenticated sidebar navigation using session cookie injection.

**Architecture:** Global setup seeds a test user + session via Prisma and writes a `storageState.json` cookie file. Unauthenticated tests import directly from `@playwright/test`; authenticated tests use a custom fixture that loads the cookie file. Page Object Models encapsulate selectors.

**Tech Stack:** `@playwright/test@1.58.2`, `@prisma/adapter-pg`, `@dotenvx/dotenvx`, React Router 7 SSR on Express/Vite port 5173.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `playwright.config.ts` | Create | Playwright config — webServer, globalSetup/Teardown, chromium project |
| `tests/e2e/constants.ts` | Create | Shared test user ID and email constants |
| `tests/e2e/global-setup.ts` | Create | Seed test user + session via Prisma, write storageState cookie file |
| `tests/e2e/global-teardown.ts` | Create | Delete test user (cascades to session) |
| `tests/e2e/fixtures.ts` | Create | Extended `test` that injects storageState for authenticated contexts |
| `tests/e2e/pages/auth.page.ts` | Create | Sign-in page POM |
| `tests/e2e/pages/layout.page.ts` | Create | App shell / sidebar POM |
| `tests/e2e/pages/stash.page.ts` | Create | Stash home POM |
| `tests/e2e/auth.spec.ts` | Create | Unauthenticated flow tests |
| `tests/e2e/navigation.spec.ts` | Create | Authenticated navigation tests |
| `.gitignore` | Modify | Exclude `tests/e2e/.auth/` |
| `package.json` | Modify | Add `test:e2e` script |

---

## Task 1: Scaffold — playwright.config.ts, .gitignore, package.json

**Files:**
- Create: `playwright.config.ts`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
```

- [ ] **Step 2: Add `tests/e2e/.auth/` to `.gitignore`**

Open `.gitignore` and append:

```
# Playwright auth state
tests/e2e/.auth/
playwright-report/
```

- [ ] **Step 3: Add `test:e2e` script to `package.json`**

In the `"scripts"` object, add after `"test:watch"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Install Playwright browser**

```bash
pnpm exec playwright install chromium
```

Expected output: `Chromium X.X.X (playwright build vXXXX) downloaded to ...`

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts .gitignore package.json
git commit -m "chore: scaffold Playwright config and project setup"
```

---

## Task 2: Shared Constants

**Files:**
- Create: `tests/e2e/constants.ts`

- [ ] **Step 1: Create `tests/e2e/constants.ts`**

```typescript
export const TEST_USER_ID = 'usr_e2e_test_fixed_id_000000'
export const TEST_USER_EMAIL = 'e2e-test@stashly.test'
```

These constants are used by both global-setup/teardown and test specs to share a single stable test user identity.

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/constants.ts
git commit -m "test: add shared E2E test constants"
```

---

## Task 3: Global Setup + Teardown

**Files:**
- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/global-teardown.ts`

> Note: These files use **relative imports** (not path aliases) because Playwright's esbuild compilation for globalSetup does not apply tsconfig `paths`. `../../app/prisma/client` resolves correctly from `tests/e2e/`.

- [ ] **Step 1: Create `tests/e2e/global-setup.ts`**

```typescript
import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { TEST_USER_ID, TEST_USER_EMAIL } from './constants'

export default async function globalSetup() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Ensure a free storage plan exists — layout loader requires it
    const freePlan = await prisma.storagePlan.findFirst({ where: { type: 'free' } })
    if (!freePlan) {
      throw new Error(
        '[E2E] No free storage plan found in database. Run `pnpm prisma migrate dev` and seed storage plans first.'
      )
    }

    // Upsert test user — idempotent, safe to re-run
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: {
        id: TEST_USER_ID,
        name: 'E2E Test User',
        email: TEST_USER_EMAIL,
        emailVerified: true,
        bucket: 'e2e-bucket',
        storagePlanId: freePlan.id,
      },
      update: {},
    })

    // Fresh session every run
    await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } })

    const token = crypto.randomUUID()
    await prisma.session.create({
      data: {
        id: `ses_e2e_test_fixed_id_00000`,
        token,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Write Playwright storageState — better-auth reads `better-auth.session_token` cookie
    // and looks up the session by token field in the DB (no hashing)
    const authDir = path.join(process.cwd(), 'tests/e2e/.auth')
    await mkdir(authDir, { recursive: true })
    await writeFile(
      path.join(authDir, 'session.json'),
      JSON.stringify(
        {
          cookies: [
            {
              name: 'better-auth.session_token',
              value: token,
              domain: 'localhost',
              path: '/',
              httpOnly: true,
              secure: false,
              sameSite: 'Lax',
            },
          ],
          origins: [],
        },
        null,
        2,
      ),
    )

    console.log('[E2E] Global setup complete — test user seeded, session written')
  } finally {
    await prisma.$disconnect()
  }
}
```

- [ ] **Step 2: Create `tests/e2e/global-teardown.ts`**

```typescript
import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { TEST_USER_EMAIL } from './constants'

export default async function globalTeardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } })
    console.log('[E2E] Global teardown complete — test user deleted')
  } finally {
    await prisma.$disconnect()
  }
}
```

The `deleteMany` on `user` cascades to `session` via the `onDelete: Cascade` relation defined in `prisma/models/session.prisma`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/global-setup.ts tests/e2e/global-teardown.ts
git commit -m "test: add E2E global setup and teardown"
```

---

## Task 4: Fixtures

**Files:**
- Create: `tests/e2e/fixtures.ts`

- [ ] **Step 1: Create `tests/e2e/fixtures.ts`**

```typescript
import { test as base } from '@playwright/test'
import path from 'path'

/**
 * Use this `test` in authenticated specs (navigation.spec.ts).
 * It overrides the `page` fixture with a context that has the test user's session cookie.
 * For unauthenticated specs (auth.spec.ts), import `test` from `@playwright/test` directly.
 */
export const test = base.extend({
  page: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(process.cwd(), 'tests/e2e/.auth/session.json'),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/fixtures.ts
git commit -m "test: add authenticated page fixture"
```

---

## Task 5: Page Object Models

**Files:**
- Create: `tests/e2e/pages/auth.page.ts`
- Create: `tests/e2e/pages/layout.page.ts`
- Create: `tests/e2e/pages/stash.page.ts`

- [ ] **Step 1: Create `tests/e2e/pages/auth.page.ts`**

```typescript
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class AuthPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/auth/sign-in')
  }

  async expectVisible() {
    await expect(
      this.page.getByRole('heading', { name: 'Welcome back' })
    ).toBeVisible()
    await expect(
      this.page.getByRole('button', { name: 'Login with Github' })
    ).toBeVisible()
    await expect(
      this.page.getByRole('button', { name: 'Login with Google' })
    ).toBeVisible()
    await expect(
      this.page.getByRole('button', { name: 'Login with Microsoft' })
    ).toBeVisible()
  }
}
```

- [ ] **Step 2: Create `tests/e2e/pages/layout.page.ts`**

The sidebar renders with `data-sidebar="sidebar"` (from `app/components/ui/sidebar.tsx:303`). Nav items are React Router `NavLink` elements which receive `aria-current="page"` when active.

```typescript
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class LayoutPage {
  constructor(private readonly page: Page) {}

  async expectSidebarVisible() {
    await expect(this.page.locator('[data-sidebar="sidebar"]').first()).toBeVisible()
  }

  async clickNavItem(label: string) {
    await this.page.getByRole('link', { name: label, exact: true }).click()
  }

  async expectActiveNavItem(label: string) {
    await expect(
      this.page.getByRole('link', { name: label, exact: true })
    ).toHaveAttribute('aria-current', 'page')
  }
}
```

- [ ] **Step 3: Create `tests/e2e/pages/stash.page.ts`**

```typescript
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class StashPage {
  constructor(private readonly page: Page) {}

  async goto(userId: string) {
    await this.page.goto(`/${userId}/stash`)
  }

  async expectLoaded() {
    // Not redirected to sign-in and sidebar is present
    await expect(this.page).not.toHaveURL('/auth/sign-in')
    await expect(this.page.locator('[data-sidebar="sidebar"]').first()).toBeVisible()
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/pages/
git commit -m "test: add AuthPage, LayoutPage, StashPage POMs"
```

---

## Task 6: Unauthenticated Tests (auth.spec.ts)

**Files:**
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Create `tests/e2e/auth.spec.ts`**

These tests use `@playwright/test` directly (no storageState — fresh unauthenticated context).

Note: `/` is wrapped by `layout.tsx` which redirects unauthenticated users to `/auth/sign-in` before the index loader runs. The index loader itself only redirects *authenticated* users onward to stash.

```typescript
import { test, expect } from '@playwright/test'
import { AuthPage } from './pages/auth.page'
import { TEST_USER_ID } from './constants'

test.describe('Unauthenticated flows', () => {
  test('visiting / redirects to sign-in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/auth/sign-in')
  })

  test('visiting /:me/stash without a session redirects to sign-in', async ({ page }) => {
    await page.goto(`/${TEST_USER_ID}/stash`)
    await expect(page).toHaveURL('/auth/sign-in')
  })

  test('sign-in page renders correctly', async ({ page }) => {
    const authPage = new AuthPage(page)
    await authPage.goto()
    await authPage.expectVisible()
  })
})
```

- [ ] **Step 2: Run auth tests**

```bash
pnpm test:e2e --project=chromium tests/e2e/auth.spec.ts
```

Expected: 3 passed. If any fail:
- "button not found" → check AuthButton renders as `<button>` (it might render as `<a>`); switch to `getByRole('link', ...)` if needed
- "redirect not to /auth/sign-in" → verify layout.tsx session check runs before index loader

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test: add unauthenticated E2E tests"
```

---

## Task 7: Authenticated Tests (navigation.spec.ts)

**Files:**
- Create: `tests/e2e/navigation.spec.ts`

The `routes/index.tsx` loader redirects authenticated users to `/${userId}/stash?layout=grid&take=100`. URL assertions use regex to ignore query params.

- [ ] **Step 1: Create `tests/e2e/navigation.spec.ts`**

```typescript
import { test, expect } from './fixtures'
import { LayoutPage } from './pages/layout.page'
import { StashPage } from './pages/stash.page'
import { TEST_USER_ID } from './constants'

test.describe('Authenticated navigation', () => {
  test('visiting / redirects to stash home', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`/${TEST_USER_ID}/stash`))
  })

  test('stash home loads without redirect', async ({ page }) => {
    const stashPage = new StashPage(page)
    await stashPage.goto(TEST_USER_ID)
    await stashPage.expectLoaded()
  })

  test('sidebar is visible on stash home', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.expectSidebarVisible()
  })

  test('clicking Recent Files navigates to /recent', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Recent Files')
    await expect(page).toHaveURL(new RegExp('/recent'))
  })

  test('clicking Collections navigates to /collections', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Collections')
    await expect(page).toHaveURL(new RegExp('/collections'))
  })

  test('clicking Shares navigates to /shares', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Shares')
    await expect(page).toHaveURL(new RegExp('/shares'))
  })

  test('clicking Trash navigates to /trash', async ({ page }) => {
    const layout = new LayoutPage(page)
    await page.goto(`/${TEST_USER_ID}/stash`)
    await layout.clickNavItem('Trash')
    await expect(page).toHaveURL(new RegExp('/trash'))
  })
})
```

- [ ] **Step 2: Run navigation tests**

```bash
pnpm test:e2e --project=chromium tests/e2e/navigation.spec.ts
```

Expected: 7 passed. If any fail:
- "session not found / redirect to sign-in" → check `BETTER_AUTH_SECRET` in `.env` is set; check global-setup ran successfully and `tests/e2e/.auth/session.json` exists
- "sidebar not visible" → inspect the rendered HTML; the selector `[data-sidebar="sidebar"]` targets the inner sidebar element. If the sidebar is collapsed, it might still be in the DOM but invisible — assert `toBeAttached()` instead or expand it first
- "link not found by name" → open `pnpm test:e2e:ui` to inspect the page and verify the nav link text matches exactly (e.g., "Recent Files" not "Recent")
- "URL does not match /recent" → verify the NavLink `to` prop in `app/components/app-sidebar.tsx` matches the regex

- [ ] **Step 3: Run full suite**

```bash
pnpm test:e2e
```

Expected output:
```
Running 10 tests using 1 worker
  ✓ ... auth.spec.ts > Unauthenticated flows > visiting / redirects to sign-in
  ✓ ... auth.spec.ts > Unauthenticated flows > visiting /:me/stash without a session redirects to sign-in
  ✓ ... auth.spec.ts > Unauthenticated flows > sign-in page renders correctly
  ✓ ... navigation.spec.ts > Authenticated navigation > visiting / redirects to stash home
  ✓ ... navigation.spec.ts > Authenticated navigation > stash home loads without redirect
  ✓ ... navigation.spec.ts > Authenticated navigation > sidebar is visible on stash home
  ✓ ... navigation.spec.ts > Authenticated navigation > clicking Recent Files navigates to /recent
  ✓ ... navigation.spec.ts > Authenticated navigation > clicking Collections navigates to /collections
  ✓ ... navigation.spec.ts > Authenticated navigation > clicking Shares navigates to /shares
  ✓ ... navigation.spec.ts > Authenticated navigation > clicking Trash navigates to /trash

10 passed (Xs)
```

- [ ] **Step 4: Final commit**

```bash
git add tests/e2e/navigation.spec.ts
git commit -m "test: add authenticated navigation E2E tests"
```
