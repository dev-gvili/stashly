'use client'

import React, { useState } from 'react'
import {
  LayoutGrid,
  Clock,
  Compass,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  MoreHorizontal,
  Music,
  Plus,
  Search,
  Settings,
  Share,
  Star,
  Trash,
  Video,
  Play,
  Edit3,
  ChevronDown,
  Grid,
  List,
  Box,
  User,
  Check,
  MoreVertical,
  Download,
  Copy,
  X,
} from 'lucide-react'

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// --- Types & Mock Data ---

type FileType = {
  id: string
  name: string
  date: string
  size: string
  duration?: string
  type: 'pdf' | 'sketch' | 'video' | 'word' | 'folder'
  shared: { fallback: string; name: string }[]
  description?: string
}

const folders = [
  {
    id: 1,
    name: 'Documents',
    count: '24 files',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: 2,
    name: 'Music',
    count: '908 files',
    icon: <Music className="h-5 w-5" />,
  },
  {
    id: 3,
    name: 'Work Project',
    count: '50 files',
    icon: <Folder className="h-5 w-5" />,
  },
  {
    id: 4,
    name: 'Personal Media',
    count: '4680 files',
    icon: <ImageIcon className="h-5 w-5" />,
  },
  {
    id: 5,
    name: 'Reddingo Backup',
    count: '19 files',
    icon: <HardDrive className="h-5 w-5" />,
  },
  { id: 6, name: 'Root', count: '97 files', icon: <Box className="h-5 w-5" /> },
]

const initialFiles: FileType[] = [
  {
    id: 'f1',
    name: 'Licence Agreement on Waterfall INC.pdf',
    date: '20.05.2021',
    size: '2.4 MB',
    type: 'pdf',
    shared: [{ fallback: 'A', name: 'Alexander' }],
    description: 'Standard license agreement for the Waterfall project phases.',
  },
  {
    id: 'f2',
    name: 'Drone Test Drive Tour.sketch',
    date: '18.05.2021',
    size: '145 MB',
    type: 'sketch',
    shared: [
      { fallback: 'N', name: 'Nick' },
      { fallback: 'G', name: 'George' },
      { fallback: 'A', name: 'Alex' },
    ],
    description: 'UI assets for the drone control interface.',
  },
  {
    id: 'f3',
    name: 'Virtual Tour Scope.mp4',
    date: '16.05.2021',
    size: '2.5 GB',
    duration: '01H:30M:45S',
    type: 'video',
    shared: [
      { fallback: 'B', name: 'Ben' },
      { fallback: 'A', name: 'Alex' },
    ],
    description:
      'I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!',
  },
  {
    id: 'f4',
    name: 'Waterfall INC Introduction.word',
    date: '12.05.2021',
    size: '845 KB',
    type: 'word',
    shared: [{ fallback: 'A', name: 'Alex' }],
    description: 'Introductory letter for new clients.',
  },
  {
    id: 'f5',
    name: 'Zoom Redesign Kit.sketch',
    date: '06.05.2021',
    size: '202 MB',
    type: 'sketch',
    shared: [
      { fallback: 'N', name: 'Nick' },
      { fallback: 'G', name: 'George' },
      { fallback: 'A', name: 'Alex' },
    ],
    description: 'Experimental redesign for Zoom UI.',
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
      className={`absolute ${styles[position]} text-zinc-700 select-none pointer-events-none`}
    >
      +
    </div>
  )
}

const FileIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-5 w-5" />
    case 'sketch':
      return <Compass className="h-5 w-5" />
    case 'video':
      return <Video className="h-5 w-5" />
    case 'word':
      return <FileText className="h-5 w-5" />
    default:
      return <FileText className="h-5 w-5" />
  }
}

// --- Main Component ---

export default function DropboxDashboard() {
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [selectedFileId, setSelectedFileId] = useState<string | null>('f3')
  const [searchQuery, setSearchQuery] = useState('')
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const selectedFile = initialFiles.find((f) => f.id === selectedFileId) || null

  // Filter files based on search
  const filteredFiles = initialFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-screen w-full bg-[#0f0f11] text-zinc-100 font-sans flex overflow-hidden selection:bg-zinc-700">
      {/* --- Sidebar Navigation --- */}
      <aside className="w-24 flex flex-col items-center py-6 border-r border-zinc-800/50 bg-[#121214] z-20">
        <div className="mb-10 text-white">
          <Box className="h-8 w-8" />
        </div>

        <nav className="flex-1 w-full flex flex-col gap-4">
          <SidebarButton icon={<LayoutGrid />} label="Home" />
          <div className="relative w-full flex justify-center">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            <SidebarButton icon={<Folder />} label="All Files" active />
          </div>
          <SidebarButton icon={<Video />} label="Videos" />
          <SidebarButton icon={<ImageIcon />} label="Photos" />
          <SidebarButton icon={<Clock />} label="Recent" />
          <SidebarButton icon={<Settings />} label="Settings" />
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              className="bg-[#1c1c1e] border-zinc-800 text-zinc-300"
            >
              <DropdownMenuItem>Upgrade Plan</DropdownMenuItem>
              <DropdownMenuItem>Help Center</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-10 w-10 border-2 border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>ME</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              className="bg-[#1c1c1e] border-zinc-800 text-zinc-300 w-56"
            >
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem className="text-red-400">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            {/* Animated Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-zinc-900/50 border-zinc-800 focus-visible:ring-0 focus-visible:border-zinc-600 w-48 focus:w-64 transition-all rounded-xl h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Content Scroll Area */}
        <ScrollArea className="flex-1 h-full">
          <div className="p-8 space-y-8 pb-20">
            {/* Breadcrumb & Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-zinc-300">
                <div className="h-10 w-10 bg-[#1e1e21] rounded-xl flex items-center justify-center border border-zinc-700/50 shadow-sm">
                  <Folder className="h-5 w-5 text-zinc-400" />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 hover:text-white transition-colors">
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-500">All Files</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-300">
                    <DropdownMenuItem>All Files</DropdownMenuItem>
                    <DropdownMenuItem>Shared</DropdownMenuItem>
                    <DropdownMenuItem>Trash</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-zinc-600">/</span>

                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 hover:text-white transition-colors font-medium">
                    <span>Personal Stuff</span>
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-300">
                    <DropdownMenuItem>Personal Stuff</DropdownMenuItem>
                    <DropdownMenuItem>Work Projects</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Right Side Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 bg-[#1e1e21] hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 cursor-pointer transition-colors">
                    <Badge
                      variant="secondary"
                      className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[10px] px-1.5 h-5"
                    >
                      9
                    </Badge>
                    <span className="text-xs text-zinc-400 font-medium">
                      Show All
                    </span>
                    <ChevronDown className="h-3 w-3 text-zinc-500" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-[#1c1c1e] border-zinc-800 text-zinc-300 w-40"
                >
                  <DropdownMenuLabel>Filter By</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuCheckboxItem checked>
                    All Types
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>Folders</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>Images</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Folder Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <Card
                  key={folder.id}
                  className="bg-[#1e1e21] border-zinc-800/60 hover:border-zinc-600 transition-all hover:bg-[#232326] group cursor-pointer hover:shadow-lg hover:shadow-black/20"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-6">
                      <div className="h-10 w-12 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 group-hover:text-zinc-200 transition-colors relative overflow-hidden border border-zinc-700/30">
                        {/* Folder visual shape */}
                        <div className="w-full h-1 absolute top-0 bg-zinc-700/50" />
                        {folder.icon}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1c1c1e] border-zinc-800 text-zinc-300"
                        >
                          <DropdownMenuItem>Open</DropdownMenuItem>
                          <DropdownMenuItem>Rename</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200 group-hover:text-white tracking-wide">
                        {folder.name}
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                        {folder.count}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Files Section Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-3 group">
                  <div className="h-10 w-10 bg-[#1e1e21] rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-400 group-hover:border-zinc-600 transition-colors">
                    <Folder className="h-5 w-5" />
                  </div>
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                  <h2 className="text-lg font-medium">All Files</h2>
                </div>

                {/* Layout Switcher */}
                <div className="flex bg-[#1e1e21] rounded-lg p-1 border border-zinc-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLayout('list')}
                    className={`h-7 w-7 p-0 rounded transition-all ${
                      layout === 'list'
                        ? 'bg-zinc-700 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLayout('grid')}
                    className={`h-7 w-7 p-0 rounded transition-all ${
                      layout === 'grid'
                        ? 'bg-zinc-700 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Files List/Grid */}
              <div
                className={
                  layout === 'grid'
                    ? 'grid grid-cols-2 xl:grid-cols-3 gap-4'
                    : 'space-y-2'
                }
              >
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`
                        group relative transition-all cursor-pointer border
                        ${
                          layout === 'grid'
                            ? 'p-4 rounded-xl flex flex-col gap-4 hover:shadow-md'
                            : 'flex items-center p-3 rounded-xl'
                        }
                        ${
                          file.id === selectedFileId
                            ? 'bg-[#27272a] border-zinc-600 shadow-inner'
                            : 'bg-[#1e1e21] border-transparent hover:bg-[#232326] hover:border-zinc-700/50'
                        }
                    `}
                  >
                    <div
                      className={`p-2.5 bg-zinc-800 rounded-lg text-zinc-400 ${
                        layout === 'list' ? 'mr-4' : 'w-fit'
                      }`}
                    >
                      <FileIcon type={file.type} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium truncate block ${
                          file.id === selectedFileId
                            ? 'text-white'
                            : 'text-zinc-300'
                        }`}
                      >
                        {file.name}
                      </span>
                      {layout === 'grid' && (
                        <span className="text-xs text-zinc-500 mt-1 block">
                          {file.size} • {file.date}
                        </span>
                      )}
                    </div>

                    {layout === 'list' && (
                      <>
                        <span className="text-xs text-zinc-500 w-24 text-right mr-8 font-mono">
                          {file.date}
                        </span>
                        <div className="flex -space-x-2 mr-6">
                          {file.shared.map((u, i) => (
                            <div
                              key={i}
                              className="h-6 w-6 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-bold text-zinc-950 ring-2 ring-[#1e1e21] z-10 relative"
                            >
                              {u.fallback}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div
                      className={`flex gap-2 text-zinc-500 ${
                        layout === 'grid' ? 'absolute top-4 right-4' : ''
                      }`}
                    >
                      <Star className="h-4 w-4 hover:text-yellow-400 transition-colors" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <MoreHorizontal className="h-4 w-4 hover:text-white transition-colors" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1c1c1e] border-zinc-800 text-zinc-300"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsShareOpen(true)
                            }}
                          >
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsEditOpen(true)
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* --- Right Sidebar (Details) --- */}
      <aside className="w-[360px] bg-[#121214] border-l border-zinc-800/50 flex flex-col shrink-0 relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
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
              <div className="p-6 space-y-8">
                {/* Preview Box */}
                <div className="relative aspect-video bg-black rounded-sm overflow-hidden group cursor-pointer border border-zinc-800 shadow-2xl">
                  <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <div className="text-zinc-700">
                      {selectedFile.type === 'video' ? (
                        <Video className="h-12 w-12 opacity-20" />
                      ) : (
                        <ImageIcon className="h-12 w-12 opacity-20" />
                      )}
                    </div>
                  </div>
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-14 w-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 group-hover:scale-110 transition-transform shadow-xl">
                      <Play className="h-5 w-5 ml-1 fill-white text-white" />
                    </div>
                  </div>

                  <div className="absolute bottom-3 right-3">
                    <Badge
                      variant="outline"
                      className="bg-black/50 border-white/10 text-white backdrop-blur-sm"
                    >
                      Preview
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1 leading-snug">
                      {selectedFile.name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                      {selectedFile.size}
                      {selectedFile.duration && `, ${selectedFile.duration}`}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
                      Description
                    </h4>
                    <p className="text-sm text-zinc-400 leading-relaxed font-light">
                      {selectedFile.description ||
                        'No description provided for this file.'}
                    </p>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Shared Users */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Shared With
                    </h4>
                    <Button
                      variant="link"
                      className="text-[10px] h-auto p-0 text-blue-400"
                    >
                      Manage Access
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedFile.shared.map((user, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 group cursor-pointer hover:bg-zinc-800/50 p-2 rounded-lg -mx-2 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 shadow-inner">
                          {user.fallback}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-zinc-200 font-medium">
                            {user.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Can Edit
                          </span>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 bg-transparent h-9 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-2" /> Add People
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Action Footer */}
            <div className="p-6 border-t border-zinc-800/50 bg-[#121214]">
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsShareOpen(true)}
                  className="h-20 flex flex-col gap-2 bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl transition-all hover:-translate-y-1"
                >
                  <Share className="h-5 w-5" />
                  <span className="text-xs font-medium">Share</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(true)}
                  className="h-20 flex flex-col gap-2 bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl transition-all hover:-translate-y-1"
                >
                  <Edit3 className="h-5 w-5" />
                  <span className="text-xs font-medium">Edit</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2 bg-transparent border-zinc-800 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400 text-zinc-400 rounded-xl transition-all hover:-translate-y-1 group"
                    >
                      <Trash className="h-5 w-5 group-hover:stroke-red-400" />
                      <span className="text-xs font-medium">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-100">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will permanently delete{' '}
                        <span className="text-white font-medium">
                          {selectedFile.name}
                        </span>{' '}
                        from your account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white text-zinc-300">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-0">
                        Delete File
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4 p-8 text-center">
            <div className="p-4 bg-zinc-800/30 rounded-full">
              <FileText className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-sm">Select a file to view details</p>
          </div>
        )}
      </aside>

      {/* --- Dialogs --- */}

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share "{selectedFile?.name}"</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Invite others to view or edit this file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 mt-2">
            <Input
              value="https://dropbox.com/s/xk34..."
              readOnly
              className="bg-zinc-950 border-zinc-700 text-zinc-300"
            />
            <Button
              size="icon"
              variant="secondary"
              className="shrink-0 bg-zinc-800 text-white hover:bg-zinc-700"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="py-4">
            <Label className="text-xs text-zinc-500 mb-2 block uppercase">
              Invite People
            </Label>
            <Input
              placeholder="Email address, name..."
              className="bg-zinc-950 border-zinc-700"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 text-xs h-8"
                  >
                    Can Edit <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#27272a] border-zinc-700 text-zinc-300">
                  <DropdownMenuItem>Can Edit</DropdownMenuItem>
                  <DropdownMenuItem>Can View</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              onClick={() => setIsShareOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-[#1c1c1e] border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label
              htmlFor="name"
              className="text-right mb-2 block text-zinc-400"
            >
              Name
            </Label>
            <Input
              id="name"
              defaultValue={selectedFile?.name}
              className="bg-zinc-950 border-zinc-700 text-white"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setIsEditOpen(false)}
              className="bg-white text-black hover:bg-zinc-200"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Sub-component for Sidebar Items
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
      className={`p-2.5 rounded-xl transition-all duration-200 ${
        active
          ? 'bg-white text-black shadow-lg shadow-white/10'
          : 'text-zinc-500 group-hover:text-zinc-200 group-hover:bg-zinc-800'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
    </div>
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
        active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'
      }`}
    >
      {label}
    </span>
  </div>
)
