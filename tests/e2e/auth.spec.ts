import { test, expect, type Locator, type Page, type Request } from '@playwright/test'
import { AuthPage } from './pages/auth.page'
import { TEST_USER_ID } from './constants'
import { rememberAccount } from '../../app/.server/remembered-account'

/** A click before hydration does nothing, so retry until the sign-in request goes out. */
async function clickUntilSignInRequest(page: Page, target: Locator) {
  let request: Request | undefined
  await expect(async () => {
    const pending = page.waitForRequest('**/api/auth/sign-in/social', { timeout: 1_000 })
    await target.click()
    request = await pending
  }).toPass({ timeout: 10_000 })
  return request!
}

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
    await expect(page.getByText(/^Continue as /)).toHaveCount(0)
  })

  test('a provider button starts that OAuth sign-in', async ({ page }) => {
    // Stop at our own endpoint — following the redirect would leave for GitHub.
    await page.route('**/api/auth/sign-in/social', (route) =>
      route.fulfill({ json: { url: '/auth/sign-in', redirect: false } })
    )
    const authPage = new AuthPage(page)
    await authPage.goto()
    const request = await clickUntilSignInRequest(page, authPage.providerButton('GitHub'))
    expect(request.postDataJSON()).toMatchObject({ provider: 'github' })
  })

  test('the last account signed in on this browser is offered first', async ({ page, context, baseURL }) => {
    const setCookie = await rememberAccount({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      provider: 'google',
    })
    const [name, ...value] = setCookie!.split(';')[0].split('=')
    await context.addCookies([{ name, value: value.join('='), url: baseURL! }])
    await page.route('**/api/auth/sign-in/social', (route) =>
      route.fulfill({ json: { url: '/auth/sign-in', redirect: false } })
    )

    await page.goto('/auth/sign-in')
    const card = page.getByRole('button', { name: /Continue as Ada Lovelace/ })
    await expect(card).toBeVisible()
    await expect(card).toContainText('ada@example.com')

    const request = await clickUntilSignInRequest(page, card)
    expect(request.postDataJSON()).toMatchObject({
      provider: 'google',
      loginHint: 'ada@example.com',
    })
  })
})
