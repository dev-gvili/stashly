import { Folder } from "lucide-react"
import type { FolderType } from "@/components/file-manager"

type FolderCardProps = {
  folder: FolderType
}

export function FolderCard({ folder }: FolderCardProps) {
  return (
    <button className="flex flex-col items-start p-4 bg-card hover:bg-accent rounded-lg transition-colors border border-transparent hover:border-border">
      <Folder className="w-12 h-12 text-muted-foreground mb-3" />
      <h3 className="text-foreground text-sm font-medium mb-1">{folder.name}</h3>
      <p className="text-muted-foreground text-xs">{folder.fileCount} files</p>
    </button>
  )
}
