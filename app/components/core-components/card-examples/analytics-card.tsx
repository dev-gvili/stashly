"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts"

// Rising trend from left, dips, then rises steeply to the right — matches screenshot
const data = [
  { v: 120 },
  { v: 180 },
  { v: 140 },
  { v: 220 },
  { v: 175 },
  { v: 260 },
  { v: 210 },
  { v: 310 },
  { v: 270 },
  { v: 360 },
  { v: 330 },
  { v: 418 },
]

export function AnalyticsCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground leading-none">Analytics</p>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-sm text-muted-foreground">418.2K Visitors</span>
            <Badge className="bg-primary/20 text-primary border-0 text-xs font-semibold px-1.5 py-0 rounded-sm">
              +10%
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs shrink-0 h-7 px-2.5">
          View Analytics
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.696 0.17 149)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.696 0.17 149)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip
              formatter={(val) => [`${val}K`, "Visitors"]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "var(--foreground)",
              }}
              cursor={{ stroke: "oklch(0.696 0.17 149)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="oklch(0.696 0.17 149)"
              strokeWidth={2}
              fill="url(#aGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "oklch(0.696 0.17 149)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
