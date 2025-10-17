"use client"

import { FileText, Share2, Edit, Trash2 } from "lucide-react"
import type { FileType } from "@/components/file-manager"

type FilePreviewProps = {
  file: FileType
}

export function FilePreview({ file }: FilePreviewProps) {
  return (
    <div className="w-[320px] bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col">
      {/* Header */}
      <div className="h-[72px] border-b border-[#2a2a2a] flex items-center px-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border border-gray-600 rounded" />
          <h2 className="text-white text-sm font-medium">File Preview</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* File Icon Preview */}
        <div className="flex justify-center mb-6">
          <div className="w-32 h-40 rounded-lg bg-gray-500 flex items-center justify-center">
            <FileText className="w-16 h-16 text-gray-700" />
          </div>
        </div>

        {/* File Info */}
        <div className="mb-6">
          <h3 className="text-white text-base font-medium mb-1 text-balance">{file.name}</h3>
          <p className="text-gray-500 text-xs">2.5 GB, 01H-40M-45S</p>
        </div>

        {/* File Description */}
        {file.description && (
          <div className="mb-6">
            <h4 className="text-white text-sm font-medium mb-2">File Description</h4>
            <p className="text-gray-400 text-sm leading-relaxed">{file.description}</p>
          </div>
        )}

        {/* Shared With */}
        <div className="mb-6">
          <h4 className="text-white text-sm font-medium mb-3">File Shared With:</h4>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
              A
            </div>
            <span className="text-gray-400 text-sm">Alexander Mikoleienko (You)</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#2a2a2a] p-6">
        <div className="grid grid-cols-3 gap-4">
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <Share2 className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 text-xs">Share</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <Edit className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 text-xs">Edit</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <Trash2 className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 text-xs">Delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
