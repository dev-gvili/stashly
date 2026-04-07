import { auth } from '@/.server/auth'
import { GridLayout } from '@/components/views/grid-view'
import { ItemCard } from '@/components/stash/item-card'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import {  paginateItems } from '@/services/item-actions'
import { parseSearchParams } from '@/utils/parsers'
import type { Route } from './+types/shares'
import { redirect } from 'react-router'
import { usePagination } from '@/hooks/usePagination'
import { itemVariants } from '@/components/views/variants'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Fragment } from 'react/jsx-runtime'
import { ListLayout } from '../../components/views/list-view'
import { SelectionProvider } from '../../components/stash/selection'
import { LoadMoreItems } from '../../components/core-components/buttons'
import { useId } from 'react'

export async function loader({ request, params }: Route.LoaderArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/signin')

  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)
  return await paginateItems({
    limit: parsedParams.take,
    cursor: parsedParams.cursor,
    where: filters,
    foldersFirst: false,
    include:{
      file: true,
      folder: true, 
      thumbnails: true,
      favorites: {
        select:{
          id: true,
          favoritedBy: {
            select: {
              name: true,
              displayName: true, 
              image: true,
              id: true
            }
          }
        }
      }
    }
  })
}

export default ({ loaderData }: Route.ComponentProps) => {
  let id = useId()
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(100, '')

  console.log(items)
  return (
     <Fragment key={id}>
       {/* <ListLayout items={items} /> */}
       <SelectionProvider items={items.map((i) => i.id)}>
         <GridLayout>
           {items.map((item) => (
             <motion.div
               key={item.id}
               variants={itemVariants}
               transition={{ duration: 0.2 }}
             >
               <ItemCard key={item.id} {...item}>
                 <ItemCard.Header>
                   <ItemCard.Checkbox name="selectedItems" value={item.id} />
                 </ItemCard.Header>
                 <ItemCard.Content>
                   <ItemCard.Thumbnail />
                   <ItemCard.Name />
                 </ItemCard.Content>
                 <ItemCard.Footer>
                   <ItemCard.Size />
                   <ItemCard.Count />
                 </ItemCard.Footer>
               </ItemCard>
             </motion.div>
           ))}
         </GridLayout>
       </SelectionProvider>
       <div className="col-span-full flex justify-center items-center h-full py-4">
         <LoadMoreItems
           loadMore={loadMore}
           isLoading={isLoading}
           hasMore={hasMore}
         />
       </div>
     </Fragment>
  )
}
