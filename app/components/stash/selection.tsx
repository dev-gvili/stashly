import type { ReactNode } from 'react'
import {
  useRegisterSelectionItems,
  useSelectionURLSync,
} from '@/hooks/useSelection'

// Lightweight wrapper that registers a route's items and mounts URL sync.
// No React context — useSelection() (in `@/hooks/useSelection`) reads directly
// from the module actor, so consumers above this in the tree (e.g. AppToolbar)
// work too.
export const SelectionProvider = ({
  items,
  children,
}: {
  items: string[]
  children: ReactNode
}) => {
  useRegisterSelectionItems(items)
  useSelectionURLSync()
  return <>{children}</>
}
