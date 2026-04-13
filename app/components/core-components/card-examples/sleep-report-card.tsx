"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts"

// Varied heights to match the screenshot — last bar is tallest (highlighted)
const data = [
  { i: 0, v: 55 },
  { i: 1, v: 70 },
  { i: 2, v: 45 },
  { i: 3, v: 80 },
  { i: 4, v: 60 },
  { i: 5, v: 75 },
  { i: 6, v: 50 },
  { i: 7, v: 65 },
  { i: 8, v: 40 },
  { i: 9, v: 85 },
  { i: 10, v: 55 },
  { i: 11, v: 90 },
  { i: 12, v: 70 },
]

export function SleepReportCard() {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold">Sleep Report</CardTitle>
        <CardDescription className="text-sm">Last night &middot; 7h 24m</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <ResponsiveContainer width="100%" height={130}>
          <BarChart
            data={data}
            barCategoryGap="18%"
            margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
          >
            <Bar dataKey="v" radius={[4, 4, 3, 3]} maxBarSize={20}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    i === data.length - 1
                      ? "oklch(0.696 0.17 149)"
                      : "hsl(215 15% 30%)"
                  }
                  opacity={i === data.length - 1 ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
