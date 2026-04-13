import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/ui/breadcrumb'
import { Card, CardContent } from '@/ui/card'
import { ChevronRightIcon } from '@/components/icons'
import { Separator } from '@/ui/separator'

const items = [
  {
    title: 'Change transfer limit',
    description: 'Adjust how much you can send from your balance.',
  },
  {
    title: 'Scheduled transfers',
    description: 'Set up a transfer to send at a later date.',
  },
  {
    title: 'Direct Debits',
    description: 'Set up and manage regular payments.',
  },
  {
    title: 'Recurring card payments',
    description: 'Manage your repeated card transactions.',
  },
]

export function PaymentSettingsCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Payments</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator />
        <div className="flex flex-col">
          {items.map((item, i) => (
            <button
              key={item.title}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-3 text-left transition-colors"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground text-xs">
                  {item.description}
                </span>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
