import {
  Search,
  Star,
  ChevronDown,
  ChevronRight,
  List,
  Grid3x3,
  LayoutGrid,
  Folder,
} from 'lucide-react'
import { FileCard } from '@/components/dropbox ui/file-card'
import { FolderCard } from '@/components/dropbox ui/folder-card'
import { FileListItem } from '@/components/dropbox ui/file-list-item'
import type { FileType, FolderType } from '@/components/dropbox ui/file-manager'
import { Button } from '@/components/ui/button'

type FileGridProps = {
  folders: FolderType[]
  files: FileType[]
  onFileSelect: (file: FileType) => void
  selectedFileId: string
  viewMode: 'files' | 'videos'
}

export function FileGrid({
  folders,
  files,
  onFileSelect,
  selectedFileId,
  viewMode,
}: FileGridProps) {
  return (
    <div className="flex flex-col bg-background">
      {/* Header */}
      <div className="h-[72px] border-b border-border flex items-center justify-between px-6">
        <h1 className="text-foreground text-lg font-medium">Dropbox</h1>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
            <div className="w-5 h-5 border border-muted-foreground rounded" />
          </button>
          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
            <Star className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm">
            <button className="p-1 hover:bg-accent rounded transition-colors">
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-foreground">Videos</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-accent rounded-lg transition-colors">
              <List className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="p-2 hover:bg-accent rounded-lg transition-colors">
              <Grid3x3 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="p-2 bg-accent rounded-lg transition-colors">
              <LayoutGrid className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        <div className="gap-2 pb-10 grid grid-cols-[repeat(auto-fill,_minmax(16rem,_1fr))] auto-rows-min">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onClick={() => {
                onFileSelect(file.id === selectedFileId ? (null as any) : file)
              }}
              isSelected={file.id === selectedFileId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
