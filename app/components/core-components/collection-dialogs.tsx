import { useId, useState, type ReactNode } from 'react'
import { useCollectionMutations } from '@/hooks/useCollectionMutations'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import { Input } from '@/ui/input'

const DIALOG_CLASS = 'max-w-md gap-4 rounded-2xl bg-popover p-5.5'

/**
 * Name form shared by the New and Rename dialogs: Enter submits, the primary
 * button stays disabled until there is a name.
 */
function NameForm({
  title,
  description,
  initialName,
  placeholder,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string
  description?: string
  initialName: string
  placeholder?: string
  submitLabel: string
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const [name, setName] = useState(initialName)
  const trimmed = name.trim()

  return (
    <DialogContent className={DIALOG_CLASS}>
      <DialogHeader>
        <DialogTitle className="font-stashly tracking-tight">{title}</DialogTitle>
        {description && (
          <DialogDescription className="font-stashly text-sm">
            {description}
          </DialogDescription>
        )}
      </DialogHeader>
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault()
          if (!trimmed) return
          onSubmit(trimmed)
          onClose()
        }}
      >
        <Input
          autoFocus
          className="font-stashly"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Collection name"
        />
      </form>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" className="font-stashly">
            Cancel
          </Button>
        </DialogClose>
        <Button
          form={formId}
          type="submit"
          disabled={!trimmed}
          className="font-stashly"
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/**
 * Creates a collection. The action redirects back to the current page without
 * the new id, so this stays put; opening the new (empty) collection needs the
 * action to return the id.
 *
 * @example
 * <NewCollectionDialog open={open} onOpenChange={setOpen} />
 */
export function NewCollectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { create } = useCollectionMutations()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <NameForm
          title="New collection"
          description="Collections group files without moving them. One file can sit in several collections."
          initialName=""
          placeholder="e.g. Comics, Taxes 2026"
          submitLabel="Create collection"
          onSubmit={create}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

/**
 * Renames a collection. Wraps its trigger (e.g. a menu item) per the
 * dialog-from-dropdown pattern: pair the item with `onSelect={(e) => e.preventDefault()}`.
 *
 * @example
 * <RenameCollectionDialog collection={col}><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem></RenameCollectionDialog>
 */
export function RenameCollectionDialog({
  collection,
  children,
}: {
  collection: { id: string; name: string }
  children: ReactNode
}) {
  const { rename } = useCollectionMutations()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <NameForm
          title="Rename collection"
          initialName={collection.name}
          submitLabel="Save"
          onSubmit={(name) => name !== collection.name && rename(collection, name)}
          onClose={() => setOpen(false)}
        />
      )}
    </Dialog>
  )
}
