import { ScrollArea } from '@/ui/scroll-area'
import { SidebarInset } from '@/ui/sidebar'
import { AppHeader } from './app-header'
import React from 'react'
import { AppToolbar } from './app-toolbar'
import { DropZoneOverlay } from './upload/drop-zone-overlay'

const AppContent = ({ children }: { children: React.ReactNode }) => {
  const id = React.useId()
  return (
    <div className="relative h-screen w-full">
      <AppHeader />
      <SidebarInset id={id}>
        <main className="h-screen w-full overflow-hidden pb-24">
          <ScrollArea className="h-full w-full px-2">{children}</ScrollArea>
        </main>
      </SidebarInset>
    </div>
  )
}
export { AppContent }
