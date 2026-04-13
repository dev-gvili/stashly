"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Car, Tv, MoreHorizontal } from "lucide-react"

const transactions = [
  {
    icon: Car,
    name: "Uber Technologies",
    category: "Transport",
    date: "Oct 11",
    amount: "-$24.10",
  },
  {
    icon: Tv,
    name: "Netflix Subscription",
    category: "Entertainment",
    date: "Oct 10",
    amount: "-$19.99",
  },
]

export function TransactionListCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {transactions.map((tx, i) => {
          const Icon = tx.icon
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-4 border-b border-border last:border-b-0"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tx.name}</p>
                <p className="text-xs text-muted-foreground">{tx.category}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">{tx.date}</span>
                <span className="text-sm font-medium text-foreground">{tx.amount}</span>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
