import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

export function NewFolderDialog({
  open,
  onOpenChange,
  folderId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string | undefined
}) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>()
  const [name, setName] = useState('')
  const isSubmitting = fetcher.state !== 'idle'

  useEffect(() => {
    if (!open) {
      setName('')
      return
    }
  }, [open])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onOpenChange(false)
    }
  }, [fetcher.state, fetcher.data, onOpenChange])

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const parentId = folderId
    if (!parentId) return
    onOpenChange(false)
    fetcher.submit(
      {
        intent: 'create_folder',
        name: trimmed,
        parentId,
      },
      { method: 'post', action: href('/api/items') }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a new folder in the current location.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="new-folder-name">Name</Label>
            <Input
              id="new-folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled folder"
              disabled={isSubmitting}
            />
            {fetcher.data?.success === false && fetcher.data.error ? (
              <p className="text-sm text-destructive">{fetcher.data.error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
