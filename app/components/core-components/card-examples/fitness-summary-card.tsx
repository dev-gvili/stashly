"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts"

const days = ["M", "T", "W", "T", "F", "S", "S"]

// calories = muted bars (taller), load = emerald overlay bars (shorter)
const data = [
  { day: "M", calories: 72, load: 45 },
  { day: "T", calories: 58, load: 38 },
  { day: "W", calories: 85, load: 62 },
  { day: "T", calories: 68, load: 52 },
  { day: "F", calories: 95, load: 78 },
  { day: "S", calories: 42, load: 28 },
  { day: "S", calories: 30, load: 18 },
]

export function FitnessSummaryCard() {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold">Weekly Fitness Summary</CardTitle>
        <CardDescription className="text-sm">Calories and workout load by day</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {/* Day labels */}
        <div className="grid grid-cols-7 px-1">
          {days.map((d, i) => (
            <span key={i} className="text-center text-xs font-medium text-muted-foreground">
              {d}
            </span>
          ))}
        </div>

        {/* Grouped bar chart — calories (gray) behind, load (emerald) in front */}
        <ResponsiveContainer width="100%" height={100}>
          <BarChart
            data={data}
            barCategoryGap="20%"
            barGap={2}
            margin={{ top: 0, right: 4, left: 4, bottom: 0 }}
          >
            <XAxis dataKey="day" hide />
            <Bar dataKey="calories" radius={[3, 3, 2, 2]} maxBarSize={18}>
              {data.map((_, i) => (
                <Cell key={i} fill="hsl(215 15% 35%)" />
              ))}
            </Bar>
            <Bar dataKey="load" radius={[3, 3, 2, 2]} maxBarSize={18}>
              {data.map((_, i) => (
                <Cell key={i} fill="oklch(0.696 0.17 149)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
          View details
        </Button>
      </CardContent>
    </Card>
  )
}
