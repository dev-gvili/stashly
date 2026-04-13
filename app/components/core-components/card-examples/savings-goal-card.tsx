"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

const progress = 80
const total = 30000
const current = 24000

const data = [
  { value: progress },
  { value: 100 - progress },
]

export function SavingsGoalCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Donut Chart */}
        <div className="relative w-full flex items-center justify-center" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={82}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="oklch(0.696 0.17 149)" />
                <Cell fill="oklch(0.245 0.007 285)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-foreground">
              ${current.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{progress}% of ${total.toLocaleString()}</span>
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Projected Finish</span>
            <span className="text-sm font-medium text-foreground">October 2024</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Monthly Average</span>
            <span className="text-sm font-medium text-foreground">$1,250</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Top Contributor</span>
            <span className="text-sm font-medium text-foreground">Auto-Transfer</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
