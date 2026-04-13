"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const allNotifications = [
  {
    id: "transaction",
    label: "Transaction alerts",
    description: "Deposits, withdrawals, and transfers.",
    defaultChecked: true,
  },
  {
    id: "security",
    label: "Security alerts",
    description: "Login attempts and account changes.",
    defaultChecked: true,
  },
  {
    id: "goals",
    label: "Goal milestones",
    description: "Updates at 25%, 50%, 75%, and 100%.",
    defaultChecked: false,
  },
  {
    id: "market",
    label: "Market updates",
    description: "Daily portfolio summary and price alerts.",
    defaultChecked: false,
  },
]

export function NotificationsCard() {
  const [selectAll, setSelectAll] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({
    transaction: true,
    security: true,
    goals: false,
    market: false,
  })

  const toggleAll = (v: boolean) => {
    setSelectAll(v)
    const next: Record<string, boolean> = {}
    allNotifications.forEach((n) => { next[n.id] = v })
    setChecked(next)
  }

  const toggle = (id: string, v: boolean) => {
    const next = { ...checked, [id]: v }
    setChecked(next)
    setSelectAll(Object.values(next).every(Boolean))
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Notifications</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Choose what you want to be notified about.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {/* Select all */}
        <div className="flex items-center gap-3 py-2 border-b border-border mb-1">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={(v) => toggleAll(Boolean(v))}
          />
          <Label htmlFor="select-all" className="text-xs font-medium text-foreground cursor-pointer">
            Select all
          </Label>
        </div>

        {allNotifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 py-2">
            <Checkbox
              id={n.id}
              checked={checked[n.id]}
              onCheckedChange={(v) => toggle(n.id, Boolean(v))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={n.id} className="text-xs font-semibold text-foreground cursor-pointer">
                {n.label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
            </div>
          </div>
        ))}

        <Button className="w-full mt-3 h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  )
}
