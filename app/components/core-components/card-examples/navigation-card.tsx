'use client'

import { Card, CardContent } from '@/ui/card'
import { Separator } from '@/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { cn } from "@/utils"


const sections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', active: true },
      { label: 'Transactions', active: false },
      { label: 'Investments', active: false },
    ],
  },
  {
    title: 'Planning',
    items: [
      { label: 'Goals', active: false },
      { label: 'Budget', active: false },
      { label: 'Reports', active: false },
      { label: 'Documents', active: false },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', active: false },
      { label: 'Billing', active: true },
      { label: 'Notifications', active: false },
      { label: 'Security', active: false },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help Center', active: false },
      { label: 'Contact Us', active: false },
      { label: 'Status', active: false },
    ],
  },
]

export function NavigationCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <span className="text-muted-foreground mb-1 text-xs font-medium">
                {section.title}
              </span>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    item.active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <Separator />
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  )
}
