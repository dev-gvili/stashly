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
        <main className="relative h-screen w-full overflow-hidden pb-16 pr-2">
          {/* One dot field behind every route's top edge (was repeated per page).
              bg-fixed anchors the dots to the viewport so the sticky page
              toolbar, which repaints them over its own background, lines up. */}
          <div
            aria-hidden
            className="bg-dots bg-fixed mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-72"
          />
          <ScrollArea className="relative h-full w-full" type="hidden">{children}</ScrollArea>
        </main>
      </SidebarInset>
    </div>
  )
}
export { AppContent }
