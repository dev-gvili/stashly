'use client'

import React, { useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Minus,
  Plus,
  Printer,
  BarChart2,
} from 'lucide-react'

// UI Components
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './ui/sidebar'
import {
  RiCornerUpLeftLine,
  RiDiscussFill,
  RiEmojiStickerLine,
  RiFileTextLine,
  RiLayoutLeft2Line,
  RiMicLine,
  RiStickyNoteAddLine,
  RiFullscreenLine,
} from '@remixicon/react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './ui/input-group'

// --- Types & Data ---

const comments = [
  {
    id: 1,
    user: "Miles O'Bennon",
    initial: 'M',
    time: '2 hours ago',
    text: 'Hey everyone! We need to polish this stuff as soon as possible. There are a lot of things that needs to be reworked, rewritten and etc.',
  },
  {
    id: 2,
    user: 'George Williamson',
    initial: 'G',
    time: '35 min ago',
    text: 'Take a closer look at this chapter, i think we need to rewrite that...',
  },
  {
    id: 3,
    user: 'George Williamson',
    initial: 'G',
    time: '35 min ago',
    text: 'Also check out the spelling!!!',
  },
  {
    id: 4,
    user: 'Alexander Mikolaenko',
    initial: 'A',
    time: '32 min ago',
    text: 'Already did that, as well as the spelling, check the updates and please give a feedback assoon as possible.',
  },
  {
    id: 5,
    user: 'George Williamson',
    initial: 'G',
    time: '24 min ago',
    text: 'Great work Alexander! Congrats!',
  },
]

// --- Helper Components ---

const GridCrosshair = ({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}) => {
  const styles = {
    'top-left': '-top-[5px] -left-[5px]',
    'top-right': '-top-[5px] -right-[5px]',
    'bottom-left': '-bottom-[5px] -left-[5px]',
    'bottom-right': '-bottom-[5px] -right-[5px]',
  }
  return (
    <div
      className={`absolute ${styles[position]} text-muted-foreground select-none pointer-events-none`}
    >
      +
    </div>
  )
}

// Simulated Text Lines for Thumbnails
const SkeletonLines = () => (
  <div className="space-y-2 p-2 opacity-45">
    <div className="h-0.5 w-3/4 bg-muted-foreground mx-auto mb-2" />
    <div className="h-0.5 w-full bg-muted-foreground" />
    <div className="h-0.5 w-5/6 bg-muted-foreground" />
    <div className="h-0.5 w-full bg-muted-foreground" />
    <div className="h-0.5 w-4/5 bg-muted-foreground" />
    <div className="h-0.5 w-full bg-muted-foreground" />
    <div className="h-0.5 w-1/2 bg-muted-foreground" />
    <div className="mt-2 h-0.5 w-full bg-muted-foreground" />
    <div className="h-0.5 w-5/6 bg-muted-foreground" />
    <div className="h-0.5 w-full bg-muted-foreground" />
  </div>
)

// --- Main Component ---

export default function DocumentViewerPage() {
  const [activePage, setActivePage] = useState(1)
  // refs to the thumbnail DOM nodes so we can scroll them into view when
  // the page changes via next/prev buttons.
  const thumbnailRefs = React.useRef<Record<number, HTMLDivElement | null>>({})

  const gotoPage = (page: number, { scroll = false } = {}) => {
    const next = Math.max(1, Math.min(5, page))
    setActivePage(next)
    if (scroll) {
      const el = thumbnailRefs.current[next]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }
    }
  }
  const [zoom, setZoom] = useState(100)
  // Fullscreen handling: reference to the viewer element and state
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false)

  const toggleFullscreen = async () => {
    if (typeof document === 'undefined') return
    try {
      if (!document.fullscreenElement) {
        const el = viewerRef.current ?? document.documentElement
        if (el && typeof (el as any).requestFullscreen === 'function') {
          await (el as any).requestFullscreen()
        }
      } else {
        if (typeof document.exitFullscreen === 'function')
          await document.exitFullscreen()
      }
    } finally {
      setIsFullscreen(
        !!(typeof document !== 'undefined' && document.fullscreenElement)
      )
    }
  }

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    if (typeof document !== 'undefined')
      document.addEventListener('fullscreenchange', onChange)
    return () => {
      if (typeof document !== 'undefined')
        document.removeEventListener('fullscreenchange', onChange)
    }
  }, [])

  // content refs used only when in fullscreen + zoom != 100 to allow scroll
  // (keeps layout unchanged for normal use). We measure the scaled content and
  // set wrapper dimensions so the ScrollArea has correct scrollable size.
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const contentWrapperRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isFullscreen || zoom === 100) {
      if (contentWrapperRef.current) {
        contentWrapperRef.current.style.width = ''
        contentWrapperRef.current.style.height = ''
      }
      return
    }

    const el = contentRef.current
    const wrapper = contentWrapperRef.current
    if (!el || !wrapper) return

    const id = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      wrapper.style.width = `${Math.ceil(r.width)}px`
      wrapper.style.height = `${Math.ceil(r.height)}px`
    })

    return () => cancelAnimationFrame(id)
  }, [isFullscreen, zoom, activePage])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50))

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '20rem',
          '--sidebar-width-mobile': '20rem',
        } as React.CSSProperties
      }
    >
      <TooltipProvider>
        {/* --- Left Sidebar: Thumbnails --- */}
        <Sidebar
          id="left"
          side="left"
          variant="sidebar"
          collapsible="offcanvas"
          width="12rem"
        >
          {/* Header */}
          <SidebarHeader className="p-5 border-b border-sidebar flex flex-row items-start gap-1 w-full">
            <FileText className="h-4 w-4 text-sidebar-foreground" />
            <span className="font-medium text-sm tracking-wide">Pages</span>
          </SidebarHeader>

          <SidebarContent className="h-full overflow-hidden">
            {/* Thumbnails List */}
            <ScrollArea className="flex-1 h-full" type={undefined}>
              <div className="flex flex-col items-center gap-8 py-6">
                {[1, 2, 3, 4, 5].map((page) => (
                  <div
                    key={page}
                    className="flex flex-col items-center gap-3 group cursor-pointer"
                    ref={(el) => {
                      thumbnailRefs.current[page] = el
                    }}
                    onClick={() => gotoPage(page)}
                  >
                    <div
                      className={`
                                w-32 h-44 bg-muted rounded transition-all duration-200 relative overflow-hidden
                                ${
                                  activePage === page
                                    ? 'ring-2 ring-muted-foreground  shadow-lg scale-105'
                                    : 'opacity-60 group-hover:opacity-100'
                                }
                            `}
                    >
                      <SkeletonLines />
                      {/* Gradient Overlay for dimming */}
                      {activePage !== page && (
                        <div className="absolute inset-0 bg-muted" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-stashly ${
                        activePage === page
                          ? 'text-white font-bold'
                          : 'text-zinc-500'
                      }`}
                    >
                      {page}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        {/* --- Center: Document Canvas --- */}
        <SidebarInset className="h-screen overflow-hidden relative">
          {/* Header */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-sidebar shrink-0 w-full z-10 bg-sidebar *:text-sidebar-foreground *:font-stashly">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>

            <h1 className="text-sm font-medium text-sidebar-foreground font-stashly">
              Licence Agreement on Waterfall INC.pdf
            </h1>

            <div className="flex items-center gap-2">
              <Tooltip asChild content="Stats">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg h-9 w-9"
                >
                  <BarChart2 className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip asChild content="File Preview">
                <Button variant="ghost" size="icon">
                  <RiFileTextLine className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip asChild content="Toggle Comments">
                <SidebarTrigger asChild sidebarId="right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                  >
                    <RiDiscussFill className="h-4 w-4" />
                  </Button>
                </SidebarTrigger>
              </Tooltip>
            </div>
          </header>

          {/* Document Scroll Area */}
          <ScrollArea
            ref={viewerRef}
            className="h-full min-h-[calc(100vh-64px)] mb-12"
            type={undefined}
          >
            <div className="flex-1 relative  flex justify-center md:p-16 pb-32">
              {/* The Document Page */}
              <div
                className="bg-muted *:text-muted-foreground border-border border w-full max-w-4xl min-h-[1000px] shadow-2xl  md:p-16  transition-transform duration-200 ease-out origin-top font-stashly"
                style={{ transform: `scale(${zoom / 100})` }}
              >
                {activePage === 1 && (
                  <div className="space-y-8">
                    <div className="text-center space-y-4 mb-12">
                      <h3 className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
                        Waterfall Inc
                      </h3>
                      <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
                        Software End User License Agreement
                      </h1>
                    </div>

                    <div className="space-y-6 text-pretty text-sm leading-7 text-muted-foreground font-stashly wrap-break-word">
                      <p>
                        This End User License Agreement ("License") is an
                        agreement between you and Electronic Arts Inc, its
                        subsidiaries and affiliates ("EA"). This License governs
                        your use of this application and all related software,
                        documentation, and updates and upgrades that replace or
                        supplement the application and are not distributed with
                        a separate license (together, the "Application"). This
                        Application is licensed to you free of charge. You do
                        not own the Application.
                      </p>
                      <p>
                        By installing or using the Application, you consent to
                        be bound by this License. Sections 1.C and 2 below
                        describe the data EA may collect and use in the course
                        of providing services and support to you in connection
                        with the Application. Section 3, below, describes your
                        Origin privacy settings and how they affect the
                        disclosure of your information within this Application
                        and on Origin services in the mobile environment.
                        Section 17, below, requires all disputes that cannot be
                        informally resolved between us to be submitted to
                        binding arbitration on an individual basis. If you do
                        not agree to any portion of this License, do not install
                        or use the Application.
                      </p>

                      <div className="pt-4">
                        <h4 className="text-sm font-bold text-foreground mb-2 font-stashly">
                          1. License Grant and Terms of Use.
                        </h4>
                        <p>
                          A. Grant. EA grants you a personal, limited,
                          non-exclusive license to install and use the
                          Application for your personal, noncommercial use
                          solely as set forth in this License and any
                          accompanying documentation. Your acquired rights are
                          subject to your compliance with this License. Any
                          commercial use is prohibited. You are expressly
                          prohibited from sublicensing, renting, leasing or
                          otherwise distributing the Application or rights to
                          use the Application.
                        </p>
                      </div>
                      <p>
                        B. Copies. You may download this Application from an
                        authorized source. The number of copies that you can
                        download during a consecutive period of days may be
                        limited. You may not make a copy of the Application
                        available on a network where it could be used by
                        multiple users at the same time. You may not make the
                        Application available over a network where it could be
                        used by multiple users at the same time.
                      </p>
                    </div>
                  </div>
                )}
                {activePage > 1 && (
                  <div className="flex items-center justify-center h-full min-h-[800px]">
                    <p className="text-muted-foreground uppercase tracking-widest">
                      Page {activePage} Content Placeholder
                    </p>
                  </div>
                )}
              </div>

              {/* Floating Toolbar */}
              <div className="fixed bottom-4 z-50 flex justify-center shadow-2xl">
                <div className="flex items-center gap-1 bg-sidebar backdrop-blur-md border border-border p-2 rounded w-full max-w-max *:text-muted-foreground">
                  <Tooltip asChild content="Toggle Pages">
                    <SidebarTrigger asChild sidebarId="left">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-md"
                      >
                        <RiLayoutLeft2Line className="h-4 w-4" />
                      </Button>
                    </SidebarTrigger>
                  </Tooltip>

                  <Separator orientation="vertical" className="h-4!" />

                  <Tooltip asChild content="Previous Page">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => gotoPage(activePage - 1, { scroll: true })}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </Tooltip>

                  <span className="text-xs font-stashly w-12 text-center text-zinc-300">
                    {activePage} / 5
                  </span>

                  <Tooltip asChild content="Next Page">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => gotoPage(activePage + 1, { scroll: true })}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-4!" />

                  <Tooltip asChild content="Zoom Out">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </Tooltip>

                  <span className="text-xs font-stashly w-12 text-center text-muted-foreground">
                    {zoom}%
                  </span>

                  <Tooltip asChild content="Zoom In">
                    <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Tooltip>

                  <Separator orientation="vertical" className="h-4!" />

                  <Tooltip
                    asChild
                    content={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleFullscreen}
                      aria-pressed={isFullscreen}
                    >
                      <RiFullscreenLine className="h-4 w-4" />
                    </Button>
                  </Tooltip>

                  <Tooltip asChild content="Print">
                    <Button variant="ghost" size="icon">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </Tooltip>

                  {/* <Separator orientation="vertical" className="h-4!" /> */}

                  {/* <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarTrigger asChild sidebarId="right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-md"
                        >
                          <RiDiscussFill className="h-4 w-4" />
                        </Button>
                      </SidebarTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Toggle Comments</TooltipContent>
                  </Tooltip> */}
                </div>
              </div>
            </div>
          </ScrollArea>
        </SidebarInset>

        {/* --- Right Sidebar: Comments --- */}
        <Sidebar
          id="right"
          side="right"
          variant="sidebar"
          collapsible="offcanvas"
          className=""
        >
          <SidebarHeader className="p-5">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-sidebar-foreground" />
              <span className="font-medium text-sm tracking-wide text-muted-foreground">
                Comments
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-8">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-2 group animate-in fade-in slide-in-from-right-4 duration-500"
                  >
                    <Avatar className="bg-primary text-xs text-primary-foreground rounded">
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {comment.initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">
                            {comment.user}
                          </span>
                          <span className="text-xs text-foreground/60">
                            {comment.time}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-sidebar-foreground rounded -mt-2 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <RiCornerUpLeftLine />
                        </Button>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SidebarContent>

          {/* Input Area */}
          <SidebarFooter className="bg-muted text-stashly text-muted-foreground">
            <InputGroup className="w-full shadow-none!  border-none! ring-0! has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-none has-[[data-slot=input-group-control]:focus-visible]:outline-none gap-y-2">
              <InputGroupAddon
                align="block-end"
                className="flex-1 flex justify-between items-center gap-2"
              >
                <InputGroupInput placeholder="Type your comment..." />
                <InputGroupButton
                  variant="default"
                  className="rounded"
                  size="xs"
                >
                  <span className="font-stashly">Send</span>
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              </InputGroupAddon>
              <InputGroupAddon
                align="block-start"
                className="flex items-center gap-2 justify-between"
              >
                <div className="flex gap-1">
                  <InputGroupButton
                    variant="ghost"
                    className="rounded"
                    size="icon-xs"
                  >
                    <RiStickyNoteAddLine />
                  </InputGroupButton>
                  <InputGroupButton
                    variant="ghost"
                    className="rounded"
                    size="icon-xs"
                  >
                    <RiMicLine />
                  </InputGroupButton>
                </div>
                <InputGroupButton
                  variant="ghost"
                  className="rounded"
                  size="icon-xs"
                >
                  <RiEmojiStickerLine />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </SidebarFooter>
        </Sidebar>
      </TooltipProvider>
    </SidebarProvider>
  )
}
