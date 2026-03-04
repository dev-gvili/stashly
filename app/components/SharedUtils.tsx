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

// --- Styles ---
const PANEL_BG = 'bg-[#121214]'
const BORDER_COLOR = 'border-zinc-800/50'
const TEXT_MUTED = 'text-zinc-500'
const TEXT_MAIN = 'text-zinc-200'

// --- Shared Component: Technical Crosshair ---
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
      className={`absolute ${styles[position]} text-zinc-800 select-none pointer-events-none`}
    >
      +
    </div>
  )
}

// --- Shared Component: Panel Header ---
const PanelHeader = ({
  title,
  icon: Icon,
  onClose,
}: {
  title: string
  icon: any
  onClose?: () => void
}) => (
  <div
    className={`h-14 flex items-center px-6 border-b ${BORDER_COLOR} justify-between shrink-0`}
  >
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${TEXT_MUTED}`} />
      <span className="font-medium text-sm tracking-wide text-zinc-300">
        {title}
      </span>
    </div>
    {onClose && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-zinc-500 hover:text-white"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
)

// --- Shared Component: Comment Input ---
const CommentInput = () => {
  const [text, setText] = useState('')
  return (
    <div className={`p-4 border-t ${BORDER_COLOR} mt-auto`}>
      <div className="flex items-center gap-4 text-zinc-500 mb-3 px-1">
        <div className="flex gap-3">
          <ImageIcon className="h-4 w-4 hover:text-zinc-300 cursor-pointer transition-colors" />
          <Paperclip className="h-4 w-4 hover:text-zinc-300 cursor-pointer transition-colors" />
          <Mic className="h-4 w-4 hover:text-zinc-300 cursor-pointer transition-colors" />
        </div>
        <div className="ml-auto">
          <Smile className="h-4 w-4 hover:text-zinc-300 cursor-pointer transition-colors" />
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Type your comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="bg-transparent border-transparent px-0 focus-visible:ring-0 placeholder:text-zinc-600 text-sm h-9"
        />
        <Button
          size="sm"
          className="bg-zinc-700 hover:bg-zinc-600 text-white h-8 px-4 rounded-md"
        >
          Send
        </Button>
      </div>
    </div>
  )
}
