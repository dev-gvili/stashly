/**
 * Reads the E2E user's quota through the app's own read-only route, and
 * records what the page itself sends to that route.
 *
 * Quota is written only on the server: an upload is charged inside the
 * transaction that creates its row (`createUploadedItem`). `/api/quota` answers
 * reads and refuses every write with a 400, so a page that posts a write — the
 * `items-uploaded` charge the upload machine used to send — shows up here as a
 * failed request.
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface QuotaReading {
  used: number
  total: number
  deleted: number
}

/** The read actions `/api/quota` serves. Anything else is refused. */
export const QUOTA_READ_ACTIONS = ['find-quota', 'verify-free-quota', 'check-free-quota']

/** Current quota of the signed-in user, as `find-quota` reports it. */
export async function readQuota(page: Page): Promise<QuotaReading> {
  const res = await page.request.post('/api/quota', { data: { action: 'find-quota' } })
  expect(res.status(), 'find-quota should answer 200').toBe(200)
  const body = (await res.json()) as QuotaReading
  return { used: body.used, total: body.total, deleted: body.deleted }
}

/** Posts a raw body to `/api/quota` and returns the status it answered with. */
export async function postQuota(page: Page, body: Record<string, unknown>): Promise<number> {
  const res = await page.request.post('/api/quota', { data: body })
  return res.status()
}

/**
 * Records every `/api/quota` request the page makes from now on: the action it
 * sent and the status it got back. `page.request` calls made by the test itself
 * do not go through the page, so they are not recorded.
 */
export function recordQuotaTraffic(page: Page) {
  const calls: { action: string; status?: number }[] = []
  page.on('response', (res) => {
    const req = res.request()
    if (!req.url().endsWith('/api/quota')) return
    let action = '<unparsed>'
    try {
      action = (JSON.parse(req.postData() ?? '{}') as { action?: string }).action ?? '<none>'
    } catch {
      // Left as <unparsed>: a body the route could not read either.
    }
    calls.push({ action, status: res.status() })
  })
  return calls
}
