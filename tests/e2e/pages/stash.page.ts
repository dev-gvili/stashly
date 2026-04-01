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
