import { FileText, Video } from 'lucide-react'
import type { FileType } from './views/types'

export function FileIcon({ type }: { type: FileType['type'] }) {
  const baseClasses = 'w-16 h-20 rounded-lg flex items-center justify-center'

  if (type === 'pdf') {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <FileText className="w-8 h-8 text-gray-700" />
      </div>
    )
  }

  if (type === 'sketch') {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <svg
          className="w-8 h-8 text-gray-700"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    )
  }

  if (type === 'mp4') {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <Video className="w-8 h-8 text-gray-700" />
      </div>
    )
  }

  if (type === 'word') {
    return (
      <div
        className={`${baseClasses} bg-gray-500 text-gray-700 text-3xl font-bold`}
      >
        {type === 'word' && 'W'}
      </div>
    )
  }

  if (type === 'diamond') {
    return (
      <div className={`${baseClasses} bg-gray-500`}>
        <svg
          className="w-8 h-8 text-gray-700"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
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
