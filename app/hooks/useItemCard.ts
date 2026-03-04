import { createContext, useContext } from "react"
import type { ItemCardProps } from "../components/stash/item-card"
import type { SetURLSearchParams } from "react-router"
import type { User } from '@/services/auth.types'

export type ItemCartContextProps = ItemCardProps & {
  user: User
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
}

export const ItemCardContext = createContext<ItemCartContextProps | null>(null)

export const useItemCard = () => {
  const context = useContext(ItemCardContext)
  if (!context) {
    throw new Error('useItemCard must be used within a ItemCardProvider')
  }
  return context
}
