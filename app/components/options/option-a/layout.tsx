import * as React from 'react'
import { cn } from '@/utils/styles'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/ui/table'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
} from '@/ui/tooltip'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from '@/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { Input } from '@/ui/input'
import { Checkbox } from '@/ui/checkbox'
import { Switch } from '@/ui/switch'
import { Avatar, AvatarFallback } from '@/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { DropZoneOverlay } from '../../upload/drop-zone-overlay'

// ─── Mock Data ───────────────────────────────────────────────────────────────

type FileType = 'image' | 'video' | 'document' | 'code' | 'audio' | 'archive' | 'folder'

interface MockFile {
  id: string
  name: string
  type: FileType
  size: number
  modified: string
  owner: string
  ownerInitials: string
  permissions: string
}

interface MockUser {
  name: string
  email: string
  initials: string
  role: string
}

interface UploadItem {
  id: string
  name: string
  progress: number
  speed: string
  status: 'uploading' | 'paused' | 'complete' | 'error'
}

const MOCK_FILES: MockFile[] = [
  { id: '1', name: 'quarterly-report-2026.pdf', type: 'document', size: 4_200_000, modified: '2026-04-14 09:32', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-r--r--' },
  { id: '2', name: 'product-hero-shot.png', type: 'image', size: 12_800_000, modified: '2026-04-13 17:45', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-rw-r--' },
  { id: '3', name: 'sprint-demo.mp4', type: 'video', size: 89_000_000, modified: '2026-04-13 14:20', owner: 'Sarah K.', ownerInitials: 'SK', permissions: '-rw-r-----' },
  { id: '4', name: 'api-handlers.ts', type: 'code', size: 8_400, modified: '2026-04-14 11:05', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-rw-r--' },
  { id: '5', name: 'brand-assets', type: 'folder', size: 0, modified: '2026-04-12 10:00', owner: 'Alon G.', ownerInitials: 'AG', permissions: 'drwxr-xr-x' },
  { id: '6', name: 'design-system-v3.fig', type: 'document', size: 34_500_000, modified: '2026-04-11 16:30', owner: 'Maya L.', ownerInitials: 'ML', permissions: '-rw-r--r--' },
  { id: '7', name: 'onboarding-flow.mp4', type: 'video', size: 156_000_000, modified: '2026-04-10 09:15', owner: 'Sarah K.', ownerInitials: 'SK', permissions: '-rw-r-----' },
  { id: '8', name: 'podcast-ep12.mp3', type: 'audio', size: 45_000_000, modified: '2026-04-09 20:00', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-rw-r--' },
  { id: '9', name: 'infrastructure', type: 'folder', size: 0, modified: '2026-04-08 13:45', owner: 'Alon G.', ownerInitials: 'AG', permissions: 'drwxrwxr-x' },
  { id: '10', name: 'release-v2.4.tar.gz', type: 'archive', size: 67_000_000, modified: '2026-04-07 11:30', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-r--r--' },
  { id: '11', name: 'dashboard-mockup.png', type: 'image', size: 3_200_000, modified: '2026-04-06 15:20', owner: 'Maya L.', ownerInitials: 'ML', permissions: '-rw-r--r--' },
  { id: '12', name: 'meeting-notes-q1.md', type: 'document', size: 12_000, modified: '2026-04-05 10:00', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-rw-r--' },
  { id: '13', name: 'prisma-schema.prisma', type: 'code', size: 6_800, modified: '2026-04-04 14:15', owner: 'Alon G.', ownerInitials: 'AG', permissions: '-rw-r--r--' },
  { id: '14', name: 'user-interviews', type: 'folder', size: 0, modified: '2026-04-03 09:30', owner: 'Sarah K.', ownerInitials: 'SK', permissions: 'drwxr-xr-x' },
  { id: '15', name: 'logo-variants.svg', type: 'image', size: 48_000, modified: '2026-04-02 16:45', owner: 'Maya L.', ownerInitials: 'ML', permissions: '-rw-r--r--' },
]

const MOCK_UPLOADS: UploadItem[] = [
  { id: 'u1', name: 'report-final.pdf', progress: 67, speed: '2.3 MB/s', status: 'uploading' },
  { id: 'u2', name: 'assets-pack.zip', progress: 23, speed: '1.8 MB/s', status: 'uploading' },
  { id: 'u3', name: 'screenshot.png', progress: 100, speed: '--', status: 'complete' },
  { id: 'u4', name: 'video-raw.mov', progress: 45, speed: '0 B/s', status: 'paused' },
]

const MOCK_COLLABORATORS: MockUser[] = [
  { name: 'Sarah Kim', email: 'sarah@team.io', initials: 'SK', role: 'edit' },
  { name: 'Maya Lopez', email: 'maya@team.io', initials: 'ML', role: 'view' },
  { name: 'Jordan Chen', email: 'jordan@team.io', initials: 'JC', role: 'comment' },
]

const MOCK_ACTIVITY = [
  { time: '09:32', user: 'alon', action: 'uploaded quarterly-report-2026.pdf' },
  { time: '09:15', user: 'sarah', action: 'viewed sprint-demo.mp4' },
  { time: '08:55', user: 'maya', action: 'commented on design-system-v3.fig' },
  { time: '08:30', user: 'alon', action: 'shared brand-assets/ with sarah@team.io' },
  { time: '08:12', user: 'jordan', action: 'downloaded release-v2.4.tar.gz' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function fileTypeColor(type: FileType): string {
  const colors: Record<FileType, string> = {
    image: 'text-[oklch(0.75_0.18_195)]',
    video: 'text-[oklch(0.8_0.2_145)]',
    document: 'text-[oklch(0.8_0.16_80)]',
    code: 'text-[oklch(0.7_0.15_280)]',
    audio: 'text-[oklch(0.7_0.18_330)]',
    archive: 'text-[oklch(0.55_0.02_260)]',
    folder: 'text-[oklch(0.75_0.18_195)]',
  }
  return colors[type]
}

function fileIcon(type: FileType): string {
  const icons: Record<FileType, string> = {
    folder: '\u{1F4C1}',
    image: '\u{1F5BC}',
    video: '\u{1F3AC}',
    document: '\u{1F4C4}',
    code: '\u{1F4BB}',
    audio: '\u{1F3B5}',
    archive: '\u{1F4E6}',
  }
  return icons[type]
}

function progressBar(pct: number, width: number = 12): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

// ─── Icon Components (inline SVG, no lucide-react) ───────────────────────────

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconFiles({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconImage({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
    </svg>
  )
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  )
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </svg>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconTerminal({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function IconMoreH({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

function IconSort({ className, direction }: { className?: string; direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className={cn('opacity-30', className)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    )
  }
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'asc' ? (
        <path d="M12 19V5m-7 7l7-7 7 7" />
      ) : (
        <path d="M12 5v14m-7-7l7 7 7-7" />
      )}
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Keyboard shortcut badge
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground rounded-sm border border-border">{children}</span>
  )
}

// Sidebar navigation item
interface NavItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  active?: boolean
  expanded: boolean
  onClick?: () => void
}

function NavItem({ icon, label, shortcut, active, expanded, onClick }: NavItemProps) {
  return (
      <TooltipRoot>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-xs transition-colors rounded-sm',
              'hover:bg-secondary',
              active
                ? 'text-accent bg-secondary'
                : 'text-muted-foreground',
            )}
          >
            <span className="shrink-0">{icon}</span>
            {expanded && (
              <>
                <span className="flex-1 text-left truncate animate-fade-in">{label}</span>
                {shortcut && <Kbd>{shortcut}</Kbd>}
              </>
            )}
          </button>
        </TooltipTrigger>
        {!expanded && (
          <TooltipContent side="right" className="bg-secondary text-foreground border-border text-xs font-mono">
            {label} {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
          </TooltipContent>
        )}
      </TooltipRoot>
  )
}

// ─── Terminal Sidebar ────────────────────────────────────────────────────────

interface TerminalSidebarProps {
  expanded: boolean
  onExpandedChange: (v: boolean) => void
  activeNav: string
  onNavChange: (v: string) => void
}

function TerminalSidebar({ expanded, onExpandedChange, activeNav, onNavChange }: TerminalSidebarProps) {
  return (
    <aside
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
      className={cn(
        'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-out shrink-0',
        expanded ? 'w-70' : 'w-12',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 h-14">
        <span className="text-accent font-bold text-base tracking-tighter shrink-0">
          {expanded ? '// STASHLY' : '//'}
        </span>
      </div>

      {/* Workspace Switcher */}
      {expanded && (
        <div className="px-3 pb-3 animate-fade-in">
          <Select defaultValue="personal">
            <SelectTrigger className="h-8 text-xs bg-card border-border font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-border font-mono text-xs">
              <SelectItem value="personal">alon@personal &gt;</SelectItem>
              <SelectItem value="team">alon@team-workspace &gt;</SelectItem>
              <SelectItem value="client">alon@client-project &gt;</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator className="bg-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <div className="px-1.5 space-y-0.5">
          {expanded && <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground animate-fade-in">System</div>}
          <NavItem icon={<IconHome />} label="Home" shortcut={'\u2318 1'} active={activeNav === 'home'} expanded={expanded} onClick={() => onNavChange('home')} />
          <NavItem icon={<IconFiles />} label="All Files" shortcut={'\u2318 2'} active={activeNav === 'files'} expanded={expanded} onClick={() => onNavChange('files')} />
          <NavItem icon={<IconClock />} label="Recent" shortcut={'\u2318 3'} active={activeNav === 'recent'} expanded={expanded} onClick={() => onNavChange('recent')} />

          <Separator className="my-2 bg-border" />

          {expanded && <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground animate-fade-in">Media</div>}
          <NavItem icon={<IconImage />} label="Images" active={activeNav === 'images'} expanded={expanded} onClick={() => onNavChange('images')} />
          <NavItem icon={<IconVideo />} label="Videos" active={activeNav === 'videos'} expanded={expanded} onClick={() => onNavChange('videos')} />
          <NavItem icon={<IconDocument />} label="Documents" active={activeNav === 'documents'} expanded={expanded} onClick={() => onNavChange('documents')} />

          <Separator className="my-2 bg-border" />

          {expanded && <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground animate-fade-in">Access</div>}
          <NavItem icon={<IconShare />} label="Shares" active={activeNav === 'shares'} expanded={expanded} onClick={() => onNavChange('shares')} />
          <NavItem icon={<IconMail />} label="Invitations" active={activeNav === 'invitations'} expanded={expanded} onClick={() => onNavChange('invitations')} />
          <NavItem icon={<IconTrash />} label="Trash" active={activeNav === 'trash'} expanded={expanded} onClick={() => onNavChange('trash')} />

          {/* Pinned Folders */}
          {expanded && (
            <>
              <Separator className="my-2 bg-border" />
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground animate-fade-in">Pinned</div>
              {['brand-assets', 'infrastructure', 'user-interviews'].map((folder) => (
                <button
                  key={folder}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm transition-colors animate-fade-in"
                >
                  <span className="text-accent text-[10px]">{'\u{1F4CC}'}</span>
                  <span className="truncate">{folder}/</span>
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Storage Quota */}
      <div className="border-t border-border p-3">
        {expanded ? (
          <div className="space-y-2 animate-fade-in">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Storage</div>
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-accent">{progressBar(67)}</span>
              {' '}67%
            </div>
            <div className="text-[10px] text-muted-foreground">6.7 GB / 10 GB</div>

            {/* Stacked bar chart */}
            <div className="flex h-1.5 rounded-sm overflow-hidden">
              <div className="bg-[oklch(0.65_0.16_180)]" style={{ width: '35%' }} />
              <div className="bg-[oklch(0.6_0.2_150)]" style={{ width: '30%' }} />
              <div className="bg-[oklch(0.75_0.155_85)]" style={{ width: '20%' }} />
              <div className="bg-muted" style={{ width: '15%' }} />
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[oklch(0.65_0.16_180)] mr-1" />img</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[oklch(0.6_0.2_150)] mr-1" />vid</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[oklch(0.75_0.155_85)] mr-1" />doc</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-muted mr-1" />other</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[10px] uppercase tracking-widest border-accent text-accent hover:bg-accent hover:text-background"
            >
              Upgrade Plan
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-1.5 h-8 rounded-sm overflow-hidden bg-muted">
              <div className="w-full bg-accent" style={{ height: '67%' }} />
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div className="border-t border-border p-3 flex items-center gap-2">
        <Avatar className="w-6 h-6">
          <AvatarFallback className="bg-secondary text-accent text-[10px] font-mono">AG</AvatarFallback>
        </Avatar>
        {expanded && (
          <div className="flex-1 min-w-0 animate-fade-in">
            <div className="text-xs text-foreground truncate">alon.gvili</div>
            <div className="text-[10px] text-muted-foreground">Pro Plan</div>
          </div>
        )}
      </div>
    </aside>
  )
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  typeFilter: string
  onTypeFilterChange: (v: string) => void
  activeFilters: string[]
  onRemoveFilter: (f: string) => void
}

function FilterBar({ typeFilter, onTypeFilterChange, activeFilters, onRemoveFilter }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
      <ToggleGroup
        type="single"
        value={typeFilter}
        onValueChange={(v) => { if (v) onTypeFilterChange(v) }}
        className="gap-0.5"
      >
        {['all', 'images', 'videos', 'docs', 'code'].map((t) => (
          <ToggleGroupItem
            key={t}
            value={t}
            className={cn(
              'h-6 px-2.5 text-[10px] uppercase tracking-wider rounded-sm font-mono',
              'data-[state=on]:bg-accent data-[state=on]:text-background',
              'data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground',
            )}
          >
            {t}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="h-4 bg-border" />

      <Select defaultValue="any-date">
        <SelectTrigger className="h-6 w-28 text-[10px] bg-transparent border-border font-mono uppercase tracking-wider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-secondary border-border font-mono text-xs">
          <SelectItem value="any-date">Any Date</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="any-size">
        <SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-border font-mono uppercase tracking-wider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-secondary border-border font-mono text-xs">
          <SelectItem value="any-size">Any Size</SelectItem>
          <SelectItem value="small">&lt; 1 MB</SelectItem>
          <SelectItem value="medium">1-50 MB</SelectItem>
          <SelectItem value="large">&gt; 50 MB</SelectItem>
        </SelectContent>
      </Select>

      {/* Active filter badges */}
      {activeFilters.length > 0 && (
        <div className="flex gap-1 ml-2">
          {activeFilters.map((f) => (
            <Badge
              key={f}
              variant="secondary"
              className="h-5 text-[10px] font-mono bg-secondary text-accent border-border gap-1 cursor-pointer hover:bg-accent hover:text-background transition-colors"
              onClick={() => onRemoveFilter(f)}
            >
              {f} <span className="text-[8px]">{'\u2715'}</span>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <span className="text-[10px] text-muted-foreground font-mono">
        {MOCK_FILES.length} items
      </span>
    </div>
  )
}

// ─── Compact List View ───────────────────────────────────────────────────────

interface CompactListViewProps {
  files: MockFile[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onSelectAll: () => void
  sortCol: string
  sortDir: 'asc' | 'desc'
  onSort: (col: string) => void
}

function CompactListView({ files, selectedIds, onSelect, onSelectAll, sortCol, sortDir, onSort }: CompactListViewProps) {
  const sortIndicator = (col: string): 'asc' | 'desc' | null => {
    if (sortCol === col) return sortDir
    return null
  }

  return (
    <ScrollArea className="flex-1">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead className="w-10 text-center">
              <Checkbox
                checked={selectedIds.size === files.length && files.length > 0}
                onCheckedChange={onSelectAll}
                className="border-border"
              />
            </TableHead>
            <TableHead className="w-8" />
            <TableHead
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono cursor-pointer select-none"
              onClick={() => onSort('name')}
            >
              <span className="flex items-center gap-1">Name <IconSort direction={sortIndicator('name')} /></span>
            </TableHead>
            <TableHead className="w-20 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Type</TableHead>
            <TableHead
              className="w-24 text-[10px] uppercase tracking-widest text-muted-foreground font-mono cursor-pointer select-none"
              onClick={() => onSort('size')}
            >
              <span className="flex items-center gap-1">Size <IconSort direction={sortIndicator('size')} /></span>
            </TableHead>
            <TableHead
              className="w-36 text-[10px] uppercase tracking-widest text-muted-foreground font-mono cursor-pointer select-none"
              onClick={() => onSort('modified')}
            >
              <span className="flex items-center gap-1">Modified <IconSort direction={sortIndicator('modified')} /></span>
            </TableHead>
            <TableHead className="w-16 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Owner</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.id}
              className={cn(
                'h-9 border-b border-border transition-all cursor-pointer group',
                selectedIds.has(file.id)
                  ? 'bg-[oklch(0.48_0.16_275_/_0.1)] border-l-2 border-l-accent'
                  : 'hover:bg-secondary hover:border-l-2 hover:border-l-accent',
              )}
            >
              <TableCell className="text-center">
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={() => onSelect(file.id)}
                  className="border-border"
                />
              </TableCell>
              <TableCell className="text-center">
                <span className={cn('text-sm', fileTypeColor(file.type))}>{fileIcon(file.type)}</span>
              </TableCell>
              <TableCell className="text-xs font-mono text-foreground">
                {file.name}{file.type === 'folder' && '/'}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[9px] uppercase tracking-wider font-mono h-4 px-1.5 bg-transparent border',
                    'border-border',
                    fileTypeColor(file.type),
                  )}
                >
                  {file.type}
                </Badge>
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {file.modified}
              </TableCell>
              <TableCell>
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="bg-secondary text-[9px] text-muted-foreground font-mono">
                    {file.ownerInitials}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-secondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconMoreH className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-secondary border-border font-mono text-xs min-w-[140px]">
                    <DropdownMenuItem className="text-xs">Open</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs">Rename</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs">Share</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs">Download</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem className="text-xs text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

// ─── Grid View ───────────────────────────────────────────────────────────────

interface GridViewProps {
  files: MockFile[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
}

function GridView({ files, selectedIds, onSelect }: GridViewProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {files.map((file) => (
          <button
            key={file.id}
            onClick={() => onSelect(file.id)}
            className={cn(
              'flex flex-col items-start p-3 rounded-lg border transition-all text-left surface-elevated',
              selectedIds.has(file.id)
                ? 'border-accent shadow-lg'
                : 'border-border hover:border-accent hover:shadow-md',
              file.type === 'folder' && 'bg-gradient-to-br from-secondary to-[oklch(0.2_0.02_195_/_0.3)]',
            )}
          >
            {/* File icon / thumbnail area */}
            <div className="flex items-center justify-center w-full h-24 mb-3 rounded-sm bg-muted">
              <span className={cn('text-3xl', fileTypeColor(file.type))}>
                {fileIcon(file.type)}
              </span>
            </div>

            <div className="w-full min-w-0">
              <div className="text-xs font-mono text-foreground truncate">
                {file.name}{file.type === 'folder' && '/'}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {file.modified.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Selection indicator */}
            {selectedIds.has(file.id) && (
              <div className="absolute top-2 right-2">
                <div className="w-4 h-4 rounded-sm bg-accent flex items-center justify-center text-[10px] text-background font-bold">
                  {'\u2713'}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── Terminal View ───────────────────────────────────────────────────────────

interface TerminalViewProps {
  files: MockFile[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
}

function TerminalView({ files, selectedIds, onSelect }: TerminalViewProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="m-4 min-h-0 space-y-1 text-[10px] font-mono">
        <div className="text-muted-foreground mb-2">
          total {files.length} &mdash; ls -la /stash/all
        </div>
        {files.map((file) => {
          const nameCol = (file.name + (file.type === 'folder' ? '/' : '')).padEnd(32)
          const sizeStr = formatBytes(file.size).padStart(8)
          const ownerStr = file.owner.padEnd(10)
          return (
            <button
              key={file.id}
              onClick={() => onSelect(file.id)}
              className={cn(
                'block w-full text-left px-2 py-0.5 rounded-sm transition-colors font-mono text-xs whitespace-pre',
                selectedIds.has(file.id)
                  ? 'bg-[oklch(0.48_0.16_275_/_0.1)] text-accent'
                  : 'hover:bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-muted-foreground">{file.permissions}</span>
              {'  '}
              <span>{ownerStr}</span>
              {'  '}
              <span className="text-muted-foreground">{sizeStr}</span>
              {'  '}
              <span className="text-muted-foreground">{file.modified}</span>
              {'  '}
              <span className={cn(fileTypeColor(file.type), file.type === 'folder' && 'font-bold')}>
                {nameCol}
              </span>
            </button>
          )
        })}
        <div className="mt-2 text-accent text-xs">
          <span>&gt; </span>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Upload Manager Panel ────────────────────────────────────────────────────

interface UploadPanelProps {
  uploads: UploadItem[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

function UploadPanel({ uploads, open, onOpenChange }: UploadPanelProps) {
  if (!open) {
    const active = uploads.filter((u) => u.status === 'uploading' || u.status === 'paused')
    if (active.length === 0) return null

    return (
      <button
        onClick={() => onOpenChange(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <IconUpload className="text-accent" />
        <span>{active.length} uploading</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 rounded-lg border border-border bg-card shadow-2xl animate-fade-in">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-accent">{'\u25B6'}</span>
          <span className="text-foreground uppercase tracking-wider text-[10px]">Upload Manager</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-mono bg-secondary border-border">
            {uploads.filter((u) => u.status === 'uploading').length} active
          </Badge>
        </div>
        <button onClick={() => onOpenChange(false)} className="p-1 rounded-sm hover:bg-secondary text-muted-foreground">
          <IconX />
        </button>
      </div>

      {/* Upload entries */}
      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-0.5 font-mono text-xs">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-sm',
                upload.status === 'complete' && 'text-[oklch(0.62_0.19_145)]',
                upload.status === 'error' && 'text-destructive',
                upload.status === 'paused' && 'text-[oklch(0.75_0.155_85)]',
                upload.status === 'uploading' && 'text-muted-foreground',
              )}
            >
              <span className="shrink-0 w-3 text-center text-[10px]">
                {upload.status === 'uploading' && '\u25B6'}
                {upload.status === 'paused' && '\u23F8'}
                {upload.status === 'complete' && '\u2713'}
                {upload.status === 'error' && '\u2717'}
              </span>
              <span className="truncate flex-1 min-w-0">{upload.name}</span>
              <span className="shrink-0 text-accent">
                {progressBar(upload.progress, 8)}
              </span>
              <span className="shrink-0 w-8 text-right">{upload.progress}%</span>
              <span className="shrink-0 w-16 text-right text-muted-foreground">{upload.speed}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Bulk Actions Toolbar ────────────────────────────────────────────────────

interface BulkActionsProps {
  count: number
  onClear: () => void
  onShare: () => void
}

function BulkActions({ count, onClear, onShare }: BulkActionsProps) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-t border-border animate-fade-in">
      <span className="text-xs font-mono text-accent">{count} selected</span>
      <Separator orientation="vertical" className="h-4 bg-border" />
      <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground">
        Move
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground">
        Copy
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground">
        Download
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground" onClick={onShare}>
        Share
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-wider font-mono text-destructive hover:text-destructive">
        Delete
      </Button>
      <div className="flex-1" />
      <button onClick={onClear} className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
        Clear selection
      </button>
    </div>
  )
}

// ─── Share Dialog ────────────────────────────────────────────────────────────

interface ShareDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const [linkEnabled, setLinkEnabled] = React.useState(false)
  const [linkCopied, setLinkCopied] = React.useState(false)
  const [passwordEnabled, setPasswordEnabled] = React.useState(false)

  const handleCopy = () => {
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border font-mono max-w-lg sm:rounded-lg p-0 gap-0">
        {/* Terminal-style title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.75_0.155_85)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.62_0.19_145)]" />
          </span>
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-xs uppercase tracking-widest text-foreground">Share &amp; Permissions</DialogTitle>
            <DialogDescription className="sr-only">Manage sharing settings and collaborator permissions</DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="people" className="w-full">
          <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-9 px-4">
            <TabsTrigger
              value="people"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent text-[10px] uppercase tracking-wider font-mono px-3"
            >
              People
            </TabsTrigger>
            <TabsTrigger
              value="link"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent text-[10px] uppercase tracking-wider font-mono px-3"
            >
              Link
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent text-[10px] uppercase tracking-wider font-mono px-3"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          {/* People Tab */}
          <TabsContent value="people" className="p-4 space-y-4 mt-0">
            {/* Invite input */}
            <div className="flex gap-2">
              <Input
                placeholder="Email or username..."
                className="flex-1 h-8 text-xs bg-muted border-border font-mono placeholder:text-muted-foreground"
              />
              <Select defaultValue="edit">
                <SelectTrigger className="w-24 h-8 text-[10px] bg-muted border-border font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border font-mono text-xs">
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-[10px] uppercase tracking-wider font-mono bg-accent text-background hover:bg-[oklch(0.75_0.18_275)]"
              >
                Invite
              </Button>
            </div>

            {/* Collaborators list */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Collaborators</div>
              {MOCK_COLLABORATORS.map((user) => (
                <div key={user.email} className="flex items-center gap-3 px-2 py-2 rounded-sm hover:bg-secondary transition-colors">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="bg-secondary text-[9px] text-accent font-mono">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground">{user.email}</div>
                  </div>
                  <Select defaultValue={user.role}>
                    <SelectTrigger className="w-20 h-6 text-[10px] bg-transparent border-border font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border font-mono text-xs">
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <button className="p-1 rounded-sm hover:bg-card text-muted-foreground hover:text-destructive transition-colors">
                    <IconX />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Link Tab */}
          <TabsContent value="link" className="p-4 space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-foreground">Public Link</div>
                <div className="text-[10px] text-muted-foreground">Anyone with the link can access</div>
              </div>
              <Switch
                checked={linkEnabled}
                onCheckedChange={setLinkEnabled}
              />
            </div>

            {linkEnabled && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value="https://stash.ly/s/xk7f9a2"
                    className="flex-1 h-8 text-xs bg-muted border-border font-mono text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-mono border-border hover:bg-secondary"
                    onClick={handleCopy}
                  >
                    <IconCopy className="mr-1" />
                    {linkCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Expiry date</span>
                  <Select defaultValue="7d">
                    <SelectTrigger className="w-28 h-6 text-[10px] bg-transparent border-border font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border font-mono text-xs">
                      <SelectItem value="1d">1 day</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Password protection</span>
                  <Switch
                    checked={passwordEnabled}
                    onCheckedChange={setPasswordEnabled}
                  />
                </div>

                {passwordEnabled && (
                  <Input
                    type="password"
                    placeholder="Set password..."
                    className="h-8 text-xs bg-muted border-border font-mono placeholder:text-muted-foreground animate-fade-in"
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="p-4 mt-0">
            <div className="text-[11px] space-y-1">
              {MOCK_ACTIVITY.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">[{entry.time}]</span>
                  <span className="text-accent shrink-0">{entry.user}</span>
                  <span className="text-muted-foreground">{entry.action}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-4 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Command Palette ─────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        className="font-mono text-xs"
      />
      <CommandList className="bg-card font-mono">
        <CommandEmpty className="text-xs text-muted-foreground font-mono py-6 text-center">
          No results found.
        </CommandEmpty>

        <CommandGroup heading={<span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Recent</span>}>
          {MOCK_FILES.slice(0, 3).map((file) => (
            <CommandItem key={file.id} className="text-xs font-mono gap-2">
              <span className={fileTypeColor(file.type)}>{fileIcon(file.type)}</span>
              <span>{file.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{file.modified.split(' ')[0]}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="bg-border" />

        <CommandGroup heading={<span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Actions</span>}>
          <CommandItem className="text-xs font-mono gap-2">
            <IconUpload className="text-muted-foreground" />
            <span>Upload files</span>
            <span className="ml-auto"><Kbd>{'\u2318 U'}</Kbd></span>
          </CommandItem>
          <CommandItem className="text-xs font-mono gap-2">
            <IconShare className="text-muted-foreground" />
            <span>Share selected</span>
            <span className="ml-auto"><Kbd>{'\u2318 S'}</Kbd></span>
          </CommandItem>
          <CommandItem className="text-xs font-mono gap-2">
            <IconSearch className="text-muted-foreground" />
            <span>Search all files</span>
            <span className="ml-auto"><Kbd>/</Kbd></span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-border" />

        <CommandGroup heading={<span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Settings</span>}>
          <CommandItem className="text-xs font-mono gap-2">
            <IconSettings className="text-muted-foreground" />
            <span>Preferences</span>
          </CommandItem>
          <CommandItem className="text-xs font-mono gap-2">
            <IconSettings className="text-muted-foreground" />
            <span>Storage &amp; billing</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

export default function OptionADemo() {
  // State
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState('files')
  const [viewMode, setViewMode] = React.useState<string>('list')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [uploadPanelOpen, setUploadPanelOpen] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [sortCol, setSortCol] = React.useState('modified')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [isDragging, setIsDragging] = React.useState(false)

  // Keyboard shortcut: Cmd+K for command palette
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filter files by type
  const filteredFiles = React.useMemo(() => {
    let files = [...MOCK_FILES]
    if (typeFilter !== 'all') {
      const typeMap: Record<string, FileType[]> = {
        images: ['image'],
        videos: ['video'],
        docs: ['document'],
        code: ['code'],
      }
      const types = typeMap[typeFilter]
      if (types) {
        files = files.filter((f) => types.includes(f.type))
      }
    }
    // Sort
    files.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortCol === 'size') cmp = a.size - b.size
      else if (sortCol === 'modified') cmp = a.modified.localeCompare(b.modified)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return files
  }, [typeFilter, sortCol, sortDir])

  // Selection handlers
  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)))
    }
  }

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const handleRemoveFilter = (f: string) => {
    setActiveFilters((prev) => prev.filter((x) => x !== f))
  }

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only hide if leaving the container itself
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return (
    <div
      data-theme="light"
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{ fontFamily: "var(--font-sans)", fontSize: '13px', letterSpacing: '-0.01em' }}
    >
      {/* Sidebar */}
      <TerminalSidebar
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        activeNav={activeNav}
        onNavChange={setActiveNav}
      />

      {/* Main Content */}
      <div
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 h-14 border-b border-border bg-card shrink-0">
          {/* Breadcrumb / Location */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-muted-foreground">~/</span>
            <span className="text-muted-foreground">stash</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">all</span>
          </div>

          <div className="flex-1" />

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-border bg-muted text-xs font-mono text-muted-foreground hover:border-accent hover:text-foreground transition-colors"
          >
            <IconSearch className="w-3.5 h-3.5" />
            <span>Search...</span>
            <Kbd>{'\u2318 K'}</Kbd>
          </button>

          {/* View mode toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => { if (v) setViewMode(v) }}
            className="gap-0"
          >
            <ToggleGroupItem
              value="list"
              className={cn(
                'h-8 w-8 rounded-sm',
                'data-[state=on]:bg-accent data-[state=on]:text-background',
                'data-[state=off]:text-muted-foreground',
              )}
            >
              <IconList />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="grid"
              className={cn(
                'h-8 w-8 rounded-sm',
                'data-[state=on]:bg-accent data-[state=on]:text-background',
                'data-[state=off]:text-muted-foreground',
              )}
            >
              <IconGrid />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="terminal"
              className={cn(
                'h-8 w-8 rounded-sm',
                'data-[state=on]:bg-accent data-[state=on]:text-background',
                'data-[state=off]:text-muted-foreground',
              )}
            >
              <IconTerminal />
            </ToggleGroupItem>
          </ToggleGroup>

          <Separator orientation="vertical" className="h-5 bg-border" />

          {/* Upload button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] uppercase tracking-wider font-mono border-accent text-accent hover:bg-accent hover:text-background gap-1.5"
          >
            <IconUpload />
            Upload
          </Button>
        </header>

        {/* Filter Bar */}
        <FilterBar
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
        />

        {/* Content Area */}
        <div className="flex-1 min-h-0 relative">
          {viewMode === 'list' && (
            <CompactListView
              files={filteredFiles}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
          {viewMode === 'grid' && (
            <GridView
              files={filteredFiles}
              selectedIds={selectedIds}
              onSelect={handleSelect}
            />
          )}
          {viewMode === 'terminal' && (
            <TerminalView
              files={filteredFiles}
              selectedIds={selectedIds}
              onSelect={handleSelect}
            />
          )}

          {/* Drop zone overlay */}
          <DropZoneOverlay visible={isDragging} />
        </div>

        {/* Bulk Actions */}
        <BulkActions
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onShare={() => setShareOpen(true)}
        />

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-muted text-[10px] font-mono text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <span>{filteredFiles.length} items</span>
            <span>{'\u2502'}</span>
            <span>{viewMode} view</span>
            <span>{'\u2502'}</span>
            <span>sort: {sortCol} {sortDir}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[oklch(0.62_0.19_145)]">{'\u25CF'} connected</span>
            <span>{'\u2502'}</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Share Dialog */}
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />

      {/* Upload Manager */}
      <UploadPanel
        uploads={MOCK_UPLOADS}
        open={uploadPanelOpen}
        onOpenChange={setUploadPanelOpen}
      />
    </div>
  )
}
