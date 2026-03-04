'use client'

import React, { useState } from 'react'
import {
  LayoutGrid,
  Clock,
  Compass,
  FileText,
  Folder,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share,
  Star,
  Trash,
  Video,
  Edit3,
  ChevronDown,
  Grid,
  List,
  Box,
  X,
  FileSpreadsheet,
  Gem,
  File,
} from 'lucide-react'

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// --- Types & Mock Data ---

type FileType = {
  id: string
  name: string
  extension: string
  size: string
  date: string
  type: 'pdf' | 'sketch' | 'video' | 'word' | 'excel'
  shared: { fallback: string; name: string }[]
  isFavorite?: boolean
}

const recentFiles: FileType[] = [
  {
    id: 'r1',
    name: 'Licence Agreement on Waterfall INC',
    extension: '.pdf',
    size: '2.3 MB',
    date: '20.05.2021',
    type: 'pdf',
    shared: [{ fallback: 'A', name: 'Alex' }],
    isFavorite: true,
  },
  {
    id: 'r2',
    name: 'Drone Test Drive Tour',
    extension: '.sketch',
    size: '18.6 MB',
    date: '18.05.2021',
    type: 'sketch',
    shared: [
      { fallback: 'N', name: 'Nick' },
      { fallback: 'G', name: 'George' },
      { fallback: 'A', name: 'Alex' },
    ],
    isFavorite: false,
  },
  {
    id: 'r3',
    name: 'Drone Virtual Tour Scope',
    extension: '.mp4',
    size: '446.4 MB',
    date: '16.05.2021',
    type: 'video',
    shared: [
      { fallback: 'B', name: 'Ben' },
      { fallback: 'A', name: 'Alex' },
    ],
    isFavorite: false,
  },
  {
    id: 'r4',
    name: 'Waterfall INC Company Introduction',
    extension: '.word',
    size: '5.7 MB',
    date: '12.05.2021',
    type: 'word',
    shared: [
      { fallback: 'V', name: 'Victoria' },
      { fallback: 'A', name: 'Alex' },
    ],
    isFavorite: false,
  },
  {
    id: 'r5',
    name: 'Marketing Strategy on Waterfall INC',
    extension: '.xls',
    size: '1.6 MB',
    date: '10.05.2021',
    type: 'excel',
    shared: [{ fallback: 'A', name: 'Alex' }],
    isFavorite: false,
  },
  {
    id: 'r6',
    name: 'Zoom Redesign Kit',
    extension: '.sketch',
    size: '446.4 MB',
    date: '06.05.2021',
    type: 'sketch',
    shared: [
      { fallback: 'O', name: 'Oscar' },
      { fallback: 'K', name: 'Kate' },
      { fallback: 'B', name: 'Ben' },
      { fallback: 'A', name: 'Alex' },
    ],
    isFavorite: false,
  },
]

// --- Helper Components ---

const GridCrosshair = ({
  position,
  light = false,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  light?: boolean
}) => {
  const styles = {
    'top-left': '-top-[5px] -left-[5px]',
    'top-right': '-top-[5px] -right-[5px]',
    'bottom-left': '-bottom-[5px] -left-[5px]',
    'bottom-right': '-bottom-[5px] -right-[5px]',
  }
  return (
    <div
      className={`absolute ${styles[position]} ${light ? 'text-zinc-600' : 'text-zinc-800'} select-none pointer-events-none`}
    >
      +
    </div>
  )
}

const LargeFileIcon = ({
  type,
  className = 'h-12 w-12',
}: {
  type: string
  className?: string
}) => {
  switch (type) {
    case 'pdf':
      return <FileText className={className} />
    case 'sketch':
      return <Gem className={className} />
    case 'video':
      return <Video className={className} />
    case 'word':
      return (
        <div
          className={`${className} flex items-center justify-center font-bold font-serif`}
        >
          W
        </div>
      )
    case 'excel':
      return (
        <div
          className={`${className} flex items-center justify-center font-bold font-mono`}
        >
          X
        </div>
      )
    default:
      return <File className={className} />
  }
}

// --- Main Component ---

export default function RecentFilesPage() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>('r1')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const selectedFile = recentFiles.find((f) => f.id === selectedFileId)

  return (
    <div className="h-screen w-full bg-[#0f0f11] text-zinc-100 font-sans flex overflow-hidden selection:bg-zinc-700">
      {/* --- Sidebar --- */}
      <aside className="w-24 flex flex-col items-center py-6 border-r border-zinc-800/50 bg-[#121214] z-20">
        <div className="mb-10 text-white">
          <Box className="h-8 w-8" />
        </div>

        <nav className="flex-1 w-full flex flex-col gap-4">
          <SidebarButton icon={<LayoutGrid />} label="Home" />
          <SidebarButton icon={<Folder />} label="All Files" />
          <SidebarButton icon={<Video />} label="Videos" />
          <SidebarButton icon={<ImageIcon />} label="Photos" />

          <div className="relative w-full flex justify-center">
            {/* Active Indicator */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            <SidebarButton icon={<Clock />} label="Recent" active />
          </div>

          <SidebarButton icon={<Settings />} label="Settings" />
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white"
          >
            <MoreHorizontal />
          </Button>
          <Avatar className="h-10 w-10 border-2 border-zinc-700 cursor-pointer">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col bg-[#161618] min-w-0 relative">
        {/* Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-zinc-800/50 relative">
          <GridCrosshair position="bottom-left" />
          <GridCrosshair position="bottom-right" />

          <h1 className="text-lg font-medium tracking-tight">Dropbox</h1>

          <div className="flex items-center gap-3 text-zinc-400">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-zinc-900/50 border-zinc-800 focus-visible:ring-0 focus-visible:border-zinc-600 w-48 rounded-xl h-9 text-sm transition-all focus:w-64"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-white rounded-xl hover:bg-zinc-800"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-white rounded-xl hover:bg-zinc-800"
            >
              <Star className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1 h-full">
          <div className="p-8 space-y-8 pb-20">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-zinc-300">
                <div className="h-10 w-10 bg-[#1e1e21] rounded-xl flex items-center justify-center border border-zinc-700/50 shadow-sm">
                  <Folder className="h-5 w-5 text-zinc-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 hover:text-white font-medium text-lg">
                    <span>Recent Files</span>
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-300">
                    <DropdownMenuItem>All Files</DropdownMenuItem>
                    <DropdownMenuItem>Recent Files</DropdownMenuItem>
                    <DropdownMenuItem>Starred</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* View Toggle */}
              <div className="flex bg-[#1e1e21] rounded-lg p-1 border border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`h-7 w-7 p-0 rounded ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`h-7 w-7 p-0 rounded ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded text-zinc-500 hover:text-white"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* File Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recentFiles.map((file) => (
                <Card
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`
                            bg-[#1e1e21] transition-all cursor-pointer group relative overflow-visible
                            ${file.id === selectedFileId ? 'border-zinc-600 ring-1 ring-zinc-600' : 'border-zinc-800 hover:border-zinc-700'}
                        `}
                >
                  <CardContent className="p-0">
                    {/* Top Section */}
                    <div className="p-5 relative">
                      <div className="flex justify-between items-start mb-4">
                        <Star
                          className={`h-5 w-5 ${file.isFavorite ? 'fill-zinc-500 text-zinc-500' : 'text-zinc-700 hover:text-zinc-500'}`}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -mr-2 text-zinc-600 hover:text-zinc-300"
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-[#1c1c1e] border-zinc-800 text-zinc-300"
                          >
                            <DropdownMenuItem>Open</DropdownMenuItem>
                            <DropdownMenuItem>Download</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-400">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Centered Large Icon */}
                      <div className="flex flex-col items-center justify-center gap-4 mb-2">
                        <div className="h-20 w-20 rounded-2xl bg-[#2c2c30] flex items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                          <LargeFileIcon
                            type={file.type}
                            className="h-10 w-10 stroke-[1.5]"
                          />
                        </div>
                        <div className="text-center px-4">
                          <h3 className="text-sm font-medium text-zinc-200 leading-snug">
                            {file.name}
                            {file.extension}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Technical Separator */}
                    <div className="relative w-full h-px bg-zinc-800 my-0">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 text-zinc-700 text-[10px]">
                        +
                      </div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-zinc-700 text-[10px]">
                        +
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider mb-0.5">
                          Filesize:
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {file.size}
                        </p>
                      </div>

                      <div className="flex -space-x-1.5">
                        {file.shared.map((u, i) => (
                          <div
                            key={i}
                            className="h-6 w-6 rounded bg-zinc-500 flex items-center justify-center text-[10px] font-bold text-zinc-900 ring-2 ring-[#1e1e21] hover:z-10 hover:scale-110 transition-all cursor-help"
                            title={u.name}
                          >
                            {u.fallback}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* --- Right Sidebar (Details) --- */}
      <aside className="w-[340px] bg-[#121214] border-l border-zinc-800/50 flex flex-col shrink-0 relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)]">
        <GridCrosshair position="top-left" />
        <GridCrosshair position="bottom-left" />

        {selectedFile ? (
          <>
            <div className="h-16 flex items-center px-6 border-b border-zinc-800/50 justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" />
                <span className="font-medium text-sm tracking-wide">
                  File Preview
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-zinc-500 hover:text-white"
                onClick={() => setSelectedFileId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8 space-y-8">
                {/* Big Icon Preview */}
                <div className="aspect-square bg-[#1e1e21] rounded-3xl flex items-center justify-center border border-zinc-800 relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent rounded-3xl pointer-events-none" />
                  <div className="h-32 w-32 bg-[#2c2c30] rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
                    <LargeFileIcon
                      type={selectedFile.type}
                      className="h-16 w-16 text-zinc-400 stroke-1"
                    />
                  </div>
                </div>

                {/* Title & Metadata */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white leading-tight">
                    {selectedFile.name}
                    <br />
                    {selectedFile.extension}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    {selectedFile.size}, {selectedFile.date}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-zinc-400">
                    File Description
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    I literally just learned that my favorite board game in the
                    whole world (Monopoly) is based on Atlantic City!
                  </p>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Shared With List */}
                <div>
                  <h4 className="text-xs font-medium text-zinc-400 mb-4">
                    File Shared With:
                  </h4>
                  <div className="space-y-3">
                    {selectedFile.shared.map((user, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 -mx-2 transition-colors cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded bg-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-900">
                          {user.fallback}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-300">
                            {user.name} {user.name === 'Alex' && '(You)'}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Can Edit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="p-6 border-t border-zinc-800/50">
              <div className="grid grid-cols-3 gap-4">
                <ActionButton icon={<Share />} label="Share" />
                <ActionButton icon={<Edit3 />} label="Edit" />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-16 flex flex-col gap-1.5 bg-transparent border-zinc-800 hover:bg-red-950/20 hover:border-red-900/50 hover:text-red-400 text-zinc-400 rounded-xl transition-all hover:-translate-y-1"
                    >
                      <Trash className="h-4 w-4" />
                      <span className="text-[10px]">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-100">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete File</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Are you sure you want to delete {selectedFile.name}?
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2">
            <div className="p-4 bg-zinc-800/30 rounded-2xl mb-2">
              <Folder className="h-6 w-6 opacity-50" />
            </div>
            <p className="text-xs">Select a file</p>
          </div>
        )}
      </aside>
    </div>
  )
}

const SidebarButton = ({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) => (
  <div className="flex flex-col items-center justify-center gap-1 py-2 cursor-pointer group w-full relative">
    <div
      className={`p-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-zinc-500 group-hover:text-zinc-200 group-hover:bg-zinc-800'}`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
    </div>
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}
    >
      {label}
    </span>
  </div>
)

const ActionButton = ({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) => (
  <Button
    variant="outline"
    className="h-16 flex flex-col gap-1.5 bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl transition-all hover:-translate-y-1"
  >
    {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
    <span className="text-[10px]">{label}</span>
  </Button>
)
