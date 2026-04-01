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
