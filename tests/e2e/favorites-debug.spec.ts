import { test } from './fixtures'
import { TEST_USER_ID } from './constants'

test('debug: what does the favorites page look like?', async ({ page }) => {
  await page.goto(`/${TEST_USER_ID}/stash/favorites`)
  await page.waitForLoadState('load')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/favorites-debug.png', fullPage: true })
  const content = await page.content()
  const hasItemB = content.includes('E2E Fav Item B')
  const hasItemC = content.includes('E2E Fav Item C')
  const hasNoFav = content.includes('No favorites')
  const hasError = content.includes('Error!')
  console.log({ hasItemB, hasItemC, hasNoFav, hasError, url: page.url() })
})
