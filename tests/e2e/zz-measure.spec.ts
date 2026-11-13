// TEMPORARY measurement (branch qa/prod-e2e-measure only, never merged).
import { test } from './fixtures'
import { TEST_USER_ID } from './constants'

test('measure goto', async ({ browser }, testInfo) => {
  const rows: { goto: number; load: number; reqs: number; bytes: number }[] = []
  for (let i = 0; i < 8; i++) {
    const ctx = await browser.newContext({
      storageState: `tests/e2e/.auth/${testInfo.parallelIndex === 0 ? 'session.json' : `session-${testInfo.parallelIndex}.json`}`,
    })
    const page = await ctx.newPage()
    let reqs = 0
    let bytes = 0
    page.on('requestfinished', async (r) => {
      reqs++
      const s = await r.sizes().catch(() => null)
      if (s) bytes += s.responseBodySize
    })
    const t0 = Date.now()
    await page.goto(`/${TEST_USER_ID}/stash?layout=grid`, { waitUntil: 'domcontentloaded' })
    const goto = Date.now() - t0
    await page.waitForLoadState('load')
    await page.waitForLoadState('networkidle').catch(() => {})
    const load = Date.now() - t0
    if (i > 0) rows.push({ goto, load, reqs, bytes }) // run 0 is the cold server
    else console.log('MEASURE cold', JSON.stringify({ goto, load, reqs, bytes }))
    await ctx.close()
  }
  const med = (k: 'goto' | 'load' | 'reqs' | 'bytes') =>
    rows.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
  console.log(
    'MEASURE warm median',
    JSON.stringify({ goto_ms: med('goto'), networkidle_ms: med('load'), requests: med('reqs'), body_bytes: med('bytes') }),
    'all goto',
    rows.map((r) => r.goto).join(',')
  )
})
