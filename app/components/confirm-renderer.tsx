import * as React from 'react'
import { confirmService } from '@/utils/confirm'
import { Confirm as ConfirmDialog } from './confirm-dialog'
import { useSelector } from '@xstate/react'
import { callAll } from '@/utils/misc'

export const Confirm = () => {
  let props = useSelector(confirmService, (state) => state.context.props)
  let isOpen = useSelector(confirmService, (state) => state.matches('open'))

  const _onConfirm = React.useCallback(() => {
    confirmService.send({ type: 'CONFIRM' })
  }, [props])

  const _onCancel = React.useCallback(() => {
    confirmService.send({ type: 'CANCEL' })
  }, [props])

  if (!isOpen || !props) return null

  return (
    <ConfirmDialog
      title={props.title}
      description={props.description}
      confirmText={props.confirmText}
      cancelText={props.cancelText}
      confirmProps={props.confirmProps}
      cancelProps={props.cancelProps}
      variant={props.variant}
      size={props.size}
      open={isOpen}
      onOpenChange={callAll(_onCancel)}
      onConfirm={callAll(_onConfirm, props.onConfirm)}
      onCancel={callAll(_onCancel, props.onCancel)}
    />
  )
}

export default { Confirm }
