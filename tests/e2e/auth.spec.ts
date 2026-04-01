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
