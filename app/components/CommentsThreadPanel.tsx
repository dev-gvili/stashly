'use client'

import React, { useState } from 'react'
import {
  FileText,
  X,
  Share,
  Edit3,
  Trash,
  Paperclip,
  Mic,
  Smile,
  Send,
  Reply,
  Image as ImageIcon,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from './ui/sidebar'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './ui/input-group'
import {
  RiEmojiStickerLine,
  RiMicLine,
  RiStickyNoteAddLine,
} from '@remixicon/react'

// --- Styles ---
const PANEL_BG = 'bg-sidebar'
const BORDER_COLOR = 'border-sidebar'
const TEXT_MUTED = 'text-muted-foreground'
const TEXT_MAIN = 'text-sidebar-foreground'

// --- Shared Component: Technical Crosshair ---
export const GridCrosshair = ({
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
      className={`absolute ${styles[position]} text-muted-foreground select-none pointer-events-none size-4 `}
    >
      +
    </div>
  )
}

// --- Shared Component: Panel Header ---
const PanelHeader = ({
  title,
  icon: Icon,
  sidebarId,
}: {
  title: string
  icon: any
  sidebarId: string
}) => {
  let { setOpen, toggleSidebar } = useSidebar()
  return (
    <SidebarHeader
      className={`flex flex-row border-b ${BORDER_COLOR} items-center justify-between gap-3`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${TEXT_MUTED}`} />
        <span className="font-medium text-sm tracking-wide text-zinc-300">
          {title}
        </span>
      </div>
      <SidebarTrigger asChild sidebarId={sidebarId}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-500 hover:text-white"
          onClick={toggleSidebar}
        >
          <X className="h-4 w-4" />
        </Button>
      </SidebarTrigger>
    </SidebarHeader>
  )
}

// --- Shared Component: Comment Input ---
export const CommentInput = () => {
  const [text, setText] = useState('')
  return (
    <SidebarFooter className="bg-muted text-stashly text-muted-foreground">
      <InputGroup className="w-full shadow-none!  border-none! ring-0! has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-none has-[[data-slot=input-group-control]:focus-visible]:outline-none gap-y-2">
        <InputGroupAddon
          align="block-end"
          className="flex-1 flex justify-between items-center gap-2"
        >
          <InputGroupInput placeholder="Type your comment..." />
          <InputGroupButton variant="default" className="rounded" size="xs">
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
          <InputGroupButton variant="ghost" className="rounded" size="icon-xs">
            <RiEmojiStickerLine />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </SidebarFooter>
  )
}

export const CommentsPanelThreaded = () => {
  return (
    <Sidebar variant="inset">
      {/* <GridCrosshair position="top-left" />
        <GridCrosshair position="top-right" />
        <GridCrosshair position="bottom-left" />
        <GridCrosshair position="bottom-right" /> */}
      <PanelHeader
        title="Comments"
        icon={FileText}
        sidebarId="comments_threaded"
      />

      <SidebarContent>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Standalone Comment */}
            <div className="bg-[#1e1e21] p-4 rounded-xl border border-zinc-800/50 relative group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 bg-muted text-muted-foreground text-sm font-stashly">
                    <AvatarFallback>M</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-bold text-zinc-300">
                      Miles O'Bennon
                    </p>
                    <p className="text-[10px] text-zinc-500">2 hours ago</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hey everyone! We need to polish this stuff as soon as possible.
                There are a lot of things that needs to be reworked...
              </p>
            </div>

            {/* Threaded Group */}
            <div className="relative space-y-6 pl-4">
              {/* Thread Line */}
              <div className="absolute left-0 top-4 bottom-12 w-px bg-zinc-700/50" />

              {/* Thread Item 1 */}
              <div className="relative">
                <div className="absolute -left-4 top-1/2 w-3 h-px bg-zinc-700/50" />
                <div className="bg-[#1e1e21] p-4 rounded-xl border border-zinc-800/50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 bg-zinc-700 text-[10px]">
                        <AvatarFallback>G</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold text-zinc-300">
                          George Williamson
                        </p>
                        <p className="text-[10px] text-zinc-500">35 min ago</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Take a closer look at this chapter, I think we need to
                    rewrite that...
                  </p>
                </div>
              </div>

              {/* Thread Item 2 */}
              <div className="relative">
                <div className="absolute -left-4 top-1/2 w-3 h-px bg-zinc-700/50" />
                <div className="bg-[#1e1e21] p-4 rounded-xl border border-zinc-800/50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 bg-zinc-700 text-[10px]">
                        <AvatarFallback>G</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold text-zinc-300">
                          George Williamson
                        </p>
                        <p className="text-[10px] text-zinc-500">35 min ago</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Also check out the spelling!!!
                  </p>
                </div>
              </div>

              {/* Thread Item 3 */}
              <div className="relative">
                <div className="absolute -left-4 top-1/2 w-3 h-px bg-zinc-700/50" />
                <div className="bg-[#1e1e21] p-4 rounded-xl border border-zinc-800/50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 bg-zinc-700 text-[10px]">
                        <AvatarFallback>A</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold text-zinc-300">
                          Alexander (You)
                        </p>
                        <p className="text-[10px] text-zinc-500">32 min ago</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Already did that, as well as the spelling.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SidebarContent>
      <CommentInput />
    </Sidebar>
  )
}

export const FilePreviewPanel = () => {
  return (
    <Sidebar id="file_right" side="right" variant="floating">
      <ScrollArea className="flex-1">
        <div className="p-8 space-y-8">
          <PanelHeader
            title="File Preview"
            icon={FileText}
            sidebarId="file_right"
          />
          {/* Icon Preview */}
          <div className="aspect-square bg-[#1e1e21] rounded-3xl flex items-center justify-center border border-zinc-800 relative">
            {/* Crosshairs inside preview */}
            <GridCrosshair position="top-left" />
            <GridCrosshair position="top-right" />
            <GridCrosshair position="bottom-left" />
            <GridCrosshair position="bottom-right" />

            <div className="h-24 w-24 bg-[#2c2c30] rounded-2xl flex items-center justify-center shadow-2xl">
              <FileText className="h-12 w-12 text-zinc-400" />
            </div>
          </div>

          {/* Title & Metadata */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white leading-snug">
              Licence Agreement on Waterfall INC.pdf
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
              2.5 GB, 01H:30M:45S
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">
              File Description
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              I literally just learned that my favorite board game in the whole
              world (Monopoly) is based on Atlantic City!
            </p>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Shared With List */}
          <div>
            <h4 className="text-xs font-medium text-zinc-400 mb-4">
              File Shared With:
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-900">
                  G
                </div>
                <span className="text-xs text-zinc-400">George Williamson</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-900">
                  A
                </div>
                <span className="text-xs text-zinc-400">
                  Alexander Mikolaenko (You)
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-6 border-t border-zinc-800/50">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-16 flex flex-col gap-1.5 bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl"
          >
            <Share className="h-4 w-4" />
            <span className="text-[10px]">Share</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex flex-col gap-1.5 bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl"
          >
            <Edit3 className="h-4 w-4" />
            <span className="text-[10px]">Edit</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex flex-col gap-1.5 bg-transparent border-zinc-800 hover:bg-red-950/20 hover:border-red-900/50 hover:text-red-400 text-zinc-400 rounded-xl"
          >
            <Trash className="h-4 w-4" />
            <span className="text-[10px]">Delete</span>
          </Button>
        </div>
      </div>
    </Sidebar>
  )
}

export const CommentsPanelList = () => {
  return (
    <Sidebar id="comments_list" side="right" variant="floating">
      <GridCrosshair position="top-left" />
      <GridCrosshair position="top-right" />
      <GridCrosshair position="bottom-left" />
      <GridCrosshair position="bottom-right" />

      <PanelHeader title="Comments" icon={FileText} sidebarId="comments_list" />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {/* Comment 1 */}
          <div className="flex gap-3 group">
            <Avatar className="h-8 w-8 bg-zinc-700 text-xs mt-1">
              <AvatarFallback>M</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-zinc-200">
                    Miles O'Bennon
                  </span>
                  <span className="text-[10px] text-zinc-500">2 hours ago</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hey everyone! We need to polish this stuff as soon as possible.
                There are a lot of things that needs to be reworked...
              </p>
            </div>
          </div>

          {/* Comment 2 */}
          <div className="flex gap-3 group">
            <Avatar className="h-8 w-8 bg-zinc-700 text-xs mt-1">
              <AvatarFallback>G</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-zinc-200">
                    George Williamson
                  </span>
                  <span className="text-[10px] text-zinc-500">35 min ago</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Take a closer look at this chapter, I think we need to rewrite
                that...
              </p>
            </div>
          </div>

          {/* Comment 3 */}
          <div className="flex gap-3 group">
            <Avatar className="h-8 w-8 bg-zinc-700 text-xs mt-1">
              <AvatarFallback>G</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-zinc-200">
                    George Williamson
                  </span>
                  <span className="text-[10px] text-zinc-500">35 min ago</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Also check out the spelling!!!
              </p>
            </div>
          </div>

          {/* Comment 4 */}
          <div className="flex gap-3 group">
            <Avatar className="h-8 w-8 bg-zinc-700 text-xs mt-1">
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-zinc-200">
                    Alexander (You)
                  </span>
                  <span className="text-[10px] text-zinc-500">32 min ago</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Already did that, as well as the spelling, check the updates...
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
      <CommentInput />
    </Sidebar>
  )
}

export default function PanelsShowcase() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20 overflow-x-auto">
      <div className="text-center mb-16 space-y-4">
        <div className="flex items-center justify-center gap-8 text-zinc-700 mb-8">
          <span>+</span>
          <span>+</span>
          <span>+</span>
          <span>+</span>
        </div>
        <h2 className="text-zinc-400 text-sm tracking-[0.3em] font-medium uppercase">
          Two Types of Comments & Details
        </h2>
      </div>

      <SidebarProvider>
        {/* 1. Threaded Card Style */}
        <CommentsPanelThreaded />

        {/* 2. File Detail Style */}
        <FilePreviewPanel />

        {/* 3. Clean List Style */}
        <CommentsPanelList />
      </SidebarProvider>

      <div className="mt-20 text-center text-zinc-500 text-sm font-mono tracking-widest uppercase">
        06. POPUP SCREENS
      </div>
    </div>
  )
}
