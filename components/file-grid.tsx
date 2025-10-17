"use client"

import { Search, Star, ChevronDown, ChevronRight, List, Grid3x3, LayoutGrid, Folder } from "lucide-react"
import { FileCard } from "@/app/components/file-card"
import { FolderCard } from "@/components/folder-card"
import { FileListItem } from "@/components/file-list-item"
import type { FileType, FolderType } from "@/app/components/file-manager"
import { Button } from "@/components/ui/button"

type FileGridProps = {
  folders: FolderType[]
  files: FileType[]
  onFileSelect: (file: FileType) => void
  selectedFileId: string
  viewMode: "files" | "videos"
}

export function FileGrid({ folders, files, onFileSelect, selectedFileId, viewMode }: FileGridProps) {
  return (
    <div className="flex-1 flex flex-col bg-background">
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
        {viewMode === "files" ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {/* Folder icon with dropdown */}
                <button className="flex items-center gap-2 px-3 py-2 bg-card hover:bg-accent rounded-lg transition-colors">
                  <Folder className="w-5 h-5 text-muted-foreground" />
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Breadcrumb trail */}
                <div className="flex items-center gap-2 text-base">
                  <span className="text-muted-foreground">All Files</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground font-medium">Personal Stuff</span>
                </div>
              </div>

              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <div className="w-4 h-4 rounded bg-muted" />
                <span>Show All</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Folders Grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {folders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>

            {/* All Files Section */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-sm">
                <button className="p-1 hover:bg-accent rounded transition-colors">
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-foreground">All Files</span>
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

            {/* Files List View */}
            <div className="flex flex-col gap-1">
              {files.map((file) => (
                <FileListItem
                  key={file.id}
                  file={file}
                  onClick={() => {
                    onFileSelect(file.id === selectedFileId ? null : file)
                  }}
                  isSelected={file.id === selectedFileId}
                />
              ))}
            </div>
          </>
        ) : (
          <>
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
                    onFileSelect(file.id === selectedFileId ? null : file)
                  }}
                  isSelected={file.id === selectedFileId}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
