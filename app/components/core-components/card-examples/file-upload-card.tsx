"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, File, X } from "lucide-react"
import { cn } from "@/utils"

export function FileUploadCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    setFiles((prev) => [...prev, ...Array.from(newFiles)])
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">File Upload</CardTitle>
        <CardDescription className="text-sm">Drag and drop or browse</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files drop zone"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-4 text-center cursor-pointer transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/40"
          )}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Upload files</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB</p>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-xs text-foreground bg-muted/50 border border-border rounded-md px-3 py-2"
              >
                <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <button
                  aria-label={`Remove ${f.name}`}
                  onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)) }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <Button
          variant="outline"
          className="w-full font-medium"
          onClick={() => inputRef.current?.click()}
        >
          Browse Files
        </Button>
      </CardContent>
    </Card>
  )
}
