"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function DistributionCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processing Fee</span>
            <span className="text-foreground font-medium">-$0.00</span>
          </div>
          <Separator className="bg-border" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Ready to Claim</span>
            <span className="text-foreground font-semibold">$0.00 USD</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Once your bank is connected, balances over $10.00 are automatically
          eligible for monthly distribution on the 15th of each month.
        </p>
      </CardContent>
    </Card>
  )
}
