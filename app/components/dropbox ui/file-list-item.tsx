'use client'

import { FileText, Star, MoreVertical, Film, FileCode } from 'lucide-react'
import type { FileType } from '@/components/file-manager'

type FileListItemProps = {
  file: FileType
  onClick: () => void
  isSelected: boolean
}

const fileIcons = {
  pdf: FileText,
  word: FileText,
  mp4: Film,
  sketch: FileCode,
  diamond: FileCode,
}

export function FileListItem({ file, onClick, isSelected }: FileListItemProps) {
  const Icon = fileIcons[file.type as keyof typeof fileIcons]

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
        isSelected ? 'bg-accent' : 'hover:bg-card'
      }`}
    >
      {/* File Icon */}
      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* File Name */}
      <div className="flex-1 text-left">
        <p className="text-foreground text-sm">{file.name}</p>
      </div>

      {/* Date */}
      <div className="text-muted-foreground text-sm w-24 text-right">
        {file.date}
      </div>

      {/* Shared With Badges */}
      <div className="flex items-center gap-1">
        {file.sharedWith.map((user, index) => (
          <div
            key={index}
            className="w-7 h-7 rounded bg-muted flex items-center justify-center text-foreground text-xs font-medium"
          >
            {user.initial}
          </div>
        ))}
      </div>

      {/* Star Icon */}
      <button className="p-1 hover:bg-accent rounded transition-colors">
        <Star className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* More Menu */}
      <button className="p-1 hover:bg-accent rounded transition-colors">
        <MoreVertical className="w-5 h-5 text-muted-foreground" />
      </button>
    </button>
  )
}
