"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageIcon } from "lucide-react"

export function UploadArtworkCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cover Art
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Drop zone */}
        <div
          className="relative flex items-center justify-center rounded-lg border border-border bg-muted overflow-hidden cursor-pointer"
          style={{ height: 140 }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {preview ? (
            <img
              src={preview}
              alt="Artwork preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="w-7 h-7" />
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            className="w-full text-sm text-foreground hover:bg-muted justify-center h-9"
            onClick={() => inputRef.current?.click()}
          >
            Upload Artwork
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Minimum 3000 × 3000px
          </p>
          <p className="text-xs text-muted-foreground text-center">
            JPEG or PNG only
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
