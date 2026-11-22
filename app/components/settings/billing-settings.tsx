import { DoubleCheckIcon, LoaderIcon } from '@/components/icons'
import { formatPlanLine, formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Progress } from '@/ui/progress'
import { useFetcher } from 'react-router'
import { SETTINGS_CARD } from './settings-layout'

interface BillingPlan {
  id: string
  name: string
  description: string | null
  features: string[]
  storageLimit: number
  price: { amountCents: number; currency: string } | null
  interval: { unit: string; count: number } | null
}

/**
 * Plan & billing: the current plan with its real price line and storage used,
 * then every plan as a card to switch to. The storage bar turns destructive
 * only once used reaches the total. The CTA jumps to the plan cards.
 */
export function BillingSettings({
  plan,
  plans,
  quota,
}: {
  plan: BillingPlan
  plans: BillingPlan[]
  quota: { used: number; total: number }
}) {
  const full = quota.total > 0 && quota.used >= quota.total
  const percent = quota.total > 0 ? Math.min(100, (quota.used / quota.total) * 100) : 0
  const isFree = plan.price === null

  return (
    <div className="flex flex-col gap-5">
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
            <a href="#plans">{isFree ? 'Upgrade' : 'Change plan'}</a>
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

      <section id="plans" aria-labelledby="plans-label" className="flex scroll-mt-20 flex-col gap-3">
        <h3 id="plans-label" className="text-sm text-foreground">
          Plans
        </h3>
        <div className="grid gap-3 grid-cards-md">
          {plans.map((option) => (
            <PlanCard key={option.id} plan={option} current={option.id === plan.id} />
          ))}
        </div>
      </section>
    </div>
  )
}

/** One plan to switch to. The current plan's button is disabled and says so. */
function PlanCard({ plan, current }: { plan: BillingPlan; current: boolean }) {
  const fetcher = useFetcher<{ ok: true } | { error: string }>()
  const switching = fetcher.state !== 'idle'
  const error =
    fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null

  return (
    <Card className={cn(SETTINGS_CARD, 'flex flex-col gap-4 p-5')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-foreground">{plan.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{formatPlanLine(plan)}</span>
      </div>
      {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
      {plan.features.length > 0 && (
        <ul className="flex flex-1 flex-col gap-2 border-t border-input pt-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
              <DoubleCheckIcon aria-hidden className="size-4 shrink-0 text-foreground" />
              {feature}
            </li>
          ))}
        </ul>
      )}
      <fetcher.Form method="post" className="mt-auto flex flex-col gap-2">
        <input type="hidden" name="intent" value="change_plan" />
        <input type="hidden" name="storagePlanId" value={plan.id} />
        <Button type="submit" variant="outline" size="sm" disabled={current || switching}>
          {switching && <LoaderIcon aria-hidden className="size-4 animate-spin" />}
          {current ? 'Current plan' : 'Switch to this plan'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </fetcher.Form>
    </Card>
  )
}
