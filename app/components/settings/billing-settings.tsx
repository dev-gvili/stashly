import { formatPlanLine, formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Progress } from '@/ui/progress'
import { Link } from 'react-router'
import { SETTINGS_CARD } from './settings-layout'

interface BillingPlan {
  name: string
  type: string
  storageLimit: number
  price: { amountCents: number; currency: string } | null
  interval: { unit: string; count: number } | null
}

/**
 * Plan & billing: the current plan with its real price line, a CTA to the plan
 * picker, and storage used. The bar turns destructive only once used reaches
 * the total, with a line saying uploads are blocked.
 */
export function BillingSettings({
  plan,
  quota,
  plansHref,
}: {
  plan: BillingPlan
  quota: { used: number; total: number }
  plansHref: string
}) {
  const full = quota.total > 0 && quota.used >= quota.total
  const percent = quota.total > 0 ? Math.min(100, (quota.used / quota.total) * 100) : 0
  const isFree = plan.price === null

  return (
    <Card className={cn(SETTINGS_CARD, 'flex flex-col gap-5 p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Current plan
          </span>
          <span className="text-2xl tracking-tight text-foreground">{plan.name}</span>
          <span className="text-sm text-muted-foreground">{formatPlanLine(plan)}</span>
        </div>
        <Button asChild>
          <Link to={plansHref}>{isFree ? 'Upgrade' : 'Change plan'}</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Storage used</span>
          <span className="tabular-nums text-foreground">
            {formatSize('byte', 'unit', quota.used)} / {formatSize('byte', 'unit', quota.total)}
          </span>
        </div>
        <Progress
          aria-label="Storage used"
          value={percent}
          className="h-1.5 rounded-xs bg-secondary"
          indicatorClassName={full ? 'bg-destructive' : 'bg-primary'}
        />
        {full && (
          <p className="text-xs text-destructive">
            Your stash is full. Upgrade or free up space to keep uploading.
          </p>
        )}
      </div>
    </Card>
  )
}
