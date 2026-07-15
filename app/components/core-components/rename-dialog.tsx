import React, { useId, useState } from 'react'
import { useFetcher, useLocation } from 'react-router'
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
import { Form } from 'react-router'

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
  let location = useLocation()

  return (
    <Dialog key={location.key}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form action={action} id={formId} method="POST">
          <Input autoFocus name="newName" defaultValue={defaultName} />
          {extraData
            ? Object.keys(extraData).map((key) => (
                <Input hidden name={key} defaultValue={extraData[key]} />
              ))
            : null}
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant='default' size='sm' form={formId} name="intent" value={intent} type="submit">
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
