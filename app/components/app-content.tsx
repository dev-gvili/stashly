import { ScrollArea } from '@/ui/scroll-area'
import { SidebarInset } from '@/ui/sidebar'
import React from 'react'
import { AppHeader } from './app-header'

const AppContent = ({ children }: { children: React.ReactNode }) => {
  const id = React.useId()
  return (
    <div className="relative h-screen w-full bg-background">
      <AppHeader />
      <SidebarInset id={id} className="bg-transparent">
        <main className="h-screen w-full overflow-hidden pb-16 pr-2">
          <ScrollArea className="h-full w-full" type="hidden">{children}</ScrollArea>
        </main>
      </SidebarInset>
    </div>
  )
}
export { AppContent }
