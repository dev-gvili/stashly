import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class AuthPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/auth/sign-in')
  }

  providerButton(name: 'GitHub' | 'Google' | 'Microsoft') {
    return this.page.getByRole('button', { name, exact: true })
  }

  async expectVisible() {
    await expect(
      this.page.getByRole('heading', { name: 'Welcome back' })
    ).toBeVisible()
    await expect(this.providerButton('GitHub')).toBeVisible()
    await expect(this.providerButton('Google')).toBeVisible()
    await expect(this.providerButton('Microsoft')).toBeVisible()
  }
}
