"use client"

import { useState } from "react"
import { X, FolderPlus, ChevronRight, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ShareStep = "choice" | "name-folder" | "select-folder" | "create-folder"

type FolderItem = {
  id: string
  name: string
  hasSharedIcon?: boolean
  hasLockIcon?: boolean
}

const folderList: FolderItem[] = [
  { id: "1", name: "Waterfall INC", hasSharedIcon: true },
  { id: "2", name: "Special Events Documents" },
  { id: "3", name: "Trip Videos", hasSharedIcon: true },
  { id: "4", name: "David Barnes Case", hasSharedIcon: true },
  { id: "5", name: "Summertime Photography" },
  { id: "6", name: "Poll Results for 2020" },
  { id: "7", name: "Licence Agreements" },
  { id: "8", name: "Design Files", hasLockIcon: true },
  { id: "9", name: "Waterfall INC Estimations and Marketing" },
]

export function ShareFolderModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ShareStep>("choice")
  const [shareType, setShareType] = useState<"new" | "existing">("new")
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")

  const handleNext = () => {
    if (shareType === "new") {
      setStep("name-folder")
    } else {
      setStep("select-folder")
    }
  }

  const handleSelectFolder = () => {
    setStep("create-folder")
  }

  const handleShare = () => {
    console.log("[v0] Sharing folder:", { email, message })
    onClose()
  }

  const handleCreate = () => {
    console.log("[v0] Creating folder:", selectedFolder)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        {step === "choice" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-card">
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-medium text-foreground">Share a folder from your personal Dropbox?</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="mb-4 text-sm text-muted-foreground">What would you like to do?</p>

              <button
                onClick={() => setShareType("new")}
                className={`mb-3 w-full rounded-lg border p-4 text-left transition-colors ${
                  shareType === "new" ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      shareType === "new" ? "border-foreground bg-foreground" : "border-muted-foreground"
                    } flex items-center justify-center`}
                  >
                    {shareType === "new" && <div className="h-2 w-2 rounded-full bg-background" />}
                  </div>
                  <span className="text-sm text-foreground">I'd like to create and share a new folder</span>
                </div>
              </button>

              <button
                onClick={() => setShareType("existing")}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  shareType === "existing" ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      shareType === "existing" ? "border-foreground bg-foreground" : "border-muted-foreground"
                    } flex items-center justify-center`}
                  >
                    {shareType === "existing" && <div className="h-2 w-2 rounded-full bg-background" />}
                  </div>
                  <span className="text-sm text-foreground">I'd like to share an existing folder</span>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext} className="bg-accent text-foreground hover:bg-muted">
                Next
              </Button>
            </div>
          </>
        )}

        {step === "name-folder" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-card">
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-medium text-foreground">Name your shared folder here</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">To:</span>
                <Input
                  placeholder="Enter email here"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 border-gray-700 bg-[#242424] text-white placeholder:text-gray-500"
                />
                <Select defaultValue="edit">
                  <SelectTrigger className="w-[120px] border-gray-700 bg-[#242424] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit">Can edit</SelectItem>
                    <SelectItem value="view">Can view</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                placeholder="Add a message (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] border-gray-700 bg-[#242424] text-white placeholder:text-gray-500"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleShare} className="bg-accent text-foreground hover:bg-muted">
                Share
              </Button>
            </div>
          </>
        )}

        {step === "select-folder" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-card">
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-medium text-foreground">Choose a folder from your personal Dropbox</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Folder className="h-4 w-4" />
                <span>Dropbox</span>
              </div>

              <div className="space-y-1 pl-6">
                {folderList.slice(0, 5).map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                      selectedFolder === folder.id ? "bg-[#3a3a3a] text-white" : "text-gray-300 hover:bg-[#2a2a2a]"
                    }`}
                  >
                    {folder.hasSharedIcon && (
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-card">
                        <FolderPlus className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span>{folder.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={() => setStep("choice")}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
              <Button
                onClick={handleSelectFolder}
                disabled={!selectedFolder}
                className="bg-accent text-foreground hover:bg-muted disabled:opacity-50"
              >
                Share
              </Button>
            </div>
          </>
        )}

        {step === "create-folder" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-card">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-medium text-foreground">Folder name here</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground">Dropbox</p>
            </div>

            <div className="mb-6 max-h-[400px] space-y-1 overflow-y-auto">
              {folderList.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-colors ${
                    selectedFolder === folder.id ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-foreground">{folder.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={() => setStep("select-folder")}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
              <div className="flex gap-2">
                <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!selectedFolder}
                  className="bg-accent text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Create
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
