import { Play, Share, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/UserAvatar'
import { FileItem } from '@/types/file'

interface FilePreviewPanelProps {
  file: FileItem | null
  onClose: () => void
}

export function FilePreviewPanel({ file, onClose }: FilePreviewPanelProps) {
  if (!file) return null

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-lg">File Preview</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-6 space-y-6">
        {/* Video Preview */}
        {file.type === 'mp4' && file.thumbnail && (
          <div className="relative">
            <img
              src={file.thumbnail}
              alt="Video preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg hover:bg-opacity-40 transition-opacity">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </button>
          </div>
        )}

        {/* File Details */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-foreground text-lg mb-2">{file.name}</h4>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{file.size}</span>
              {file.duration && <span>{file.duration}</span>}
            </div>
          </div>

          {file.description && (
            <div>
              <h5 className="text-sm font-semibold text-foreground mb-2">Description</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {file.description}
              </p>
            </div>
          )}

          <div>
            <h5 className="text-sm font-semibold text-foreground mb-3">Shared With</h5>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <UserAvatar initial="G" />
                <span className="text-sm text-foreground">George Williamson</span>
              </div>
              <div className="flex items-center space-x-3">
                <UserAvatar initial="N" />
                <span className="text-sm text-foreground">Nickolaus Peterson</span>
              </div>
              <div className="flex items-center space-x-3">
                <UserAvatar initial="A" />
                <span className="text-sm text-foreground">Alexander Mikhailenko (You)</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Action Buttons */}
      <div className="p-6 border-t border-border">
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
            <Share className="w-5 h-5" />
            <span className="text-xs">Share</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
            <Edit className="w-5 h-5" />
            <span className="text-xs">Edit</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center space-y-2 h-auto py-4">
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-xs text-destructive">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
