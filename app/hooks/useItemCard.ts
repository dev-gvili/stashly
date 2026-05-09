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

/**
 * Reads the nearest `ItemCardContext` — must be called inside an `ItemCard` tree
 * or a component that manually provides `ItemCardContext.Provider`.
 * Throws if called outside a provider.
 *
 * @returns The full item context: all `StashItem` fields + `user`, `searchParams`, `setSearchParams`.
 *
 * @example
 * // Use inside an ItemCard compound component
 * function ItemName() {
 *   const { name } = useItemCard()
 *   return <span>{name}</span>
 * }
 *
 * @example
 * // Provide context manually when using ItemCard compound components outside ItemCard root
 * // (e.g. inside a DataTable row's actions column)
 * function ListRowActions({ item }: { item: StashItem }) {
 *   const user = useRouteLoaderData('layout')!.user
 *   const [searchParams, setSearchParams] = useSearchParams()
 *   return (
 *     <ItemCardContext.Provider value={{ ...item, user, searchParams, setSearchParams }}>
 *       <ItemCard.Actions />
 *     </ItemCardContext.Provider>
 *   )
 * }
 *
 * @example
 * // Read item status to conditionally render actions
 * function TrashBadge() {
 *   const { status } = useItemCard()
 *   if (status !== 'trashed') return null
 *   return <Badge variant="destructive">Trashed</Badge>
 * }
 */
export const useItemCard = () => {
  const context = useContext(ItemCardContext)
  if (!context) {
    throw new Error('useItemCard must be used within a ItemCardProvider')
  }
  return context
}
