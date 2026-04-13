'use client'

import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'

const points = [
  { x: 0, y: 60 },
  { x: 1, y: 55 },
  { x: 2, y: 58 },
  { x: 3, y: 48 },
  { x: 4, y: 52 },
  { x: 5, y: 42 },
  { x: 6, y: 45 },
  { x: 7, y: 38 },
  { x: 8, y: 35 },
  { x: 9, y: 30 },
  { x: 10, y: 28 },
  { x: 11, y: 25 },
]

function buildPath(pts: typeof points, width: number, height: number) {
  const xStep = width / (pts.length - 1)
  return pts
    .map((p, i) => {
      const x = i * xStep
      const y = height - (p.y / 100) * height
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

export function VisitorsChartCard() {
  const w = 280
  const h = 80

  const path = buildPath(points, w, h)
  const areaPath = `${path} L ${w} ${h} L 0 ${h} Z`

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Visitors</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline" className="text-xs font-medium">
            +2% vs last month
          </Badge>
        </CardAction>
      </CardHeader>
      <div className="px-6 pb-4">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="visitors-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#visitors-fill)" />
          <path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex justify-end px-6 pb-4">
        <Tabs defaultValue="01">
          <TabsList className="h-7">
            <TabsTrigger value="01" className="px-3 text-xs">
              01
            </TabsTrigger>
            <TabsTrigger value="02" className="px-3 text-xs">
              02
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </Card>
  )
}
