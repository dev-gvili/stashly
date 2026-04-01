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
