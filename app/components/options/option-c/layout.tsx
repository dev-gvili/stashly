import * as React from 'react'
import { cn } from '@/utils/styles'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Switch } from '@/ui/switch'
import { Progress } from '@/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/popover'
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
} from '@/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/tooltip'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/ui/tabs'

// ─── Types ───────────────────────────────────────────────────────────

type FileType = 'image' | 'video' | 'document' | 'audio' | 'archive' | 'code'
type ViewMode = 'magazine' | 'reading' | 'contact'
type NavSection = 'browse' | 'organize' | 'manage'
type Permission = 'view' | 'comment' | 'edit' | 'admin'

interface MockFile {
  id: string
  name: string
  type: FileType
  size: string
  sizeBytes: number
  date: string
  dateRelative: string
  thumbnail?: string
  description?: string
  color: string
}

interface MockUpload {
  id: string
  name: string
  progress: number
  speed: string
  size: string
  completed: boolean
}

interface MockCollaborator {
  id: string
  name: string
  email: string
  avatar: string
  permission: Permission
}

interface Workspace {
  id: string
  name: string
  role: string
}

// ─── Mock Data ───────────────────────────────────────────────────────

const MOCK_FILES: MockFile[] = [
  {
    id: '1',
    name: 'Brand Guidelines 2026',
    type: 'document',
    size: '4.2 MB',
    sizeBytes: 4200000,
    date: 'Apr 12, 2026',
    dateRelative: '2 days ago',
    description: 'Complete brand identity system and usage guidelines',
    color: 'oklch(0.92 0.04 290)',
  },
  {
    id: '2',
    name: 'Hero-banner-final.png',
    type: 'image',
    size: '2.8 MB',
    sizeBytes: 2800000,
    date: 'Apr 13, 2026',
    dateRelative: 'Yesterday',
    thumbnail: 'linear-gradient(135deg, oklch(0.8 0.08 40), oklch(0.7 0.12 25))',
    color: 'oklch(0.92 0.06 40)',
  },
  {
    id: '3',
    name: 'Product-demo.mp4',
    type: 'video',
    size: '148 MB',
    sizeBytes: 148000000,
    date: 'Apr 10, 2026',
    dateRelative: '4 days ago',
    description: 'Q2 product walkthrough for stakeholder review',
    thumbnail: 'linear-gradient(135deg, oklch(0.75 0.06 155), oklch(0.65 0.1 155))',
    color: 'oklch(0.92 0.04 155)',
  },
  {
    id: '4',
    name: 'quarterly-report.pdf',
    type: 'document',
    size: '1.1 MB',
    sizeBytes: 1100000,
    date: 'Apr 8, 2026',
    dateRelative: '6 days ago',
    description: 'Q1 2026 financial summary and projections',
    color: 'oklch(0.92 0.04 290)',
  },
  {
    id: '5',
    name: 'podcast-ep-47.mp3',
    type: 'audio',
    size: '67 MB',
    sizeBytes: 67000000,
    date: 'Apr 7, 2026',
    dateRelative: '1 week ago',
    description: 'Interview with design director',
    color: 'oklch(0.92 0.04 70)',
  },
  {
    id: '6',
    name: 'ui-components.sketch',
    type: 'archive',
    size: '23 MB',
    sizeBytes: 23000000,
    date: 'Apr 5, 2026',
    dateRelative: '9 days ago',
    color: 'oklch(0.92 0.015 60)',
  },
  {
    id: '7',
    name: 'Cover-photo.jpg',
    type: 'image',
    size: '5.1 MB',
    sizeBytes: 5100000,
    date: 'Apr 4, 2026',
    dateRelative: '10 days ago',
    thumbnail: 'linear-gradient(135deg, oklch(0.85 0.05 60), oklch(0.75 0.08 40))',
    color: 'oklch(0.92 0.06 40)',
  },
  {
    id: '8',
    name: 'api-schema.json',
    type: 'code',
    size: '42 KB',
    sizeBytes: 42000,
    date: 'Apr 3, 2026',
    dateRelative: '11 days ago',
    color: 'oklch(0.92 0.03 220)',
  },
  {
    id: '9',
    name: 'Team-retreat-recap.mp4',
    type: 'video',
    size: '320 MB',
    sizeBytes: 320000000,
    date: 'Apr 1, 2026',
    dateRelative: '13 days ago',
    thumbnail: 'linear-gradient(135deg, oklch(0.7 0.08 155), oklch(0.6 0.1 180))',
    color: 'oklch(0.92 0.04 155)',
  },
  {
    id: '10',
    name: 'Invoice-march-2026.pdf',
    type: 'document',
    size: '240 KB',
    sizeBytes: 240000,
    date: 'Mar 31, 2026',
    dateRelative: '2 weeks ago',
    color: 'oklch(0.92 0.04 290)',
  },
  {
    id: '11',
    name: 'Logo-variations.svg',
    type: 'image',
    size: '180 KB',
    sizeBytes: 180000,
    date: 'Mar 28, 2026',
    dateRelative: '2 weeks ago',
    thumbnail: 'linear-gradient(135deg, oklch(0.9 0.03 60), oklch(0.85 0.05 40))',
    color: 'oklch(0.92 0.06 40)',
  },
  {
    id: '12',
    name: 'project-archive.zip',
    type: 'archive',
    size: '890 MB',
    sizeBytes: 890000000,
    date: 'Mar 25, 2026',
    dateRelative: '3 weeks ago',
    color: 'oklch(0.92 0.015 60)',
  },
]

const MOCK_UPLOADS: MockUpload[] = [
  { id: 'u1', name: 'presentation-final.pptx', progress: 73, speed: '2.4 MB/s', size: '18 MB', completed: false },
  { id: 'u2', name: 'photo-batch-001.zip', progress: 100, speed: '', size: '45 MB', completed: true },
  { id: 'u3', name: 'design-assets.fig', progress: 31, speed: '1.8 MB/s', size: '12 MB', completed: false },
]

const MOCK_COLLABORATORS: MockCollaborator[] = [
  { id: 'c1', name: 'Sarah Chen', email: 'sarah@example.com', avatar: 'SC', permission: 'edit' },
  { id: 'c2', name: 'Marcus Rivera', email: 'marcus@example.com', avatar: 'MR', permission: 'view' },
  { id: 'c3', name: 'Yuki Tanaka', email: 'yuki@example.com', avatar: 'YT', permission: 'comment' },
]

const WORKSPACES: Workspace[] = [
  { id: 'w1', name: 'Design Studio', role: 'Owner' },
  { id: 'w2', name: 'Marketing Team', role: 'Editor' },
  { id: 'w3', name: 'Engineering', role: 'Viewer' },
]

const NAV_ITEMS: Record<NavSection, { label: string; items: { id: string; label: string }[] }> = {
  browse: {
    label: 'BROWSE',
    items: [
      { id: 'home', label: 'Home' },
      { id: 'all', label: 'All Files' },
      { id: 'recent', label: 'Recent' },
      { id: 'images', label: 'Images' },
      { id: 'videos', label: 'Videos' },
      { id: 'documents', label: 'Documents' },
    ],
  },
  organize: {
    label: 'ORGANIZE',
    items: [
      { id: 'collections', label: 'Collections' },
      { id: 'favorites', label: 'Favorites' },
      { id: 'tags', label: 'Tags' },
    ],
  },
  manage: {
    label: 'MANAGE',
    items: [
      { id: 'shared', label: 'Shared' },
      { id: 'invitations', label: 'Invitations' },
      { id: 'trash', label: 'Trash' },
    ],
  },
}

const FILE_TYPE_LABELS: Record<FileType, string> = {
  image: 'Image',
  video: 'Video',
  document: 'Document',
  audio: 'Audio',
  archive: 'Archive',
  code: 'Code',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Sub-components ──────────────────────────────────────────────────

function CanvasSidebar({
  activeNav,
  onNavChange,
  activeWorkspace,
  onWorkspaceChange,
}: {
  activeNav: string
  onNavChange: (id: string) => void
  activeWorkspace: string
  onWorkspaceChange: (id: string) => void
}) {
  const currentWorkspace = WORKSPACES.find((w) => w.id === activeWorkspace) ?? WORKSPACES[0]

  return (
    <aside
      className="flex flex-col h-full surface-taupe"
      style={{ width: 280, minWidth: 280 }}
    >
      <ScrollArea className="flex-1">
        <div className="px-7 pt-7 pb-4">
          {/* Logo */}
          <div className="mb-6">
            <h1
              className="text-editorial"
              style={{ fontSize: 24, lineHeight: 1 }}
            >
              Stashly
              <span
                className="inline-block ml-1"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--paper-terracotta)',
                  verticalAlign: 'super',
                }}
              />
            </h1>
          </div>

          {/* Greeting */}
          <div className="mb-8">
            <p style={{ fontSize: 14, color: 'var(--paper-text-muted)', fontFamily: 'var(--font-body)' }}>
              {getGreeting()}, Alon
            </p>
            <p
              className="text-technical"
              style={{ fontSize: 12, marginTop: 2, color: 'var(--paper-text-dim)' }}
            >
              {formatDate()}
            </p>
          </div>

          {/* Navigation */}
          <nav className="space-y-6">
            {(Object.keys(NAV_ITEMS) as NavSection[]).map((section) => (
              <div key={section}>
                <p className="text-micro mb-3">{NAV_ITEMS[section].label}</p>
                <ul className="space-y-0.5">
                  {NAV_ITEMS[section].items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => onNavChange(item.id)}
                        className={cn(
                          'w-full text-left py-1.5 transition-colors duration-200',
                          activeNav === item.id
                            ? 'link-active'
                            : 'text-[var(--paper-text)] hover:text-[var(--paper-terracotta)] pl-3.5'
                        )}
                        style={{ fontSize: 14, fontFamily: 'var(--font-body)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Workspace */}
        <div className="px-7 py-5">
          <Separator className="mb-5" style={{ backgroundColor: 'var(--paper-border)' }} />
          <p className="text-micro mb-2">WORKSPACE</p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full text-left cursor-pointer bg-transparent border-none p-0"
                style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 16, color: 'var(--paper-text-muted)' }}
              >
                {currentWorkspace.name}
                <span style={{ fontSize: 12, marginLeft: 6, fontFamily: 'var(--font-technical)', fontStyle: 'normal', color: 'var(--paper-text-dim)' }}>
                  {currentWorkspace.role}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="surface-elevated p-2"
              style={{ width: 240, border: 'none' }}
              align="start"
            >
              {WORKSPACES.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => onWorkspaceChange(ws.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded transition-colors duration-150',
                    ws.id === activeWorkspace
                      ? 'bg-[var(--paper-selection)]'
                      : 'hover:bg-[var(--paper-canvas)]'
                  )}
                  style={{ border: 'none', cursor: 'pointer', background: ws.id === activeWorkspace ? 'var(--paper-selection)' : 'transparent' }}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-charcoal)', display: 'block' }}>
                    {ws.name}
                  </span>
                  <span className="text-technical" style={{ fontSize: 11, color: 'var(--paper-text-dim)' }}>
                    {ws.role}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </ScrollArea>

      {/* Storage */}
      <div className="px-7 pb-7 pt-2">
        <Separator className="mb-5" style={{ backgroundColor: 'var(--paper-border)' }} />
        <p className="text-micro mb-3">STORAGE</p>
        <div
          className="rule-editorial mb-3"
          style={{ borderTopWidth: 1, borderColor: 'var(--paper-charcoal)' }}
        />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-charcoal)', marginBottom: 8 }}>
          6.7 GB <span style={{ color: 'var(--paper-text-muted)' }}>of 10 GB</span>
        </p>
        <div className="paper-progress-track mb-3">
          <div className="paper-progress-fill" style={{ width: '67%' }} />
        </div>
        <button
          className="link-editorial"
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Upgrade to Pro &rarr;
        </button>
      </div>
    </aside>
  )
}

// ─── Search & Filter Bar ─────────────────────────────────────────────

function SearchFilterBar({
  searchQuery,
  onSearchChange,
  activeTypeFilter,
  onTypeFilterChange,
  activeDateFilter,
  onDateFilterChange,
  sortBy,
  onSortChange,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
  activeTypeFilter: string
  onTypeFilterChange: (f: string) => void
  activeDateFilter: string
  onDateFilterChange: (f: string) => void
  sortBy: string
  onSortChange: (s: string) => void
}) {
  const typeFilters = ['all', 'images', 'videos', 'documents', 'audio']
  const typeLabels: Record<string, string> = {
    all: 'All types',
    images: 'Images',
    videos: 'Videos',
    documents: 'Documents',
    audio: 'Audio',
  }

  return (
    <div className="mb-8">
      {/* Search heading and input */}
      <h2 className="text-editorial mb-4" style={{ fontSize: 28 }}>
        Search your stash
      </h2>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Type to search files, collections, tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-transparent outline-none"
          style={{
            height: 48,
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            color: 'var(--paper-charcoal)',
            border: 'none',
            borderBottom: '1.5px solid var(--paper-border)',
            backgroundColor: 'var(--paper-cream)',
            padding: '0 0 8px 0',
            transition: 'border-color 200ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = 'var(--paper-terracotta)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = 'var(--paper-border)'
          }}
        />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-6 flex-wrap">
        {/* Type filters */}
        <div className="flex items-center gap-4">
          {typeFilters.map((f) => (
            <button
              key={f}
              onClick={() => onTypeFilterChange(f)}
              className={cn(
                'filter-text',
                activeTypeFilter === f && 'filter-text-active'
              )}
            >
              {typeLabels[f]}
            </button>
          ))}
        </div>

        <span style={{ color: 'var(--paper-border)', fontSize: 18, lineHeight: 1 }}>|</span>

        {/* Date filter */}
        <Select value={activeDateFilter} onValueChange={onDateFilterChange}>
          <SelectTrigger
            className="border-none bg-transparent shadow-none h-auto p-0"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: activeDateFilter !== 'anytime' ? 'var(--paper-terracotta)' : 'var(--paper-text-muted)',
              width: 'auto',
              minWidth: 80,
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="surface-elevated" style={{ border: 'none' }}>
            <SelectItem value="anytime">Anytime</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger
            className="border-none bg-transparent shadow-none h-auto p-0"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--paper-text-muted)',
              width: 'auto',
              minWidth: 120,
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="surface-elevated" style={{ border: 'none' }}>
            <SelectItem value="date-desc">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="size-desc">Largest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── File Thumbnail ──────────────────────────────────────────────────

function FileThumbnail({
  file,
  className,
  style,
}: {
  file: MockFile
  className?: string
  style?: React.CSSProperties
}) {
  if (file.thumbnail) {
    return (
      <div
        className={cn('rounded overflow-hidden', className)}
        style={{ background: file.thumbnail, ...style }}
      />
    )
  }

  return (
    <div
      className={cn('rounded overflow-hidden flex items-center justify-center', className)}
      style={{ backgroundColor: file.color, ...style }}
    >
      <span
        style={{
          fontFamily: 'var(--font-technical)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--paper-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {FILE_TYPE_LABELS[file.type]}
      </span>
    </div>
  )
}

// ─── Magazine Grid View ──────────────────────────────────────────────

function MagazineGridView({
  files,
  selectedFiles,
  onToggleSelect,
  onOpenShare,
}: {
  files: MockFile[]
  selectedFiles: Set<string>
  onToggleSelect: (id: string, shiftKey: boolean) => void
  onOpenShare: (file: MockFile) => void
}) {
  const heroFile = files[0]
  const restFiles = files.slice(1)

  return (
    <div
      className="grid gap-6"
      style={{
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridAutoRows: 'auto',
      }}
    >
      {/* Hero card — spans 2 cols, 2 rows */}
      {heroFile && (
        <div
          className={cn(
            'card-hero cursor-pointer',
            selectedFiles.has(heroFile.id) && 'ring-2 ring-[var(--paper-terracotta)]'
          )}
          style={{ gridColumn: 'span 2', gridRow: 'span 2' }}
          onClick={(e) => onToggleSelect(heroFile.id, e.shiftKey)}
        >
          <div className="p-6">
            <FileThumbnail
              file={heroFile}
              style={{ width: '100%', aspectRatio: '16/9', marginBottom: 20 }}
            />
            <h3 className="text-editorial" style={{ fontSize: 22, marginBottom: 6 }}>
              {heroFile.name}
            </h3>
            {heroFile.description && (
              <p style={{ fontSize: 14, color: 'var(--paper-text-muted)', marginBottom: 8, fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                {heroFile.description}
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="pill-terracotta">{FILE_TYPE_LABELS[heroFile.type]}</span>
              <span className="text-technical">{heroFile.size}</span>
              <span className="text-technical">{heroFile.date}</span>
            </div>
          </div>
        </div>
      )}

      {/* Standard cards */}
      {restFiles.map((file) => (
        <div
          key={file.id}
          className={cn(
            'card-editorial cursor-pointer',
            selectedFiles.has(file.id) && 'ring-2 ring-[var(--paper-terracotta)]'
          )}
          onClick={(e) => onToggleSelect(file.id, e.shiftKey)}
        >
          <div className="p-6">
            <FileThumbnail
              file={file}
              style={{ width: '100%', aspectRatio: '4/3', marginBottom: 16 }}
            />
            <h4 className="text-editorial" style={{ fontSize: 16, marginBottom: 4, lineHeight: 1.3 }}>
              {file.name}
            </h4>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-technical" style={{ fontSize: 12 }}>
                {FILE_TYPE_LABELS[file.type]}
              </span>
              <span style={{ color: 'var(--paper-text-dim)' }}>&middot;</span>
              <span className="text-technical" style={{ fontSize: 12 }}>
                {file.size}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--paper-text-dim)', marginTop: 4 }}>
              {file.date}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Reading List View ───────────────────────────────────────────────

function ReadingListView({
  files,
  selectedFiles,
  onToggleSelect,
  expandedFile,
  onToggleExpand,
}: {
  files: MockFile[]
  selectedFiles: Set<string>
  onToggleSelect: (id: string, shiftKey: boolean) => void
  expandedFile: string | null
  onToggleExpand: (id: string) => void
}) {
  return (
    <div>
      {/* Column header */}
      <div
        className="flex items-center gap-4 px-4 pb-3 mb-1"
        style={{
          fontFamily: 'var(--font-technical)',
          fontSize: 11,
          color: 'var(--paper-text-dim)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ width: 60 }} />
        <div className="flex-1">Name</div>
        <div style={{ width: 80 }}>Type</div>
        <div style={{ width: 110 }}>Date</div>
        <div style={{ width: 80, textAlign: 'right' }}>Size</div>
        <div style={{ width: 60 }} />
      </div>
      <Separator style={{ backgroundColor: 'var(--paper-charcoal)', marginBottom: 4 }} />

      {files.map((file) => (
        <div key={file.id}>
          <div
            className={cn(
              'row-reading flex items-center gap-4 px-4 py-3 cursor-pointer',
              selectedFiles.has(file.id) && 'row-reading-selected'
            )}
            onClick={(e) => {
              if (e.shiftKey) {
                onToggleSelect(file.id, true)
              } else {
                onToggleExpand(file.id)
              }
            }}
          >
            {/* Thumbnail */}
            <FileThumbnail file={file} style={{ width: 60, height: 60, flexShrink: 0 }} />

            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <p
                className="text-editorial truncate"
                style={{ fontSize: 16, lineHeight: 1.3 }}
              >
                {file.name}
              </p>
              {file.description && (
                <p
                  className="truncate"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--paper-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {file.description}
                </p>
              )}
            </div>

            {/* Type pill */}
            <div style={{ width: 80 }}>
              <span className="pill-neutral">{FILE_TYPE_LABELS[file.type]}</span>
            </div>

            {/* Date */}
            <div style={{ width: 110 }}>
              <span className="text-technical">{file.date}</span>
            </div>

            {/* Size */}
            <div style={{ width: 80, textAlign: 'right' }}>
              <span className="text-technical">{file.size}</span>
            </div>

            {/* Actions */}
            <div style={{ width: 60, textAlign: 'right' }}>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded transition-colors hover:bg-[var(--paper-canvas)]"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 18,
                      color: 'var(--paper-text-dim)',
                      lineHeight: 1,
                    }}
                  >
                    &hellip;
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="surface-elevated" style={{ border: 'none', minWidth: 160 }}>
                  <DropdownMenuItem style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>Download</DropdownMenuItem>
                  <DropdownMenuItem style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>Share</DropdownMenuItem>
                  <DropdownMenuItem style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>Move</DropdownMenuItem>
                  <DropdownMenuItem style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>Rename</DropdownMenuItem>
                  <DropdownMenuItem style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-rust)' }}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded detail panel */}
          {expandedFile === file.id && (
            <div className="paper-fade-in px-4 py-5 flex gap-6" style={{ backgroundColor: 'var(--paper-cream)' }}>
              <FileThumbnail
                file={file}
                style={{ width: 200, height: 150, flexShrink: 0 }}
              />
              <div className="flex-1">
                <h4 className="text-editorial mb-2" style={{ fontSize: 20 }}>{file.name}</h4>
                {file.description && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                    {file.description}
                  </p>
                )}
                <div
                  className="grid gap-y-2 gap-x-8"
                  style={{
                    gridTemplateColumns: 'auto 1fr',
                    fontFamily: 'var(--font-technical)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--paper-text-dim)' }}>Type</span>
                  <span>{FILE_TYPE_LABELS[file.type]}</span>
                  <span style={{ color: 'var(--paper-text-dim)' }}>Size</span>
                  <span>{file.size}</span>
                  <span style={{ color: 'var(--paper-text-dim)' }}>Modified</span>
                  <span>{file.date}</span>
                  <span style={{ color: 'var(--paper-text-dim)' }}>Location</span>
                  <span>/stash/all</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Contact Sheet View ──────────────────────────────────────────────

function ContactSheetView({
  files,
  selectedFiles,
  onToggleSelect,
}: {
  files: MockFile[]
  selectedFiles: Set<string>
  onToggleSelect: (id: string, shiftKey: boolean) => void
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
    >
      {files.map((file) => (
        <div
          key={file.id}
          className={cn(
            'thumb-contact cursor-pointer',
            selectedFiles.has(file.id) && 'ring-2 ring-[var(--paper-terracotta)]'
          )}
          onClick={(e) => onToggleSelect(file.id, e.shiftKey)}
        >
          {/* Thumbnail */}
          {file.thumbnail ? (
            <div
              className="w-full h-full"
              style={{ background: file.thumbnail }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: file.color }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-technical)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--paper-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {FILE_TYPE_LABELS[file.type]}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="thumb-contact-overlay">
            <span
              style={{
                fontFamily: 'var(--font-technical)',
                fontSize: 11,
                color: 'white',
                lineHeight: 1.3,
                wordBreak: 'break-all',
              }}
            >
              {file.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-technical)',
                fontSize: 10,
                color: 'oklch(0.8 0 0)',
                marginTop: 2,
              }}
            >
              {file.size}
            </span>
          </div>

          {/* Selection indicator */}
          {selectedFiles.has(file.id) && (
            <div
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: 'var(--paper-terracotta)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      ))}

      {/* Filename strip below thumbnails */}
      {files.map((file) => (
        <p
          key={`label-${file.id}`}
          className="truncate"
          style={{
            fontFamily: 'var(--font-technical)',
            fontSize: 11,
            color: 'var(--paper-text-muted)',
            paddingTop: 4,
            lineHeight: 1.3,
          }}
        >
          {file.name}
        </p>
      ))}
    </div>
  )
}

// ─── Upload Panel ────────────────────────────────────────────────────

function UploadPanel({
  uploads,
  open,
  onClose,
}: {
  uploads: MockUpload[]
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  const activeCount = uploads.filter((u) => !u.completed).length

  return (
    <div
      className="paper-slide-in-right surface-elevated flex flex-col"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        zIndex: 40,
        borderLeft: '1px solid var(--paper-border-hairline)',
      }}
    >
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <h3 className="text-editorial" style={{ fontSize: 20 }}>
            Uploading
          </h3>
          <p className="text-technical" style={{ marginTop: 2 }}>
            {activeCount > 0 ? `${activeCount} in progress` : 'All complete'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: 'var(--paper-text-dim)',
            padding: '4px 8px',
          }}
        >
          &times;
        </button>
      </div>

      <Separator style={{ backgroundColor: 'var(--paper-border-hairline)' }} />

      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-4">
          {uploads.map((upload) => (
            <div key={upload.id} className="py-2">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="truncate flex-1"
                  style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-charcoal)' }}
                >
                  {upload.name}
                </span>
                {upload.completed && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
                    <path d="M4 8L7 11L12 5" stroke="var(--paper-sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {!upload.completed && (
                <div className="paper-progress-thin mb-1.5">
                  <div className="paper-progress-thin-fill" style={{ width: `${upload.progress}%` }} />
                </div>
              )}
              <div className="flex items-center gap-3 text-technical" style={{ fontSize: 11 }}>
                <span>{upload.size}</span>
                {upload.speed && (
                  <>
                    <span style={{ color: 'var(--paper-text-dim)' }}>&middot;</span>
                    <span>{upload.speed}</span>
                  </>
                )}
                {upload.completed && (
                  <span style={{ color: 'var(--paper-sage)' }}>Complete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Sharing Dialog ──────────────────────────────────────────────────

function ShareDialog({
  open,
  onOpenChange,
  file,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: MockFile | null
}) {
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [linkSharing, setLinkSharing] = React.useState(false)
  const [collaborators, setCollaborators] = React.useState(MOCK_COLLABORATORS)
  const [linkCopied, setLinkCopied] = React.useState(false)

  if (!file) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="surface-dialog sm:max-w-lg"
        style={{ border: 'none', padding: 0 }}
      >
        <div className="px-8 pt-8 pb-4">
          <DialogHeader className="mb-1">
            <DialogTitle
              className="text-editorial"
              style={{ fontSize: 20, fontWeight: 400 }}
            >
              {file.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Share settings for {file.name}
            </DialogDescription>
          </DialogHeader>
          <span className="pill-terracotta mt-1 inline-flex">{FILE_TYPE_LABELS[file.type]}</span>
        </div>

        <Separator style={{ backgroundColor: 'var(--paper-border-hairline)' }} />

        <div className="px-8 py-5 space-y-6">
          {/* Invite section */}
          <div>
            <p
              className="text-micro mb-3"
              style={{ letterSpacing: '0.1em' }}
            >
              INVITE
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{
                  flex: 1,
                  height: 40,
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  border: '1px solid var(--paper-border)',
                  borderRadius: 'var(--radius)',
                  padding: '0 12px',
                  backgroundColor: 'var(--paper-white)',
                  color: 'var(--paper-charcoal)',
                  outline: 'none',
                }}
              />
              <Button
                variant="default"
                style={{
                  backgroundColor: 'var(--paper-charcoal)',
                  color: 'var(--paper-cream)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  height: 40,
                  borderRadius: 'var(--radius)',
                }}
              >
                Send
              </Button>
            </div>
          </div>

          <Separator style={{ backgroundColor: 'var(--paper-border-hairline)' }} />

          {/* People with access */}
          <div>
            <p className="text-micro mb-3" style={{ letterSpacing: '0.1em' }}>
              PEOPLE WITH ACCESS
            </p>
            <div className="space-y-3">
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center gap-3">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'var(--paper-canvas)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--paper-text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {collab.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-charcoal)' }}>
                      {collab.name}
                    </p>
                    <p className="text-technical truncate" style={{ fontSize: 12 }}>
                      {collab.email}
                    </p>
                  </div>
                  <Select
                    value={collab.permission}
                    onValueChange={(val) => {
                      setCollaborators((prev) =>
                        prev.map((c) =>
                          c.id === collab.id ? { ...c, permission: val as Permission } : c
                        )
                      )
                    }}
                  >
                    <SelectTrigger
                      className="border-none bg-transparent shadow-none h-auto p-0"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 13,
                        color: 'var(--paper-text-muted)',
                        width: 'auto',
                        minWidth: 70,
                      }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="surface-elevated" style={{ border: 'none' }}>
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <Separator style={{ backgroundColor: 'var(--paper-border-hairline)' }} />

          {/* Link sharing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-micro" style={{ letterSpacing: '0.1em' }}>
                LINK SHARING
              </p>
              <Switch
                checked={linkSharing}
                onCheckedChange={setLinkSharing}
              />
            </div>
            {linkSharing && (
              <div className="paper-fade-in space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://stashly.app/share/abc123def456"
                    style={{
                      flex: 1,
                      height: 36,
                      fontFamily: 'var(--font-technical)',
                      fontSize: 12,
                      border: '1px solid var(--paper-border)',
                      borderRadius: 'var(--radius)',
                      padding: '0 10px',
                      backgroundColor: 'var(--paper-canvas)',
                      color: 'var(--paper-text-muted)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2000)
                    }}
                    className="link-editorial"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      padding: '0 4px',
                    }}
                  >
                    {linkCopied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-technical" style={{ fontSize: 12 }}>
                    Expires: Apr 21, 2026
                  </span>
                  <span style={{ color: 'var(--paper-text-dim)' }}>&middot;</span>
                  <span className="text-technical" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Password
                    <Switch defaultChecked={false} />
                  </span>
                </div>

                {/* Permission levels */}
                <div className="mt-3 space-y-2">
                  {(
                    [
                      { value: 'view', label: 'View', desc: 'Can see and download' },
                      { value: 'comment', label: 'Comment', desc: 'Can add comments and annotations' },
                      { value: 'edit', label: 'Edit', desc: 'Can modify and reorganize' },
                      { value: 'admin', label: 'Admin', desc: 'Full control including sharing' },
                    ] as const
                  ).map((perm) => (
                    <label
                      key={perm.value}
                      className="flex items-start gap-3 p-2 rounded cursor-pointer hover:bg-[var(--paper-canvas)] transition-colors"
                    >
                      <input
                        type="radio"
                        name="link-permission"
                        defaultChecked={perm.value === 'view'}
                        style={{ marginTop: 3, accentColor: 'var(--paper-terracotta)' }}
                      />
                      <div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--paper-charcoal)' }}>
                          {perm.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--paper-text-muted)', display: 'block', marginTop: 1 }}>
                          {perm.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator style={{ backgroundColor: 'var(--paper-border-hairline)' }} />

        <DialogFooter className="px-8 py-5">
          <Button
            onClick={() => onOpenChange(false)}
            style={{
              backgroundColor: 'var(--paper-charcoal)',
              color: 'var(--paper-cream)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              height: 40,
              borderRadius: 'var(--radius)',
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Storage Detail Section ──────────────────────────────────────────

function StorageDetail() {
  const breakdown = [
    { label: 'Images', size: '2.8 GB', pct: 42, className: 'paper-bar-images' },
    { label: 'Videos', size: '2.1 GB', pct: 31, className: 'paper-bar-videos' },
    { label: 'Documents', size: '1.2 GB', pct: 18, className: 'paper-bar-documents' },
    { label: 'Other', size: '0.6 GB', pct: 9, className: 'paper-bar-other' },
  ]

  return (
    <div className="mb-10">
      {/* Large stat */}
      <p className="text-display" style={{ marginBottom: 4 }}>
        6.7 GB
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--paper-text-muted)', marginBottom: 24 }}>
        used of 10 GB
      </p>

      {/* Stacked bar */}
      <div
        className="flex w-full overflow-hidden mb-4"
        style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--paper-border-hairline)' }}
      >
        {breakdown.map((item) => (
          <div
            key={item.label}
            className={item.className}
            style={{ width: `${item.pct}%`, transition: 'width 400ms ease' }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className={item.className}
              style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}
            />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--paper-text-muted)' }}>
              {item.label}
            </span>
            <span className="text-technical" style={{ fontSize: 12 }}>
              {item.size}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Drop Zone Overlay ───────────────────────────────────────────────

function DropZoneOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="paper-drop-zone paper-fade-in">
      <p className="paper-drop-zone-text">Drop your files here</p>
      <div
        style={{
          width: 180,
          height: 1,
          backgroundColor: 'var(--paper-charcoal)',
          margin: '8px 0 12px',
        }}
      />
      <p className="paper-drop-zone-subtext">
        Supported formats: images, documents, videos, and more
      </p>
    </div>
  )
}

// ─── Bulk Selection Bar ──────────────────────────────────────────────

function BulkSelectionBar({
  count,
  onClear,
}: {
  count: number
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="paper-selection-bar">
      <span>
        {count} item{count !== 1 ? 's' : ''} selected
      </span>
      <span style={{ color: 'var(--paper-text-dim)' }}>&middot;</span>
      <button>Move</button>
      <button>Copy</button>
      <button>Share</button>
      <button style={{ color: 'oklch(0.75 0.12 25)' }}>Delete</button>
      <span style={{ color: 'var(--paper-text-dim)' }}>&middot;</span>
      <button onClick={onClear}>Clear</button>
    </div>
  )
}

// ─── View Mode Toggle ────────────────────────────────────────────────

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {(
        [
          { id: 'magazine' as const, label: 'Magazine' },
          { id: 'reading' as const, label: 'Reading List' },
          { id: 'contact' as const, label: 'Contact Sheet' },
        ]
      ).map((mode) => (
        <button
          key={mode.id}
          onClick={() => onViewModeChange(mode.id)}
          className={cn(
            'filter-text',
            viewMode === mode.id && 'filter-text-active'
          )}
          style={{ marginRight: 12 }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export default function OptionCDemo() {
  // State
  const [activeNav, setActiveNav] = React.useState('all')
  const [activeWorkspace, setActiveWorkspace] = React.useState('w1')
  const [viewMode, setViewMode] = React.useState<ViewMode>('magazine')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [activeTypeFilter, setActiveTypeFilter] = React.useState('all')
  const [activeDateFilter, setActiveDateFilter] = React.useState('anytime')
  const [sortBy, setSortBy] = React.useState('date-desc')
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set())
  const [expandedFile, setExpandedFile] = React.useState<string | null>(null)
  const [uploadPanelOpen, setUploadPanelOpen] = React.useState(false)
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)
  const [shareFile, setShareFile] = React.useState<MockFile | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null)

  // Filter files
  const filteredFiles = React.useMemo(() => {
    let result = [...MOCK_FILES]

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.type.includes(q)
      )
    }

    // Type filter
    if (activeTypeFilter !== 'all') {
      const typeMap: Record<string, FileType[]> = {
        images: ['image'],
        videos: ['video'],
        documents: ['document'],
        audio: ['audio'],
      }
      const types = typeMap[activeTypeFilter]
      if (types) {
        result = result.filter((f) => types.includes(f.type))
      }
    }

    // Sort
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'size-desc':
        result.sort((a, b) => b.sizeBytes - a.sizeBytes)
        break
      case 'date-asc':
        result.reverse()
        break
      // date-desc is default order
    }

    return result
  }, [searchQuery, activeTypeFilter, sortBy])

  // Selection handlers
  const handleToggleSelect = React.useCallback(
    (id: string, shiftKey: boolean) => {
      const currentIndex = filteredFiles.findIndex((f) => f.id === id)

      if (shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)
        const newSet = new Set(selectedFiles)
        for (let i = start; i <= end; i++) {
          newSet.add(filteredFiles[i].id)
        }
        setSelectedFiles(newSet)
      } else {
        setSelectedFiles((prev) => {
          const next = new Set(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        })
      }
      setLastSelectedIndex(currentIndex)
    },
    [filteredFiles, lastSelectedIndex, selectedFiles]
  )

  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedFile((prev) => (prev === id ? null : id))
  }, [])

  const handleOpenShare = React.useCallback((file: MockFile) => {
    setShareFile(file)
    setShareDialogOpen(true)
  }, [])

  const hasActiveUploads = MOCK_UPLOADS.some((u) => !u.completed)

  return (
    <TooltipProvider>
      <div
        data-theme="paper"
        className="surface-paper flex h-screen overflow-hidden"
        style={{ fontFamily: 'var(--font-body)' }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
      >
        {/* Sidebar */}
        <CanvasSidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
        />

        {/* Main content */}
        <main className="flex-1 relative overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-10 py-8" style={{ maxWidth: 1200 }}>
              {/* Top bar with view toggle and upload indicator */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2
                    className="text-editorial"
                    style={{ fontSize: 32, marginBottom: 4 }}
                  >
                    {activeNav === 'all'
                      ? 'All Files'
                      : activeNav === 'home'
                        ? 'Home'
                        : activeNav === 'recent'
                          ? 'Recent'
                          : activeNav === 'images'
                            ? 'Images'
                            : activeNav === 'videos'
                              ? 'Videos'
                              : activeNav === 'documents'
                                ? 'Documents'
                                : activeNav === 'collections'
                                  ? 'Collections'
                                  : activeNav === 'favorites'
                                    ? 'Favorites'
                                    : activeNav === 'tags'
                                      ? 'Tags'
                                      : activeNav === 'shared'
                                        ? 'Shared'
                                        : activeNav === 'invitations'
                                          ? 'Invitations'
                                          : activeNav === 'trash'
                                            ? 'Trash'
                                            : 'All Files'}
                  </h2>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-text-muted)' }}>
                    {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Upload indicator */}
                  {hasActiveUploads && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setUploadPanelOpen(!uploadPanelOpen)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors hover:bg-[var(--paper-canvas)]"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <span className="upload-dot" />
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--paper-text-muted)' }}>
                            Uploading
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent style={{ fontFamily: 'var(--font-body)' }}>
                        View uploads
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Search and filters */}
              <SearchFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeTypeFilter={activeTypeFilter}
                onTypeFilterChange={setActiveTypeFilter}
                activeDateFilter={activeDateFilter}
                onDateFilterChange={setActiveDateFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />

              {/* Storage detail — show when home is active */}
              {activeNav === 'home' && <StorageDetail />}

              {/* View mode toggle */}
              <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

              {/* Content views */}
              {filteredFiles.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-editorial" style={{ fontSize: 22, marginBottom: 8, color: 'var(--paper-text-muted)' }}>
                    No files found
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--paper-text-dim)' }}>
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : viewMode === 'magazine' ? (
                <MagazineGridView
                  files={filteredFiles}
                  selectedFiles={selectedFiles}
                  onToggleSelect={handleToggleSelect}
                  onOpenShare={handleOpenShare}
                />
              ) : viewMode === 'reading' ? (
                <ReadingListView
                  files={filteredFiles}
                  selectedFiles={selectedFiles}
                  onToggleSelect={handleToggleSelect}
                  expandedFile={expandedFile}
                  onToggleExpand={handleToggleExpand}
                />
              ) : (
                <ContactSheetView
                  files={filteredFiles}
                  selectedFiles={selectedFiles}
                  onToggleSelect={handleToggleSelect}
                />
              )}

              {/* Footer */}
              <div className="mt-12 pt-6 border-hairline-t">
                <div className="flex items-center justify-between">
                  <span className="folio">Stashly &middot; Paper Canvas</span>
                  <span className="folio">{filteredFiles.length} files</span>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Upload panel */}
          <UploadPanel
            uploads={MOCK_UPLOADS}
            open={uploadPanelOpen}
            onClose={() => setUploadPanelOpen(false)}
          />

          {/* Drop zone overlay */}
          <DropZoneOverlay visible={isDragging} />
        </main>

        {/* Bulk selection bar */}
        <BulkSelectionBar
          count={selectedFiles.size}
          onClear={() => setSelectedFiles(new Set())}
        />

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          file={shareFile}
        />
      </div>
    </TooltipProvider>
  )
}
