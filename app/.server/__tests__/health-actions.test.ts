import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/services/db'
import { checkHealth } from '@/services/health-actions'

// Needs a live database, like collection-actions.test.ts: CI provides one.
describe('checkHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports ok when the database answers', async () => {
    const report = await checkHealth()
    expect(report).toMatchObject({ status: 'ok', db: 'ok' })
    expect(report.dbLatencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports unreachable when the query fails', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 10.0.0.1:5432')
    )
    const report = await checkHealth()
    expect(report).toMatchObject({ status: 'error', db: 'unreachable' })
    // The connection error stays in the server log, not the public response.
    expect(JSON.stringify(report)).not.toContain('10.0.0.1')
  })
})
