import React, { useId, useState } from 'react'
import { useFetcher } from 'react-router'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'

interface RenameDialogProps {
  /** The element that opens the dialog (e.g. a DropdownMenuItem). Rendered as DialogTrigger asChild. */
  children: React.ReactNode
  /** Pre-filled name shown in the input. */
  defaultName: string
  /** Value of the `intent` form field sent to the action. */
  intent: string
  /** Route action URL. Defaults to current route. */
  action?: string
  /** Any extra key/value pairs merged into the submitted form data. */
  extraData?: Record<string, string>
  /** Dialog heading. Defaults to "Rename". */
  title?: string
}

export function RenameDialog({
  children,
  defaultName,
  intent,
  action,
  extraData,
  title = 'Rename',
}: RenameDialogProps) {
  const formId = useId()
  const fetcher = useFetcher()
  const [name, setName] = useState(defaultName)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || name === defaultName) return
    fetcher.submit(
      { intent, newName: name.trim(), ...extraData },
      { method: 'post', ...(action ? { action } : {}) }
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form id={formId} onSubmit={handleSubmit}>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            form={formId}
            type="submit"
            disabled={!name.trim() || name === defaultName}
          >
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
