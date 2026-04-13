"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"

// Smooth sinusoidal wave — two peaks visible, matches the screenshot curve
const data = [
  { v: 55 },
  { v: 72 },
  { v: 88 },
  { v: 95 },
  { v: 82 },
  { v: 60 },
  { v: 42 },
  { v: 35 },
  { v: 48 },
  { v: 68 },
  { v: 85 },
  { v: 96 },
  { v: 90 },
  { v: 75 },
]

export function VisitorsCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-1 flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-3 w-full">
            <p className="text-base font-semibold text-foreground leading-none">Visitors</p>
            <span className="text-xs font-medium">+2% vs last month</span>
          </div>
          <p className="text-sm text-muted-foreground">Last 6 months</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <Tooltip
              formatter={(val) => [`${val}K`, "Visitors"]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "var(--foreground)",
              }}
              cursor={{ stroke: "hsl(215 15% 40%)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke="hsl(0 0% 92%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(0 0% 92%)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {/* Slide indicators bottom right */}
        <div className="flex justify-end items-center gap-1 px-4 pb-3 -mt-1">
          <span className="text-xs text-muted-foreground font-medium">01</span>
          <span className="text-xs text-foreground font-semibold bg-muted rounded px-1">02</span>
        </div>
      </CardContent>
    </Card>
  )
}
