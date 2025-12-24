export interface FileItem {
"export interface FileItem {
  id: string
  name: string
  type: 'pdf' | 'sketch' | 'mp4' | 'docx' | 'zip' | 'image'
  size: string
  date: string
  duration?: string
  sharedWith: string[]
  description?: string
  thumbnail?: string
  path: string
}

export interface FolderItem {
  id: string
  name: string
  fileCount: number
  icon: string
  color: string
  path: string
}

export interface FileData {
  folders: FolderItem[]
  files: FileItem[]
}
}"
