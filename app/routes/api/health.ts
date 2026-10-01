import { data } from 'react-router'
import { checkHealth } from '@/services/health-actions'

/** 200 when the database answers, 503 when it doesn't — see `checkHealth`. */
export async function loader() {
  const report = await checkHealth()
  return data(report, {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
