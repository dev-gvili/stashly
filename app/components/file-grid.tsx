"use client"

import { Search, Star, ChevronDown, List, Grid3x3, LayoutGrid } from "lucide-react"
import { FileCard } from "@/app/components/file-card"
import type { FileType } from "@/app/components/file-manager"

type FileGridProps = {
  files: FileType[]
  onFileSelect: (file: FileType) => void
  selectedFileId: string
}

export function FileGrid({ files, onFileSelect, selectedFileId }: FileGridProps) {
  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="h-[72px] border-b border-[#2a2a2a] flex items-center justify-between px-6">
        <h1 className="text-white text-lg font-medium">Dropbox</h1>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <div className="w-5 h-5 border border-gray-600 rounded" />
          </button>
          <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <Search className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <Star className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-[#2a2a2a] rounded transition-colors">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            <h2 className="text-white text-base font-medium">Recent Files</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
              <List className="w-4 h-4 text-gray-400" />
            </button>
            <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
              <Grid3x3 className="w-4 h-4 text-gray-400" />
            </button>
            <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
              <LayoutGrid className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* File Grid */}
        <div className="grid grid-cols-3 gap-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onClick={() => onFileSelect(file)}
              isSelected={file.id === selectedFileId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
