"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils"

type Mode = "listening" | "processing" | "static"

const BAR_COUNT = 52

function generateBars(mode: Mode, tick: number): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    if (mode === "static") {
      // Dotted/dashed-looking low uniform bars — like in the screenshot
      return i % 2 === 0 ? 0.12 : 0.08
    }
    if (mode === "listening") {
      return 0.08 + 0.88 * Math.abs(Math.sin(i * 0.45 + tick * 0.12))
    }
    // processing: fast jagged spikes
    return 0.05 + 0.92 * Math.abs(Math.sin(i * 0.9 + tick * 0.28 + i * 0.25))
  })
}

export function AudioWaveformCard() {
  const [mode, setMode] = useState<Mode>("static")
  const [bars, setBars] = useState<number[]>(() => generateBars("static", 0))
  const tickRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (mode === "static") {
      setBars(generateBars("static", 0))
      return
    }

    const animate = () => {
      tickRef.current += 1
      setBars(generateBars(mode, tickRef.current))
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mode])

  const modeButtons: { label: string; value: Mode }[] = [
    { label: "Start Listening", value: "listening" },
    { label: "Stop Processing", value: "processing" },
    { label: "Static", value: "static" },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Live Audio Waveform</CardTitle>
        <CardDescription className="text-sm leading-snug">
          Real-time microphone input visualization with audio reactivity
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-[2px] h-14 w-full overflow-hidden">
          {bars.map((h, i) => (
            <div
              key={i}
              className={cn(
                "rounded-[1px] transition-none",
                mode === "static" ? "w-[3px]" : "flex-1"
              )}
              style={{
                height: `${Math.max(3, h * 100)}%`,
                backgroundColor:
                  mode === "static"
                    ? "hsl(215 12% 45%)"
                    : "oklch(0.696 0.17 149)",
                opacity: mode === "static" ? 0.7 : 0.9,
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Control buttons */}
        <div className="flex flex-wrap gap-2">
          {modeButtons.map(({ label, value }) => (
            <Button
              key={value}
              size="sm"
              variant={mode === value ? "default" : "outline"}
              onClick={() => setMode(value)}
              className={cn(
                "text-xs h-7 px-3 font-medium",
                mode === value
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border text-foreground hover:bg-muted"
              )}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
