import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const usageItems = [
  { label: "Edge Requests", value: "$1.83K", dot: "bg-primary" },
  { label: "Fast Data Transfer", value: "$952.51", dot: "bg-primary/70" },
  { label: "Monitoring data points", value: "$901.20", dot: "bg-primary/50" },
  { label: "Web Analytics Events", value: "$683.71", dot: "bg-muted-foreground/50" },
  { label: "ISR Writes", value: "$24.52K / 2M", dot: "bg-muted-foreground/30" },
  { label: "Function Duration", value: "5.11 GB Hrs / 1K GB Hrs", dot: "bg-muted-foreground/20" },
]

export function CycleUsageCard() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">5 days remaining in cycle</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {usageItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
              <span className="text-xs text-foreground">{item.label}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
