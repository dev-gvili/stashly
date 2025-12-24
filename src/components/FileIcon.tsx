import { FileText } from 'lucide-react'

interface FileIconProps {
  type: string
  className?: string
}

export function FileIcon({ type, className = "w-8 h-8" }: FileIconProps) {
  const iconClasses = `${className} rounded flex items-center justify-center text-white text-xs font-semibold`

  switch (type) {
    case 'pdf':
      return <div className={`${iconClasses} bg-red-500`}>PDF</div>
    case 'sketch':
      return <div className={`${iconClasses} bg-yellow-500`}>SK</div>
    case 'mp4':
      return <div className={`${iconClasses} bg-blue-500`}>MP4</div>
    case 'docx':
      return <div className={`${iconClasses} bg-blue-600`}>DOC</div>
    case 'zip':
      return <div className={`${iconClasses} bg-green-500`}>ZIP</div>
    default:
      return <FileText className={`${className} text-muted-foreground`} />
  }
}
