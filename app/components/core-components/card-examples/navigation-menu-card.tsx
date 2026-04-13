'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toChunkArray } from '@/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  User,
  CreditCard,
  Bell,
  Shield,
  Target,
  PiggyBank,
  BarChart2,
  FileText,
  HelpCircle,
  Phone,
  Activity,
} from 'lucide-react'

const sections = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard' },
      { icon: ArrowLeftRight, label: 'Transactions' },
      { icon: TrendingUp, label: 'Investments' },
    ],
  },
  {
    label: 'Account',
    items: [
      { icon: User, label: 'Profile' },
      { icon: CreditCard, label: 'Billing' },
      { icon: Bell, label: 'Notifications' },
      { icon: Shield, label: 'Security' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { icon: Target, label: 'Goals' },
      { icon: PiggyBank, label: 'Budget' },
      { icon: BarChart2, label: 'Reports' },
      { icon: FileText, label: 'Documents' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help Center' },
      { icon: Phone, label: 'Contact Us' },
      { icon: Activity, label: 'Status' },
    ],
  },
]

export function NavigationMenuCard() {
  let navigationChunks = toChunkArray(sections, 2)
  return (
    <div className='inline-flex gap-2'>
      {navigationChunks.map((chunks) => (
        <Card className="w-full min-w-46 max-w-max">
          <CardContent className="p-0">
            {chunks.map((section, si) => (
              <div key={si}>
                {si > 0 && <Separator className="bg-border" />}
                <div className="px-3 py-3 flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                    {section.label}
                  </p>
                  {section.items.map((item, ii) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={ii}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left w-full"
                      >
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
