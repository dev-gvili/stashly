import { test, expect } from './fixtures'
import { TEST_USER_ID } from './constants'

/** The six sections, in nav order, with the label the nav and breadcrumb show. */
const SECTIONS = [
  { path: 'profile', label: 'Profile', title: 'Profile' },
  { path: 'appearance', label: 'Appearance', title: 'Appearance' },
  { path: 'notifications', label: 'Notifications', title: 'Notifications' },
  { path: 'ai', label: 'AI & privacy', title: 'AI & privacy' },
  { path: 'billing', label: 'Plan & billing', title: 'Plan & billing' },
  { path: 'accounts', label: 'Connected accounts', title: 'Connected accounts' },
]

test.describe('Settings', () => {
  test('/settings opens on Profile', async ({ page }) => {
    await page.goto(`/${TEST_USER_ID}/settings`)
    await expect(page).toHaveURL(new RegExp(`/${TEST_USER_ID}/settings/profile(\\?|$)`))
    await expect(page.getByRole('heading', { level: 2, name: 'Profile' })).toBeVisible()
  })

  for (const section of SECTIONS) {
    test(`${section.label} is deep-linkable`, async ({ page }) => {
      await page.goto(`/${TEST_USER_ID}/settings/${section.path}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 2, name: section.title })).toBeVisible()
      await expect(page).toHaveTitle(`Settings · ${section.title} · Stashly`)

      const nav = page.getByRole('navigation', { name: 'Settings' })
      await expect(nav.getByRole('link', { name: section.label })).toHaveAttribute(
        'aria-current',
        'page'
      )
      await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText(
        section.label
      )
    })
  }
})
