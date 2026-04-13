"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"

export function SmartLockCard() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-base font-semibold text-foreground">Front Door</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Smart Lock Pro</CardDescription>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-medium text-foreground">Locked</span>
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Camera feed area */}
        <div className="relative mx-4 mb-4 rounded-lg overflow-hidden bg-muted" style={{ height: 160 }}>
          {/* Diagonal hatch pattern mimicking camera feed */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="hatch"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="12" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hatch)" />
          </svg>

          {/* Live badge */}
          <div className="absolute top-2.5 right-2.5">
            <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-sm font-semibold tracking-wide">
              Live
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
