import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { TEST_USER_ID } from './constants'

/**
 * The app header at phone, tablet and laptop widths (tech-debt #10): the page
 * never scrolls sideways, and no two header controls draw over each other or
 * sit off screen. Before the fix the header's left group never shrank: at
 * 375px the page was 815px wide with 11 of 15 controls off screen, and below
 * ~1010px the layout switch slid over the Sort pill.
 */

const WIDTHS = [375, 768, 1024, 1280] as const
const PAGES = [
  { name: 'stash home', path: `/${TEST_USER_ID}/stash?layout=grid` },
  { name: 'All', path: `/${TEST_USER_ID}/stash/all?layout=grid` },
] as const

/** Visible header controls, each clipped by any ancestor that clips on x. */
function measureHeader(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const header = document.querySelector('header')!
    const visibleRect = (el: Element) => {
      const r = el.getBoundingClientRect()
      let left = r.left
      let right = r.right
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') {
          const ar = a.getBoundingClientRect()
          left = Math.max(left, ar.left)
          right = Math.min(right, ar.right)
        }
      }
      return { left, right, top: r.top, bottom: r.bottom }
    }
    const controls = [...header.querySelectorAll('button, input, a[href]')]
      // The Filter pill's own trigger spans the pill, under its flag toggles.
      .filter((el) => el.getAttribute('aria-label') !== 'Filter')
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        name:
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          (el.textContent ?? '').trim(),
        ...visibleRect(el),
      }))
      .filter((c) => c.right - c.left > 0.5)

    const overlaps: string[] = []
    for (let i = 0; i < controls.length; i++)
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i]
        const b = controls[j]
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (x > 0.5 && y > 0.5) overlaps.push(`${a.name} / ${b.name} (${Math.round(x)}px)`)
      }
    return {
      innerWidth: vw,
      scrollWidth: document.documentElement.scrollWidth,
      controls: controls.length,
      offscreen: controls
        .filter((c) => c.left < -0.5 || c.right > vw + 0.5)
        .map((c) => c.name),
      overlaps,
    }
  })
}

async function expectHeaderFits(page: Page) {
  const m = await measureHeader(page)
  expect(m.scrollWidth, 'page scrolls sideways').toBeLessThanOrEqual(m.innerWidth)
  expect(m.offscreen, 'header controls off screen').toEqual([])
  expect(m.overlaps, 'header controls drawn over each other').toEqual([])
  expect(m.controls).toBeGreaterThan(4)
}

/** On a laptop the header's own trigger is hidden; the sidebar carries one. */
const sidebarTrigger = (page: Page) =>
  page.locator('[data-slot="sidebar-trigger"]:visible').first()

test.describe('App header fits the window', () => {
  for (const p of PAGES)
    for (const width of WIDTHS)
      test(`${p.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(p.path)
        await expect(page.locator('header')).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expectHeaderFits(page)
      })

  for (const width of [1024, 1280] as const)
    test(`stash home at ${width}px with the sidebar toggled`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(PAGES[0].path)
      await page.waitForLoadState('networkidle')
      const header = page.locator('header')
      const before = (await header.boundingBox())!.width
      await sidebarTrigger(page).click()
      // The sidebar animates its width; wait until the header has resized.
      await expect
        .poll(async () => (await header.boundingBox())!.width)
        .not.toBe(before)
      await page.waitForTimeout(400)
      await expectHeaderFits(page)
    })

  test('a phone gets one "View options" button for Filter, Sort and Layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(PAGES[1].path)
    const header = page.locator('header')
    await expect(header.getByRole('button', { name: 'View options' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Filter', exact: true })).toBeHidden()
    await expect(header.getByRole('radio', { name: 'Grid view' })).toBeHidden()

    // Retry until hydrated: a click on a server-rendered Radix trigger is lost.
    const dialog = page.getByRole('dialog')
    await expect(async () => {
      await header.getByRole('button', { name: 'View options' }).click()
      await expect(dialog).toBeVisible({ timeout: 1000 })
    }).toPass()
    await expect(dialog.getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Toggle sort direction/ })).toBeVisible()
    await dialog.getByRole('radio', { name: 'List view' }).click()
    await expect(page).toHaveURL(/[?&]layout=list/)
  })
})
