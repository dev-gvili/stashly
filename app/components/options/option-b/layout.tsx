import React from 'react'
import { cn } from '@/utils/styles'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
} from '@/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/popover'
import { Progress } from '@/ui/progress'
import { Input } from '@/ui/input'
import { Checkbox } from '@/ui/checkbox'
import { Switch } from '@/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

// ─── Inline SVG Icons ───────────────────────────────────────────
// All icons are inline SVGs per project rules (no lucide-react imports)

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconImage({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconMoreH({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconColumns({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconArrowUp({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function IconMusic({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconMove({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  )
}

// ─── Mock Data ─────────────────────────────────────────────────

interface MockFile {
  id: string
  name: string
  type: 'image' | 'video' | 'document' | 'audio' | 'archive' | 'other'
  size: string
  sizeBytes: number
  date: string
  thumbnail?: string
  color: string
  shared: boolean
  favorite: boolean
  owner: string
}

interface MockUser {
  id: string
  name: string
  email: string
  avatar?: string
  initials: string
}

interface MockWorkspace {
  id: string
  name: string
  icon: string
  members: number
  active: boolean
}

interface UploadFile {
  id: string
  name: string
  size: string
  progress: number
  speed: string
  status: 'uploading' | 'complete' | 'paused' | 'error'
}

const MOCK_USERS: MockUser[] = [
  { id: '1', name: 'Alon Gvili', email: 'alon@stashly.io', initials: 'AG' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@stashly.io', initials: 'SC' },
  { id: '3', name: 'Marcus Lee', email: 'marcus@stashly.io', initials: 'ML' },
  { id: '4', name: 'Eva Martinez', email: 'eva@stashly.io', initials: 'EM' },
  { id: '5', name: 'James Wright', email: 'james@stashly.io', initials: 'JW' },
]

const MOCK_WORKSPACES: MockWorkspace[] = [
  { id: '1', name: 'Stashly Team', icon: 'ST', members: 12, active: true },
  { id: '2', name: 'Design Lab', icon: 'DL', members: 5, active: false },
  { id: '3', name: 'Personal', icon: 'P', members: 1, active: false },
]

const MOCK_FILES: MockFile[] = [
  { id: '1', name: 'hero-banner-v3.png', type: 'image', size: '4.2 MB', sizeBytes: 4200000, date: 'Today', color: 'oklch(0.65 0.18 350)', shared: true, favorite: true, owner: '1' },
  { id: '2', name: 'Q4 Revenue Report.pdf', type: 'document', size: '1.8 MB', sizeBytes: 1800000, date: 'Yesterday', color: 'oklch(0.7 0.2 300)', shared: true, favorite: false, owner: '1' },
  { id: '3', name: 'product-demo.mp4', type: 'video', size: '156 MB', sizeBytes: 156000000, date: '2 days ago', color: 'oklch(0.75 0.15 190)', shared: false, favorite: false, owner: '1' },
  { id: '4', name: 'brand-guidelines.sketch', type: 'document', size: '24.5 MB', sizeBytes: 24500000, date: '3 days ago', color: 'oklch(0.7 0.2 300)', shared: true, favorite: true, owner: '2' },
  { id: '5', name: 'team-photo.jpg', type: 'image', size: '3.1 MB', sizeBytes: 3100000, date: '4 days ago', color: 'oklch(0.65 0.18 350)', shared: false, favorite: false, owner: '1' },
  { id: '6', name: 'onboarding-flow.fig', type: 'document', size: '8.7 MB', sizeBytes: 8700000, date: '5 days ago', color: 'oklch(0.7 0.2 300)', shared: true, favorite: false, owner: '3' },
  { id: '7', name: 'podcast-ep12.mp3', type: 'audio', size: '48.2 MB', sizeBytes: 48200000, date: '1 week ago', color: 'oklch(0.8 0.14 75)', shared: false, favorite: true, owner: '1' },
  { id: '8', name: 'mobile-screenshots.zip', type: 'archive', size: '67.3 MB', sizeBytes: 67300000, date: '1 week ago', color: 'oklch(0.6 0.02 280)', shared: false, favorite: false, owner: '1' },
  { id: '9', name: 'landing-page-v2.png', type: 'image', size: '2.4 MB', sizeBytes: 2400000, date: '2 weeks ago', color: 'oklch(0.65 0.18 350)', shared: true, favorite: false, owner: '2' },
  { id: '10', name: 'user-interviews.mp4', type: 'video', size: '234 MB', sizeBytes: 234000000, date: '2 weeks ago', color: 'oklch(0.75 0.15 190)', shared: true, favorite: false, owner: '4' },
  { id: '11', name: 'api-docs.md', type: 'document', size: '340 KB', sizeBytes: 340000, date: '3 weeks ago', color: 'oklch(0.7 0.2 300)', shared: false, favorite: false, owner: '1' },
  { id: '12', name: 'promo-video-cut3.mp4', type: 'video', size: '89 MB', sizeBytes: 89000000, date: '3 weeks ago', color: 'oklch(0.75 0.15 190)', shared: false, favorite: true, owner: '1' },
  { id: '13', name: 'icon-set-aurora.svg', type: 'image', size: '120 KB', sizeBytes: 120000, date: '1 month ago', color: 'oklch(0.65 0.18 350)', shared: true, favorite: false, owner: '3' },
  { id: '14', name: 'meeting-notes-apr.docx', type: 'document', size: '580 KB', sizeBytes: 580000, date: '1 month ago', color: 'oklch(0.7 0.2 300)', shared: true, favorite: false, owner: '5' },
  { id: '15', name: 'prototype-v5.fig', type: 'document', size: '15.2 MB', sizeBytes: 15200000, date: '1 month ago', color: 'oklch(0.7 0.2 300)', shared: false, favorite: false, owner: '1' },
  { id: '16', name: 'dashboard-dark.png', type: 'image', size: '1.9 MB', sizeBytes: 1900000, date: '1 month ago', color: 'oklch(0.65 0.18 350)', shared: false, favorite: true, owner: '1' },
]

const MOCK_UPLOADS: UploadFile[] = [
  { id: 'u1', name: 'presentation-final.pptx', size: '24.5 MB', progress: 72, speed: '3.2 MB/s', status: 'uploading' },
  { id: 'u2', name: 'design-assets.zip', size: '156 MB', progress: 34, speed: '5.1 MB/s', status: 'uploading' },
  { id: 'u3', name: 'logo-variants.svg', size: '340 KB', progress: 100, speed: '', status: 'complete' },
]

// Masonry heights for visual variety
const MASONRY_HEIGHTS = [180, 240, 200, 280, 160, 220, 260, 190, 250, 210, 170, 230, 200, 240, 180, 260]

// ─── Type-specific icon/color helpers ──────────────────────────

function getTypeIcon(type: MockFile['type']) {
  switch (type) {
    case 'image': return <IconImage />
    case 'video': return <IconVideo />
    case 'document': return <IconFile />
    case 'audio': return <IconMusic />
    case 'archive': return <IconFolder />
    default: return <IconFile />
  }
}

function getTypeBadgeColor(type: MockFile['type']): string {
  switch (type) {
    case 'image': return 'bg-pink-500/20 text-pink-300 border-pink-500/20'
    case 'video': return 'bg-teal-500/20 text-teal-300 border-teal-500/20'
    case 'document': return 'bg-purple-500/20 text-purple-300 border-purple-500/20'
    case 'audio': return 'bg-amber-500/20 text-amber-300 border-amber-500/20'
    case 'archive': return 'bg-slate-500/20 text-slate-300 border-slate-500/20'
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/20'
  }
}

// ─── Sub-components ────────────────────────────────────────────

// Storage progress ring SVG
function StorageRing({ used, total }: { used: number; total: number }) {
  const pct = Math.round((used / total) * 100)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <defs>
          <linearGradient id="aurora-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.7 0.2 300)" />
            <stop offset="50%" stopColor="oklch(0.75 0.15 190)" />
            <stop offset="100%" stopColor="oklch(0.75 0.18 350)" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="url(#aurora-ring-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold" style={{ color: 'oklch(0.95 0.01 280)' }}>
          {used} GB
        </span>
        <span className="text-[11px]" style={{ color: 'oklch(0.6 0.02 280)' }}>
          of {total} GB
        </span>
      </div>
    </div>
  )
}

// Storage segment bar
function StorageSegments() {
  const segments = [
    { label: 'Images', pct: 32, color: 'oklch(0.75 0.18 350)' },
    { label: 'Videos', pct: 38, color: 'oklch(0.75 0.15 190)' },
    { label: 'Docs', pct: 18, color: 'oklch(0.7 0.2 300)' },
    { label: 'Other', pct: 12, color: 'oklch(0.6 0.02 280)' },
  ]
  return (
    <div className="space-y-2">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'oklch(0.6 0.02 280)' }}>
            <div className="size-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} {s.pct}%
          </div>
        ))}
      </div>
    </div>
  )
}

// Sidebar nav item
function NavItem({
  icon,
  label,
  active = false,
  count,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  count?: number
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium transition-all duration-200',
        active
          ? 'nav-active text-white'
          : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80'
      )}
    >
      <span className={cn('flex-shrink-0', active ? 'text-white' : 'text-white/50')}>
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && (
        <span className={cn(
          'text-[11px] tabular-nums px-1.5 py-0.5 rounded-md',
          active ? 'bg-white/15 text-white/90' : 'text-white/30'
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// Sidebar section header
function NavSection({ title }: { title: string }) {
  return (
    <div className="px-3 pt-5 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.45 0.02 280)' }}>
        {title}
      </span>
    </div>
  )
}

// ─── Masonry Card ──────────────────────────────────────────────

function MasonryCard({
  file,
  height,
  onShare,
}: {
  file: MockFile
  height: number
  onShare: (file: MockFile) => void
}) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      className="glass-card group relative mb-3 cursor-pointer break-inside-avoid"
      style={{ height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail / icon area */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-t-2xl"
        style={{
          background: `linear-gradient(135deg, ${file.color} 0%, oklch(0.14 0.03 280) 100%)`,
          opacity: 0.5,
        }}
      >
        <span className="opacity-30 scale-[3]">
          {getTypeIcon(file.type)}
        </span>
      </div>

      {/* Hover checkbox */}
      <div className={cn(
        'absolute top-3 left-3 z-10 transition-opacity duration-200',
        hovered ? 'opacity-100' : 'opacity-0'
      )}>
        <div className="flex items-center justify-center size-6 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
          <Checkbox className="size-3.5 border-white/40 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500" />
        </div>
      </div>

      {/* Favorite indicator */}
      {file.favorite && (
        <div className="absolute top-3 right-3 z-10">
          <IconStar className="size-3.5 fill-amber-400 text-amber-400" />
        </div>
      )}

      {/* Hover action buttons */}
      <div className={cn(
        'absolute top-3 right-3 z-10 flex items-center gap-1.5 transition-all duration-200',
        hovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
      )}>
        <TooltipProvider delayDuration={200}>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
                onClick={(e) => { e.stopPropagation(); onShare(file) }}
              >
                <IconShare className="size-3.5 text-white/70" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Share</p></TooltipContent>
          </TooltipRoot>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
              >
                <IconHeart className="size-3.5 text-white/70" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Favorite</p></TooltipContent>
          </TooltipRoot>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
              >
                <IconMoreH className="size-3.5 text-white/70" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>More</p></TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      </div>

      {/* Bottom info overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 z-10"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <p className="text-sm font-medium text-white truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-white/50">{file.size}</span>
          <span className="text-[11px] text-white/30">·</span>
          <span className="text-[11px] text-white/50">{file.date}</span>
          {file.shared && (
            <>
              <span className="text-[11px] text-white/30">·</span>
              <IconUsers className="size-3 text-white/40" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Board Column ──────────────────────────────────────────────

function BoardColumn({
  title,
  files,
  icon,
}: {
  title: string
  files: MockFile[]
  icon: React.ReactNode
}) {
  return (
    <div className="glass flex-shrink-0 w-72 rounded-2xl flex flex-col max-h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-white/50">{icon}</span>
        <span className="text-sm font-semibold text-white/80">{title}</span>
        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-md text-white/30" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {files.length}
        </span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="glass-hover rounded-xl p-3 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center size-9 rounded-lg flex-shrink-0"
                  style={{ background: `${file.color}20` }}
                >
                  <span style={{ color: file.color }}>{getTypeIcon(file.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-white/40">{file.size}</span>
                    <span className="text-[11px] text-white/25">·</span>
                    <span className="text-[11px] text-white/40">{file.date}</span>
                  </div>
                </div>
              </div>
              {file.shared && (
                <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex -space-x-1.5">
                    {MOCK_USERS.slice(0, 2).map((u) => (
                      <div key={u.id} className="size-5 rounded-full flex items-center justify-center text-[8px] font-semibold ring-1 ring-black/30" style={{ background: 'oklch(0.7 0.2 300)' }}>
                        {u.initials}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] text-white/30 ml-1">Shared</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── List Row ──────────────────────────────────────────────────

function ListRow({
  file,
  onShare,
}: {
  file: MockFile
  onShare: (file: MockFile) => void
}) {
  return (
    <div className="glass-row flex items-center gap-4 px-4 h-[52px] group cursor-pointer">
      {/* Checkbox */}
      <Checkbox className="size-4 border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Thumbnail */}
      <div
        className="flex items-center justify-center size-10 rounded-lg flex-shrink-0"
        style={{ background: `${file.color}15` }}
      >
        <span style={{ color: file.color }}>{getTypeIcon(file.type)}</span>
      </div>

      {/* Name + path */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{file.name}</p>
        <p className="text-[11px] text-white/35 truncate">~/stash/{file.type}s/</p>
      </div>

      {/* Type badge */}
      <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize', getTypeBadgeColor(file.type))}>
        {file.type}
      </span>

      {/* Size */}
      <span className="text-sm text-white/50 w-20 text-right tabular-nums">{file.size}</span>

      {/* Date */}
      <span className="text-sm text-white/40 w-28 text-right">{file.date}</span>

      {/* Shared avatars */}
      <div className="w-20 flex items-center justify-end">
        {file.shared ? (
          <div className="flex -space-x-1.5">
            {MOCK_USERS.slice(0, 3).map((u) => (
              <div key={u.id} className="size-6 rounded-full flex items-center justify-center text-[9px] font-semibold ring-1 ring-black/40" style={{ background: 'oklch(0.3 0.04 280)' }}>
                {u.initials}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-white/20">--</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onShare(file) }}
          className="flex items-center justify-center size-7 rounded-lg hover:bg-white/[0.08] transition-colors"
        >
          <IconShare className="size-3.5 text-white/50" />
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center size-7 rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              <IconMoreH className="size-3.5 text-white/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-elevated rounded-xl border-white/10 min-w-40">
            <DropdownMenuItem className="text-white/80 focus:bg-white/[0.08] rounded-lg gap-2 cursor-pointer">
              <IconHeart className="size-3.5" /> Favorite
            </DropdownMenuItem>
            <DropdownMenuItem className="text-white/80 focus:bg-white/[0.08] rounded-lg gap-2 cursor-pointer">
              <IconMove className="size-3.5" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem className="text-white/80 focus:bg-white/[0.08] rounded-lg gap-2 cursor-pointer">
              <IconCopy className="size-3.5" /> Copy
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-400 focus:bg-red-500/10 rounded-lg gap-2 cursor-pointer">
              <IconTrash className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── Upload Panel ──────────────────────────────────────────────

function UploadPanel({
  uploads,
  open,
  onClose,
}: {
  uploads: UploadFile[]
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  const completedCount = uploads.filter((u) => u.status === 'complete').length
  const totalCount = uploads.length
  const overallProgress = Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / totalCount)

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] slide-up">
      <div className="glass-elevated rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="12"
                  fill="none"
                  stroke="oklch(0.7 0.2 300)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 12}
                  strokeDashoffset={2 * Math.PI * 12 * (1 - overallProgress / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80">
                {overallProgress}%
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">
                Uploading {totalCount - completedCount} file{totalCount - completedCount !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-white/40">
                {completedCount} of {totalCount} complete
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center justify-center size-7 rounded-lg hover:bg-white/[0.08] transition-colors">
            <IconX className="size-4 text-white/50" />
          </button>
        </div>

        {/* File list */}
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-1">
            {uploads.map((file) => (
              <div key={file.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                {/* File icon */}
                <div className="flex items-center justify-center size-8 rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <IconFile className="size-4 text-white/40" />
                </div>

                {/* Info + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-white/80 truncate pr-2">{file.name}</p>
                    {file.status === 'complete' ? (
                      <span className="check-pulse">
                        <IconCheck className="size-4 text-green-400" />
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/40 tabular-nums flex-shrink-0">
                        {file.speed}
                      </span>
                    )}
                  </div>
                  {file.status !== 'complete' && (
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="aurora-progress h-full transition-all duration-500"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-white/30">{file.size}</span>
                    {file.status === 'uploading' && (
                      <span className="text-[10px] text-white/30">{file.progress}%</span>
                    )}
                    {file.status === 'complete' && (
                      <span className="text-[10px] text-green-400/60">Complete</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {file.status === 'uploading' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button className="flex items-center justify-center size-6 rounded-md hover:bg-white/[0.08] transition-colors">
                      <IconPause className="size-3 text-white/40" />
                    </button>
                    <button className="flex items-center justify-center size-6 rounded-md hover:bg-white/[0.08] transition-colors">
                      <IconX className="size-3 text-white/40" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ─── Sharing Sheet ─────────────────────────────────────────────

function SharingSheet({
  open,
  onOpenChange,
  file,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: MockFile | null
}) {
  const [linkEnabled, setLinkEnabled] = React.useState(false)

  if (!file) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] p-0 border-l"
        style={{
          background: 'rgba(20, 15, 30, 0.95)',
          backdropFilter: 'blur(40px)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center size-12 rounded-xl flex-shrink-0"
              style={{ background: `${file.color}15` }}
            >
              <span style={{ color: file.color }}>{getTypeIcon(file.type)}</span>
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-white/90 truncate">{file.name}</SheetTitle>
              <SheetDescription className="text-white/40 text-sm">{file.size} · {file.type}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Invite people */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Invite people</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address..."
                  className="glass-input flex-1 h-10 rounded-xl text-sm"
                />
                <Button className="aurora-button h-10 rounded-xl px-4 text-sm">
                  Send
                </Button>
              </div>
            </div>

            <Separator style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Collaborators */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">People with access</h3>
              <div className="space-y-2">
                {MOCK_USERS.slice(0, 4).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="size-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'oklch(0.7 0.2 300 / 0.2)', color: 'oklch(0.85 0.1 300)' }}>
                      {user.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{user.name}</p>
                      <p className="text-[11px] text-white/35 truncate">{user.email}</p>
                    </div>
                    <Select defaultValue={user.id === '1' ? 'owner' : 'view'}>
                      <SelectTrigger className="w-28 h-8 text-[12px] rounded-lg border-white/10 bg-white/[0.04] text-white/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass-elevated rounded-xl border-white/10">
                        <SelectItem value="view" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Can view</SelectItem>
                        <SelectItem value="edit" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Can edit</SelectItem>
                        <SelectItem value="comment" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Can comment</SelectItem>
                        <SelectItem value="owner" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Full access</SelectItem>
                      </SelectContent>
                    </Select>
                    {user.id !== '1' && (
                      <button className="flex items-center justify-center size-7 rounded-lg hover:bg-white/[0.08] transition-colors">
                        <IconX className="size-3.5 text-white/30" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Link sharing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">Share via link</h3>
                <Switch
                  checked={linkEnabled}
                  onCheckedChange={setLinkEnabled}
                />
              </div>
              {linkEnabled && (
                <div className="space-y-3 glass-fade-in">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="https://stashly.io/s/a8f3k2m..."
                      className="glass-input flex-1 h-9 rounded-xl text-sm text-white/60"
                    />
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]">
                      <IconCopy className="size-3.5 mr-1.5" /> Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] text-white/40 mb-1 block">Expires</label>
                      <Select defaultValue="7d">
                        <SelectTrigger className="h-8 text-[12px] rounded-lg border-white/10 bg-white/[0.04] text-white/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-elevated rounded-xl border-white/10">
                          <SelectItem value="1d" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">1 day</SelectItem>
                          <SelectItem value="7d" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">7 days</SelectItem>
                          <SelectItem value="30d" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">30 days</SelectItem>
                          <SelectItem value="never" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <IconShield className="size-3.5 text-white/30" />
                      <span className="text-[11px] text-white/40">Password</span>
                      <Switch />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Permission presets */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Default permissions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Can view', desc: 'View & download only', active: true },
                  { label: 'Can edit', desc: 'View, edit & download', active: false },
                  { label: 'Can comment', desc: 'View & leave comments', active: false },
                  { label: 'Full access', desc: 'All permissions', active: false },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    className={cn(
                      'p-3 rounded-xl text-left transition-all',
                      preset.active
                        ? 'border-purple-500/30 bg-purple-500/10'
                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
                    )}
                    style={{ border: `1px solid ${preset.active ? 'oklch(0.7 0.2 300 / 0.3)' : 'rgba(255,255,255,0.06)'}` }}
                  >
                    <p className={cn('text-sm font-medium', preset.active ? 'text-purple-300' : 'text-white/70')}>
                      {preset.label}
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Bottom action */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(20, 15, 30, 0.9)', backdropFilter: 'blur(20px)' }}>
          <Button className="aurora-button w-full h-10 rounded-xl text-sm" onClick={() => onOpenChange(false)}>
            Done sharing
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Workspace Switcher ────────────────────────────────────────

function WorkspaceSwitcher() {
  const [activeWs, setActiveWs] = React.useState(MOCK_WORKSPACES[0])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="workspace-card flex items-center gap-3 w-full px-3 py-2.5 text-left">
          <div className="flex items-center justify-center size-9 rounded-xl aurora-gradient text-sm font-bold text-white/90 flex-shrink-0">
            {activeWs.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">{activeWs.name}</p>
            <p className="text-[11px] text-white/35">{activeWs.members} members</p>
          </div>
          <IconChevronDown className="size-4 text-white/30 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[228px] p-2 rounded-xl"
        style={{
          background: 'rgba(20, 15, 30, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="space-y-1">
          {MOCK_WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setActiveWs(ws)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left transition-all',
                ws.id === activeWs.id
                  ? 'bg-white/[0.08]'
                  : 'hover:bg-white/[0.04]'
              )}
            >
              <div className={cn(
                'flex items-center justify-center size-8 rounded-lg text-xs font-bold flex-shrink-0',
                ws.id === activeWs.id ? 'aurora-gradient text-white/90' : 'bg-white/[0.08] text-white/50'
              )}>
                {ws.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', ws.id === activeWs.id ? 'text-white/90' : 'text-white/60')}>
                  {ws.name}
                </p>
                <p className="text-[10px] text-white/30">{ws.members} member{ws.members !== 1 ? 's' : ''}</p>
              </div>
              {ws.id === activeWs.id && <IconCheck className="size-4 text-purple-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
        <Separator className="my-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left text-sm text-white/50 hover:bg-white/[0.04] hover:text-white/70 transition-colors">
          <IconPlus className="size-4" />
          Create workspace
        </button>
      </PopoverContent>
    </Popover>
  )
}

// ─── Search Overlay ────────────────────────────────────────────

function SearchOverlay({
  open,
  onClose,
  query,
}: {
  open: boolean
  onClose: () => void
  query: string
}) {
  if (!open || !query) return null

  const results = MOCK_FILES.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  )

  const grouped = {
    Files: results.filter((f) => f.type === 'document' || f.type === 'archive'),
    Images: results.filter((f) => f.type === 'image'),
    Videos: results.filter((f) => f.type === 'video'),
    Audio: results.filter((f) => f.type === 'audio'),
  }

  return (
    <div className="absolute inset-0 z-40" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(10, 8, 20, 0.7)',
          backdropFilter: 'blur(8px)',
          outline: '2px solid rgba(255,255,255,0.06)',
        }}
      />
      <div
        className="relative mx-auto mt-24 w-full max-w-2xl glass-elevated rounded-2xl overflow-hidden glass-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm text-white/40">
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
        </div>
        <ScrollArea className="max-h-96">
          <div className="p-2">
            {Object.entries(grouped).map(([category, items]) => {
              if (items.length === 0) return null
              return (
                <div key={category} className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 py-1.5">
                    {category}
                  </p>
                  {items.map((file) => (
                    <button
                      key={file.id}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left hover:bg-white/[0.06] transition-colors"
                    >
                      <div
                        className="flex items-center justify-center size-8 rounded-lg flex-shrink-0"
                        style={{ background: `${file.color}15` }}
                      >
                        <span style={{ color: file.color }}>{getTypeIcon(file.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">{file.name}</p>
                        <p className="text-[11px] text-white/30">~/stash/{file.type}s/ · {file.size}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ─── Bulk Selection Toolbar ────────────────────────────────────

function BulkToolbar({
  count,
  onClear,
}: {
  count: number
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-toolbar px-2 py-1.5 flex items-center gap-1">
      <span className="flex items-center justify-center size-7 rounded-full aurora-gradient text-xs font-bold text-white mr-1">
        {count}
      </span>
      <TooltipProvider delayDuration={200}>
        {[
          { icon: <IconMove className="size-4" />, label: 'Move' },
          { icon: <IconCopy className="size-4" />, label: 'Copy' },
          { icon: <IconShare className="size-4" />, label: 'Share' },
          { icon: <IconTrash className="size-4" />, label: 'Delete' },
        ].map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center size-9 rounded-full hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-colors">
                {action.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{action.label}</p></TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
      <Separator orientation="vertical" className="h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
      <button onClick={onClear} className="flex items-center justify-center size-8 rounded-full hover:bg-white/[0.1] transition-colors">
        <IconX className="size-4 text-white/40" />
      </button>
    </div>
  )
}

// ─── Filter Bar ────────────────────────────────────────────────

function FilterBar({
  activeFilters,
  onToggleFilter,
  sortBy,
  onSortChange,
  sortDir,
  onSortDirToggle,
}: {
  activeFilters: string[]
  onToggleFilter: (filter: string) => void
  sortBy: string
  onSortChange: (sort: string) => void
  sortDir: 'asc' | 'desc'
  onSortDirToggle: () => void
}) {
  const filters = ['All', 'Images', 'Videos', 'Documents', 'Audio', 'Shared', 'Favorites']

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {filters.map((filter) => {
          const isActive = filter === 'All' ? activeFilters.length === 0 : activeFilters.includes(filter)
          return (
            <button
              key={filter}
              onClick={() => onToggleFilter(filter)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border whitespace-nowrap',
                isActive
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-[0_0_12px_-2px_oklch(0.7_0.2_300_/_0.2)]'
                  : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
              )}
            >
              {filter}
            </button>
          )
        })}
      </div>

      <Separator orientation="vertical" className="h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Sort dropdown */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="h-8 w-28 text-[12px] rounded-full border-white/[0.06] bg-white/[0.04] text-white/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-elevated rounded-xl border-white/10">
            <SelectItem value="name" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Name</SelectItem>
            <SelectItem value="date" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Date</SelectItem>
            <SelectItem value="size" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Size</SelectItem>
            <SelectItem value="type" className="text-white/80 focus:bg-white/[0.08] rounded-lg text-[12px]">Type</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={onSortDirToggle}
          className={cn(
            'flex items-center justify-center size-8 rounded-full border transition-colors',
            'border-white/[0.06] bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
          )}
        >
          <IconArrowUp className={cn('size-3.5 transition-transform', sortDir === 'desc' && 'rotate-180')} />
        </button>
      </div>
    </div>
  )
}

// ─── Drop Zone Overlay ─────────────────────────────────────────

function DropZoneOverlay({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center aurora-dropzone">
      <div className="flex flex-col items-center gap-4 glass-fade-in">
        <div className="flex items-center justify-center size-20 rounded-3xl aurora-gradient">
          <IconUpload className="size-8 text-white" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white/90">Drop files here</p>
          <p className="text-sm text-white/40 mt-1">Files will be uploaded to your stash</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function OptionBDemo() {
  // View mode
  const [viewMode, setViewMode] = React.useState<'gallery' | 'board' | 'list'>('gallery')

  // Navigation
  const [activeNav, setActiveNav] = React.useState('home')

  // Search
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchFocused, setSearchFocused] = React.useState(false)

  // Filters
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [sortBy, setSortBy] = React.useState('date')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')

  // Upload panel
  const [uploadsOpen, setUploadsOpen] = React.useState(true)

  // Sharing sheet
  const [sharingOpen, setSharingOpen] = React.useState(false)
  const [sharingFile, setSharingFile] = React.useState<MockFile | null>(null)

  // Drag and drop
  const [isDragging, setIsDragging] = React.useState(false)

  // Bulk selection (mock)
  const [selectedCount, setSelectedCount] = React.useState(0)

  function handleToggleFilter(filter: string) {
    if (filter === 'All') {
      setActiveFilters([])
    } else {
      setActiveFilters((prev) =>
        prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
      )
    }
  }

  function handleShare(file: MockFile) {
    setSharingFile(file)
    setSharingOpen(true)
  }

  // Filter files
  const filteredFiles = React.useMemo(() => {
    if (activeFilters.length === 0) return MOCK_FILES
    return MOCK_FILES.filter((file) => {
      if (activeFilters.includes('Images') && file.type === 'image') return true
      if (activeFilters.includes('Videos') && file.type === 'video') return true
      if (activeFilters.includes('Documents') && file.type === 'document') return true
      if (activeFilters.includes('Audio') && file.type === 'audio') return true
      if (activeFilters.includes('Shared') && file.shared) return true
      if (activeFilters.includes('Favorites') && file.favorite) return true
      return false
    })
  }, [activeFilters])

  // Group files by type for board view
  const filesByType = React.useMemo(() => ({
    Documents: filteredFiles.filter((f) => f.type === 'document'),
    Images: filteredFiles.filter((f) => f.type === 'image'),
    Videos: filteredFiles.filter((f) => f.type === 'video'),
    Other: filteredFiles.filter((f) => f.type === 'audio' || f.type === 'archive' || f.type === 'other'),
  }), [filteredFiles])

  return (
    <div
      data-theme="aurora"
      className="relative flex h-screen w-full overflow-hidden aurora-bg"
      style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}
    >
      {/* ─── Sidebar ─── */}
      <aside
        className="flex-shrink-0 w-[260px] h-full flex flex-col sidebar-glow"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold aurora-text tracking-tight">
            Stashly
          </h1>
        </div>

        {/* Workspace switcher */}
        <div className="px-3 mb-2">
          <WorkspaceSwitcher />
        </div>

        {/* Search */}
        <div className="px-3 mb-1">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="glass-input w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2">
          <NavSection title="Quick Access" />
          <NavItem icon={<IconHome />} label="Home" active={activeNav === 'home'} onClick={() => setActiveNav('home')} />
          <NavItem icon={<IconClock />} label="Recent" count={12} active={activeNav === 'recent'} onClick={() => setActiveNav('recent')} />
          <NavItem icon={<IconStar />} label="Favorites" count={5} active={activeNav === 'favorites'} onClick={() => setActiveNav('favorites')} />

          <NavSection title="Library" />
          <NavItem icon={<IconFolder />} label="All Files" count={156} active={activeNav === 'all'} onClick={() => setActiveNav('all')} />
          <NavItem icon={<IconImage />} label="Images" count={48} active={activeNav === 'images'} onClick={() => setActiveNav('images')} />
          <NavItem icon={<IconVideo />} label="Videos" count={23} active={activeNav === 'videos'} onClick={() => setActiveNav('videos')} />
          <NavItem icon={<IconFile />} label="Documents" count={67} active={activeNav === 'docs'} onClick={() => setActiveNav('docs')} />
          <NavItem icon={<IconMusic />} label="Audio" count={18} active={activeNav === 'audio'} onClick={() => setActiveNav('audio')} />

          <NavSection title="Sharing" />
          <NavItem icon={<IconUsers />} label="Shared with me" count={8} active={activeNav === 'shared-in'} onClick={() => setActiveNav('shared-in')} />
          <NavItem icon={<IconShare />} label="My shares" count={14} active={activeNav === 'shared-out'} onClick={() => setActiveNav('shared-out')} />
          <NavItem icon={<IconMail />} label="Invitations" count={3} active={activeNav === 'invitations'} onClick={() => setActiveNav('invitations')} />

          <NavSection title="System" />
          <NavItem icon={<IconTrash />} label="Trash" count={4} active={activeNav === 'trash'} onClick={() => setActiveNav('trash')} />
          <NavItem icon={<IconSettings />} label="Settings" active={activeNav === 'settings'} onClick={() => setActiveNav('settings')} />
        </ScrollArea>

        {/* Storage quota card */}
        <div className="p-3 mt-auto">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex justify-center mb-2">
              <StorageRing used={6.7} total={10} />
            </div>
            <p className="text-center text-[11px] text-white/40 mb-3">67% used</p>
            <StorageSegments />
            <button className="aurora-button w-full h-8 rounded-xl text-xs mt-3 flex items-center justify-center gap-1.5">
              <IconArrowUp className="size-3" />
              Upgrade plan
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 h-16 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <div>
            <h2 className="text-lg font-semibold text-white/90">All Files</h2>
            <p className="text-[12px] text-white/35">{filteredFiles.length} items · 2.3 GB</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as typeof viewMode)}
              className="glass rounded-xl p-0.5"
            >
              <ToggleGroupItem
                value="gallery"
                className={cn(
                  'rounded-lg h-8 w-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground  text-white/40',
                )}
              >
                <IconGrid className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="board"
                className={cn(
                  'rounded-lg h-8 w-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground  text-white/40',
                )}
              >
                <IconColumns className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="list"
                className={cn(
                  'rounded-lg h-8 w-8 data-[state=on]:bg-white/[0.12] data-[state=on]:text-white text-white/40',
                )}
              >
                <IconList className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Upload button */}
            <Button
              className="aurora-button h-9 rounded-xl px-4 text-sm gap-2"
              onClick={() => setUploadsOpen(true)}
            >
              <IconUpload className="size-4" />
              Upload
            </Button>

            {/* User avatar */}
            <div className="flex items-center justify-center size-9 rounded-full ring-2 ring-purple-500/30" style={{ background: 'oklch(0.7 0.2 300 / 0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: 'oklch(0.85 0.1 300)' }}>AG</span>
            </div>
          </div>
        </header>

        {/* Filter bar */}
        <div className="px-6 py-3 flex-shrink-0">
          <FilterBar
            activeFilters={activeFilters}
            onToggleFilter={handleToggleFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortDir={sortDir}
            onSortDirToggle={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          />
        </div>

        {/* Content area */}
        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            {/* Gallery / Masonry View */}
            {viewMode === 'gallery' && (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
                {filteredFiles.map((file, idx) => (
                  <MasonryCard
                    key={file.id}
                    file={file}
                    height={MASONRY_HEIGHTS[idx % MASONRY_HEIGHTS.length]}
                    onShare={handleShare}
                  />
                ))}
              </div>
            )}

            {/* Board / Kanban View */}
            {viewMode === 'board' && (
              <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
                <BoardColumn title="Documents" files={filesByType.Documents} icon={<IconFile />} />
                <BoardColumn title="Images" files={filesByType.Images} icon={<IconImage />} />
                <BoardColumn title="Videos" files={filesByType.Videos} icon={<IconVideo />} />
                <BoardColumn title="Other" files={filesByType.Other} icon={<IconFolder />} />
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="glass rounded-2xl overflow-hidden">
                {/* List header */}
                <div className="flex items-center gap-4 px-4 h-10 text-[11px] font-semibold uppercase tracking-wider text-white/30 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="w-4" /> {/* checkbox space */}
                  <span className="w-10" /> {/* thumbnail space */}
                  <span className="flex-1">Name</span>
                  <span className="w-24 text-center">Type</span>
                  <span className="w-20 text-right">Size</span>
                  <span className="w-28 text-right">Modified</span>
                  <span className="w-20 text-right">Shared</span>
                  <span className="w-20" /> {/* actions space */}
                </div>
                {filteredFiles.map((file) => (
                  <ListRow key={file.id} file={file} onShare={handleShare} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Search overlay */}
        <SearchOverlay
          open={searchFocused && searchQuery.length > 0}
          onClose={() => setSearchFocused(false)}
          query={searchQuery}
        />

        {/* Drop zone overlay */}
        <DropZoneOverlay active={isDragging} />
      </main>

      {/* ─── Upload Panel ─── */}
      <UploadPanel
        uploads={MOCK_UPLOADS}
        open={uploadsOpen}
        onClose={() => setUploadsOpen(false)}
      />

      {/* ─── Sharing Sheet ─── */}
      <SharingSheet
        open={sharingOpen}
        onOpenChange={setSharingOpen}
        file={sharingFile}
      />

      {/* ─── Bulk Selection Toolbar ─── */}
      <BulkToolbar
        count={selectedCount}
        onClear={() => setSelectedCount(0)}
      />
    </div>
  )
}
