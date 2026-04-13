"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  RefreshCcw,
  ChevronRight,
} from "lucide-react"

const paymentActions = [
  {
    icon: ArrowLeftRight,
    label: "Change transfer limit",
    description: "Adjust how much you can send from your balance.",
  },
  {
    icon: CalendarClock,
    label: "Scheduled transfers",
    description: "Set up a transfer to send at a later date.",
  },
  {
    icon: CreditCard,
    label: "Direct Debits",
    description: "Set up and manage regular payments.",
  },
  {
    icon: RefreshCcw,
    label: "Recurring card payments",
    description: "Manage your repeated card transactions.",
  },
]

export function PaymentsCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Home</span>
          <span className="text-xs text-muted-foreground">›</span>
          <span className="text-xs text-muted-foreground">···</span>
          <span className="text-xs text-muted-foreground">›</span>
          <span className="text-xs text-foreground font-medium">Payments</span>
        </div>

        {/* Actions */}
        {paymentActions.map((action, i) => {
          const Icon = action.icon
          return (
            <button
              key={i}
              className="w-full flex items-center gap-3 px-5 py-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
