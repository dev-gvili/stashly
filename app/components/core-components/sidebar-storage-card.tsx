import { ChevronRightIcon } from '@/components/icons'
import { CircleProgressBar } from '@/components/squer-progress-bar'
import { UploadActorContext } from '@/machines/upload/upload.context'
import type { QuotaApiRouteOutput } from '@/types/api.types'
import { createDebouncer } from '@/utils/debounce'
import { formatSize } from '@/utils/formaters'
import { basisForPercent, cn } from '@/utils/styles'
import { useEffect, useState } from 'react'
import { href, Link, useLocation } from 'react-router'

/**
 * Storage usage card at the bottom of the app sidebar: used of total, a meter,
 * and a link to the billing page.
 *
 * Reads `/api/quota` with a plain `fetch`, not a fetcher: a fetcher submission
 * would revalidate every active loader. The layout loader never revalidates,
 * so the quota is re-read on each navigation (deletes, trash, restore) and a
 * second after the upload actor's last `items.created` (uploads).
 * Renders nothing until the first answer arrives, rather than a made-up figure.
 */
export function SidebarStorageCard({ userId }: { userId: string }) {
  const { pathname } = useLocation()
  const [quota, setQuota] = useState<QuotaApiRouteOutput | null>(null)
  // Bumped after uploads land, so the figure follows them without a navigation.
  const [uploadTick, setUploadTick] = useState(0)
  const upload = UploadActorContext.useActorRef()

  useEffect(() => {
    // A folder upload emits a batch per create, and under load the charge
    // trails the rows by up to ~0.7 s: wait for the burst to settle, then read once.
    const refresh = createDebouncer()
    const subscription = upload.on('items.created', () =>
      refresh.call(() => setUploadTick((n) => n + 1), 1000)
    )
    return () => {
      subscription.unsubscribe()
      refresh.cancel()
    }
  }, [upload])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'find-quota' }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<QuotaApiRouteOutput>) : null))
      .then((next) => {
        if (next) setQuota(next)
      })
      .catch(() => {
        // Aborted or offline: keep the last figure.
      })
    return () => controller.abort()
  }, [pathname, uploadTick])

  if (!quota) return null

  const percent = quota.total ? (quota.used / quota.total) * 100 : 0
  const critical = quota.status === 'critical' || quota.status === 'exceeded'

  return (
    <>
      <SidebarStorageTile quota={quota} percent={percent} critical={critical} />
      <div className="font-stashly border-border/50 bg-background flex flex-col gap-3 rounded-2xl border p-4 group-data-[collapsible=icon]:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground text-sm font-medium">Storage</span>
          <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
            {formatSize('byte', 'unit', quota.used)} / {formatSize('byte', 'unit', quota.total)}
          </span>
        </div>
        <div
          role="meter"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="bg-muted flex h-1.5 overflow-hidden rounded-xs"
        >
          <span
            className={cn(
              'h-full rounded-xs',
              critical ? 'bg-destructive' : 'bg-primary',
              basisForPercent(percent)
            )}
          />
        </div>
        <Link
          to={href('/:me/settings/billing', { me: userId })}
          className="text-primary flex items-center gap-1.5 text-sm hover:underline"
        >
          Get more space
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
    </>
  )
}

/**
 * The card's collapsed-sidebar form: the upload list's square progress ring
 * with the percentage inside, used of total in the tooltip. Drawn by
 * {@link SidebarStorageCard} from the same quota, so the two can't disagree;
 * shown only while the sidebar is collapsed.
 */
function SidebarStorageTile({
  quota,
  percent,
  critical,
}: {
  quota: QuotaApiRouteOutput
  percent: number
  critical: boolean
}) {
  return (
    <CircleProgressBar.Root
      role="meter"
      aria-label="Storage used"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="-mx-1 hidden size-11 shrink-0 group-data-[collapsible=icon]:block"
    >
      {/* No visible track: Root draws it over the indicator, so a coloured
          track would cover the progress. The indicator's fill is the ring. */}
      <CircleProgressBar.Circle className="stroke-transparent" />
      <CircleProgressBar.Indicator
        progress={percent}
        strokeLinejoin="round"
        className={cn(
          'fill-accent',
          critical ? 'text-destructive' : 'text-primary'
        )}
      />
      <CircleProgressBar.Value
        width={70}
        height={70}
        x="12.5"
        y="12.5"
        className="text-3xl tabular-nums"
      >
        {/* The tooltip lives here: an <svg> ignores the title attribute. */}
        <div
          title={`Storage: ${formatSize('byte', 'unit', quota.used)} / ${formatSize('byte', 'unit', quota.total)}`}
          className="flex size-full items-center justify-center"
        >
          {Math.round(percent)}%
        </div>
      </CircleProgressBar.Value>
    </CircleProgressBar.Root>
  )
}
