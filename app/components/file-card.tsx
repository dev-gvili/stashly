import { Star, MoreVertical, FileText, Video } from "lucide-react"
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
      className={`bg-[#242424] rounded-lg p-4 hover:bg-[#2a2a2a] transition-colors text-left ${
        isSelected ? "ring-1 ring-gray-600" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <button className="p-1 hover:bg-[#3a3a3a] rounded transition-colors">
          <Star className="w-4 h-4 text-gray-500" />
        </button>
        <button className="p-1 hover:bg-[#3a3a3a] rounded transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* File Icon */}
      <div className="flex justify-center mb-4">
        <FileIcon type={file.type} />
      </div>

      {/* File Name */}
      <h3 className="text-white text-sm font-medium mb-4 text-center line-clamp-2 min-h-[40px]">{file.name}</h3>

      {/* File Info */}
      <div className="flex items-center justify-between pt-3 border-t border-[#3a3a3a]">
        <div>
          <p className="text-gray-500 text-xs">Filesize:</p>
          <p className="text-gray-400 text-xs">{file.size}</p>
        </div>
        <div className="flex gap-1">
          {file.sharedWith.map((initial, index) => (
            <div
              key={index}
              className="w-6 h-6 rounded bg-gray-600 flex items-center justify-center text-white text-xs font-medium"
            >
              {initial}
            </div>
          ))}
        </div>
      </div>
    </button>
  )
}

function FileIcon({ type }: { type: FileType["type"] }) {
  const baseClasses = "w-16 h-20 rounded-lg flex items-center justify-center"

  if (type === "pdf") {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <FileText className="w-8 h-8 text-gray-700" />
      </div>
    )
  }

  if (type === "sketch") {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <svg className="w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    )
  }

  if (type === "mp4") {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <Video className="w-8 h-8 text-gray-700" />
      </div>
    )
  }

  if (type === "word") {
    return <div className={`${baseClasses} bg-gray-500 text-gray-700 text-3xl font-bold`}>{type === "word" && "W"}</div>
  }

  if (type === "diamond") {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <svg className="w-8 h-8 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`${baseClasses} bg-gray-500`}>
      <FileText className="w-8 h-8 text-gray-700" />
    </div>
  )
}
