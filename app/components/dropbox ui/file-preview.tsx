"use client"

import { useState } from "react"
import { Share2, Edit, Trash2, Play, MessageSquare, FileText } from "lucide-react"
import type { FileType } from "@/components/file-manager"
import { ShareFolderModal } from "@/components/share-folder-modal"
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar"

type FilePreviewProps = {
  file: FileType | null
  onShowComments?: () => void
}

export function FilePreview({ file, onShowComments }: FilePreviewProps) {
  const [showShareModal, setShowShareModal] = useState(false)

  return (
    <>
      <Sidebar
        className="sticky top-0 bottom-0 hidden h-svh lg:flex w-[320px] bg-background border-l border-border"
        side="right"
      >
        {/* Header */}
        <SidebarHeader className="h-[72px] border-b border-border flex flex-row items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border border-muted-foreground rounded" />
            <h2 className="text-foreground text-sm font-medium">File Preview</h2>
          </div>
          {file && onShowComments && (
            <button
              onClick={onShowComments}
              className="ml-auto p-2 hover:bg-accent rounded transition-colors"
              title="Show comments"
            >
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </SidebarHeader>

        {/* Content */}
        {!file ? (
          <SidebarContent className="flex flex-col items-center justify-center p-6 h-full">
            <div className="w-24 h-24 rounded-lg bg-card flex items-center justify-center mb-4">
              <FileText className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-foreground text-base font-medium mb-2">No File Selected</h3>
            <p className="text-muted-foreground text-sm text-center leading-relaxed">
              When you'll select one of the files, you'll be able to see all the details and managing options
            </p>
          </SidebarContent>
        ) : (
          <SidebarContent className="p-6">
            {file.type === "mp4" && file.thumbnail ? (
              <div className="relative mb-6 rounded-lg overflow-hidden">
                <img
                  src={file.thumbnail || "/placeholder.svg"}
                  alt="Video thumbnail"
                  className="w-full h-auto aspect-video object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-black ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <div className="w-32 h-40 rounded-lg bg-gray-500 flex items-center justify-center">
                  <div className="text-4xl text-gray-700">📄</div>
                </div>
              </div>
            )}

            {/* File Info */}
            <div className="mb-6">
              <h3 className="text-foreground text-base font-medium mb-1 text-balance">{file.name}</h3>
              <p className="text-muted-foreground text-xs">
                {file.size}, {file.type === "mp4" ? "01H-40M-45S" : file.date}
              </p>
            </div>

            {/* File Description */}
            {file.description && (
              <div className="mb-6">
                <h4 className="text-foreground text-sm font-medium mb-2">File Description</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{file.description}</p>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-foreground text-sm font-medium mb-3">File Shared With:</h4>
              <div className="flex flex-col gap-3">
                {file.sharedWith.map((user, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-foreground text-sm font-medium flex-shrink-0">
                      {user.initial}
                    </div>
                    <span className="text-muted-foreground text-sm">{user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </SidebarContent>
        )}

        {/* Actions */}
        {file && (
          <SidebarFooter className="border-t border-border p-6">
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex flex-col items-center gap-2 p-3 hover:bg-accent rounded-lg transition-colors"
              >
                <Share2 className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Share</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3 hover:bg-accent rounded-lg transition-colors">
                <Edit className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Edit</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3 hover:bg-accent rounded-lg transition-colors">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Delete</span>
              </button>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>

      {showShareModal && <ShareFolderModal onClose={() => setShowShareModal(false)} />}
    </>
  )
}
