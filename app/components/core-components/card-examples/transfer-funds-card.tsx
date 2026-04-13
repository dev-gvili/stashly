"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { X } from "lucide-react"

export function TransferFundsCard() {
  const [amount, setAmount] = useState("1,200.00")

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold text-foreground">Transfer Funds</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Move money between your connected accounts.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground shrink-0 -mt-1 -mr-1">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Amount to Transfer</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-6 bg-muted border-border text-foreground text-sm h-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">From Account</Label>
          <Select defaultValue="checking">
            <SelectTrigger className="bg-muted border-border text-foreground h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Main Checking (-8402) — $12,450.00</SelectItem>
              <SelectItem value="savings">High Yield Savings (-1192) — $42,100.00</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">To Account</Label>
          <Select defaultValue="savings">
            <SelectTrigger className="bg-muted border-border text-foreground h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">High Yield Savings (-1192) — $42,100.00</SelectItem>
              <SelectItem value="checking">Main Checking (-8402) — $12,450.00</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator className="bg-border" />

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated arrival</span>
            <span className="text-foreground font-medium">Today, Apr 14</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transaction fee</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-muted-foreground">Total amount</span>
            <span className="text-foreground">$1,200.00</span>
          </div>
        </div>

        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
          Confirm Transfer
        </Button>
      </CardContent>
    </Card>
  )
}
