import { ScrollArea } from '@/ui/scroll-area'
import { SidebarInset } from '@/ui/sidebar'
import { AppHeader } from './app-header'
import React from 'react'

const AppContent = ({ children }: { children: React.ReactNode }) => {
  const id = React.useId()
  return (
    <SidebarInset id={id}>
      <AppHeader />
      <ScrollArea className="h-screen pr-2">
        <main className="mb-16 p-2 select-none">{children}</main>
      </ScrollArea>
    </SidebarInset>
  )
}
export { AppContent }
