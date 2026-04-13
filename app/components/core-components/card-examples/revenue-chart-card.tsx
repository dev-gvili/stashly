import { Card, CardContent } from '@/ui/card'
import { Separator } from '@/ui/separator'

const radius = 54
const circumference = 2 * Math.PI * radius
const progress = 0.8
const dashOffset = circumference * (1 - progress)

export function RevenueChartCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-center py-4">
          <div className="relative flex items-center justify-center">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="12"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 70 70)"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold">$24,000</span>
              <span className="text-muted-foreground text-xs">
                80% of $30,000
              </span>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 text-sm">
          <div className="text-muted-foreground flex justify-between">
            <span>Projected Finish</span>
            <span className="text-foreground font-medium">October 2024</span>
          </div>
          <div className="text-muted-foreground flex justify-between">
            <span>Monthly Average</span>
            <span className="text-foreground font-medium">$1,250</span>
          </div>
          <div className="text-muted-foreground flex justify-between">
            <span>Top Contributor</span>
            <span className="text-foreground font-medium">Auto-Transfer</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
