import React from 'react'
import {
  GenericEmptyState,
  type GenericEmptyStateProps,
} from './generic-empty-state'
import { InvitationEmptyFillIcon } from '../icons'

export const InvitationEmptyState = ({
  title = 'No invitations yet',
  description = "You haven't sent or received any invitations yet. Use the 'Send Invitation' button to invite others to your stash.",
  children,
}: Partial<Omit<GenericEmptyStateProps, 'icon'>>) => {
  return (
    <GenericEmptyState
      description={description}
      title={title}
      icon={<InvitationEmptyFillIcon className="size-20" />}
      children={children}
    />
  )
}
