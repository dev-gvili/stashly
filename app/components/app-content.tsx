import { ScrollArea } from '@/ui/scroll-area'
import { SidebarInset } from '@/ui/sidebar'
import { AppHeader } from './app-header'
import React from 'react'
import { AppToolbar } from './app-toolbar'
import { DropZoneOverlay } from './upload/drop-zone-overlay'

const AppContent = ({ children }: { children: React.ReactNode }) => {
  const id = React.useId()
  return (
    <SidebarInset id={id} surface-elevated>
      <AppHeader />
      <ScrollArea className="h-screen pr-2 pb-10">
        <main className="mb-16 p-2">{children}</main>
        <DropZoneOverlay visible={false} />
      </ScrollArea>
      <AppToolbar />
    </SidebarInset>
  )
}
export { AppContent }
