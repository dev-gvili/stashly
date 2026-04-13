'use client'

import { Badge } from '@/ui/badge'
import { Card, CardContent } from '@/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/ui/input-group'
import { FilterIcon } from '@/components/icons'
import { Separator } from '@/ui/separator'
import { cn } from '@/utils/styles'
import * as React from 'react'

const tabs = ['Stocks', 'ETFs', 'REITs']

export function StockHoldingsCard() {
  const [activeTab, setActiveTab] = React.useState('ETFs')

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <FilterIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Search holdings or tickers..." />
        </InputGroup>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <Badge
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-xs transition-colors"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Badge>
          ))}
        </div>
        <Separator />
        <div className="flex items-center gap-3">
          <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
            <span className="text-xs font-bold">VOO</span>
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">Vanguard S&P 500 ETF</span>
            <span className="text-muted-foreground text-xs">
              112 SHARES &middot; JAN 2021
            </span>
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="outline" className="mb-0.5 text-xs">
              ETF
            </Badge>
            <span className="text-xs font-medium">$48,230.40</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
