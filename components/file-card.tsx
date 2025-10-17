import { Star, MoreVertical } from "lucide-react"
import type { FileType } from "@/app/components/file-manager"

type FileCardProps = {
  file: FileType
  onClick: () => void
  isSelected: boolean
}

export function FileCard({ file, onClick, isSelected }: FileCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-card rounded-lg overflow-hidden hover:bg-accent transition-colors text-left ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      {file.type === "mp4" && file.thumbnail ? (
        <div className="relative aspect-video">
          <img
            src={file.thumbnail || "/placeholder.svg?height=200&width=300"}
            alt={file.name}
            className="w-full h-full object-cover"
          />
          {/* Duration overlay */}
          {file.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {file.duration}
            </div>
          )}
          {/* Star and menu buttons */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
            <button
              className="p-1.5 bg-black/50 hover:bg-black/70 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Star className="w-4 h-4 text-white" />
            </button>
            <button
              className="p-1.5 bg-black/50 hover:bg-black/70 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ) : null}

      {/* File info section */}
      <div className="p-4">
        <h3 className="text-foreground text-sm font-medium mb-3 line-clamp-1">{file.name}</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs">Filesize:</p>
            <p className="text-muted-foreground text-xs">{file.size}</p>
          </div>
          <div className="flex gap-1">
            {file.sharedWith.slice(0, 4).map((user, index) => (
              <div
                key={index}
                className="w-6 h-6 rounded bg-muted flex items-center justify-center text-foreground text-xs font-medium"
              >
                {user.initial}
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}
