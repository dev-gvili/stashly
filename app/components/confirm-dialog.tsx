import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/alert-dialog'
import type { VariantProps } from 'class-variance-authority'
import { confirmService } from '../utils/confirm'
import { useSelector } from '@xstate/react'
import React from 'react'
import { callAll } from '../utils/misc'

export type ConfirmDialogProps = {
  children?: React.ReactNode
  title: string
  description?: React.ReactNode
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  confirmProps?: React.ComponentProps<typeof AlertDialogAction>
  cancelProps?: React.ComponentProps<typeof AlertDialogCancel>
  variant?: VariantProps<typeof AlertDialogAction>['variant']
  size?: VariantProps<typeof AlertDialogAction>['size']
  asChild?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const Confirm = ({
  onConfirm,
  onCancel,
  cancelText,
  confirmText,
  confirmProps,
  cancelProps,
  title,
  description,
  variant,
  size,
  onOpenChange,
}: ConfirmDialogProps) => {
  let isOpen = useSelector(confirmService, (state) => state.matches('open'))

  const _onConfirm = React.useCallback(() => {
    confirmService.send({ type: 'CONFIRM' })
  }, [])

  const _onCancel = React.useCallback(() => {
    confirmService.send({ type: 'CANCEL' })
  }, [])
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={callAll(_onCancel, onCancel)}
            size={size}
            {...cancelProps}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={callAll(_onConfirm, onConfirm)}
            variant={variant}
            size={size}
            {...confirmProps}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { Confirm }
