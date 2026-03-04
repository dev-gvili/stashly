import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router'
import type { LoaderData } from '@/hooks/usePagination'
import { ItemCard, type ItemCardProps } from '@/components/stash/item-card'

type ListViewProps<T> = {
  items: LoaderData<T>['items']
}

export const ListLayout = <T extends ItemCardProps>({
  items,
}: ListViewProps<T>) => {
  const [searchParams] = useSearchParams()
  const isLayoutTypeList = searchParams.has('layout', 'list')
  if (!isLayoutTypeList) return null

  return (
    <motion.div className="flex flex-col gap-2" animate="show">
      {items?.map((item) => {
        return (
          <ItemCard key={item.id} {...item} className="h-20">
            <ItemCard.Content className="flex-row gap-2 w-full p-2 items-center">
              <ItemCard.Checkbox
                name="selectedItems"
                value={item.id}
                className="place-self-center"
              />
              <ItemCard.Thumbnail className="[&_svg]:size-7" />
              <ItemCard.Name className="w-full" />
              <ItemCard.Size className='flex items-center w-full'/>
              <ItemCard.Count className="shrink-0 items-center justify-end h-full w-2/6" />
              <ItemCard.Actions className="place-self-center" />
            </ItemCard.Content>
          </ItemCard>
        )
      })}
    </motion.div>
  )
}
