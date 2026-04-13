"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

const filters = ["Stocks", "ETFs", "REITs"]

const holdings = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "ETF",
    detail: "112 SHARES · JAN 2021",
    value: "$48,230.40",
  },
]

export function InvestmentSearchCard() {
  const [activeFilter, setActiveFilter] = useState("ETFs")
  const [query, setQuery] = useState("")

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {/* Search + filters */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search holdings or tickers..."
              className="pl-8 bg-muted border-0 text-sm h-8 text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {filters.map((f) => (
              <Button
                key={f}
                variant={activeFilter === f ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveFilter(f)}
                className={`h-8 px-3 text-xs ${
                  activeFilter === f
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Holdings list */}
        {holdings.map((h, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-4 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted border border-border shrink-0">
              <span className="text-xs font-bold text-foreground">{h.ticker}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{h.name}</p>
              <p className="text-xs text-muted-foreground">{h.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground mb-0.5">{h.type}</p>
              <p className="text-sm font-semibold text-foreground">VALUE</p>
              <p className="text-sm font-semibold text-foreground">{h.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
