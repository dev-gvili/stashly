import { useEffect, useId, useRef, useState } from 'react'
import { useFetcher, useNavigate, useParams } from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/styles'

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const id = useId()
  const fetcher = useFetcher<{ workspace?: { id: string }; error?: string }>()
  const navigate = useNavigate()
  const params = useParams()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const isSubmitting = fetcher.state !== 'idle'
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : null

  // Auto-derive slug from name unless user has edited it manually
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  // Navigate to new workspace on success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'workspace' in fetcher.data && fetcher.data.workspace) {
      const me = params.me ?? ''
      navigate(`/${me}/workspaces/${fetcher.data.workspace.id}`)
      onOpenChange(false)
      setName('')
      setSlug('')
      setSlugTouched(false)
    }
  }, [fetcher.state, fetcher.data])

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    fetcher.submit(
      { intent: 'create_workspace', name: name.trim(), slug: slug.trim() },
      { method: 'POST', action: '/api/workspaces' }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-stashly text-sm uppercase tracking-[0.18em]">
            New Workspace
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`} className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Name
            </Label>
            <Input
              id={`${id}-name`}
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design System"
              className="font-stashly"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-slug`} className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              URL slug
            </Label>
            <div className="flex items-center gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0 select-none">
                stashly.app/ws/
              </span>
              <input
                id={`${id}-slug`}
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
                placeholder="design-system"
                className="flex-1 px-3 py-2 text-sm font-stashly bg-transparent outline-none"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim() || !slug.trim()}
              className={cn(isSubmitting && 'opacity-70')}
            >
              {isSubmitting ? 'Creating…' : 'Create workspace'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
