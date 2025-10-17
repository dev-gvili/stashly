import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { FileGrid } from "@/components/file-grid"
import { FilePreview } from "@/components/file-preview"
import type { ItemCategory, ItemType } from "../.server/prisma/enums"

/**
 * Represents an Item from the database with relevant fields for the file manager.
 * This type can be extended based on actual Item fields in the database.
 * @property {string} id - Unique identifier for the file.
 * @property {string} name - Name of the file.
 * @property {ItemCategory} type - Category of the file (e.g., document, image, video).
 * @property {string} size - Size of the file in human-readable format.
 * @property {string[]} sharedWith - List of initials representing users the file is shared with, resolved from item.shared.
 * @property {string} [description] - Optional description of the file.
 * @property {string} [thumbnail] - Optional URL to a thumbnail image for the file.
 * @property {string} [duration] - Optional duration for video/audio files. 
 */
export type FileType = {
  id: string
  name: string
  type: ItemCategory
  size: string
  sharedWith: string[] // initials of people the file is shared with
  description?: string
  thumbnail?: string
  duration?: string
}

const files: FileType[] = [
  {
    id: "1", // unique identifier
    name: "Licence Agreement on Waterfall INC.pdf", // full file name with extension
    type: "pdf", // ItemCategory
    size: "2.3 MB",  // human-readable file size
    sharedWith: ["A"], // initials of people the file is shared with
    description:
      "I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!",
    thumbnail: "/thumbnails/file-thumbnail-1.png", // for image / video files or use a placeholder icon for other types
    duration: "2:34", // for video/audio files
  }
]

export function FileManager() {
  const [selectedFile, setSelectedFile] = useState<FileType>(files[0])

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar />
      <FileGrid files={files} onFileSelect={setSelectedFile} selectedFileId={selectedFile.id} />
      <FilePreview file={selectedFile} />
    </div>
  )
}
