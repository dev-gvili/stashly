import React, { type ComponentPropsWithoutRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/styles'
import { useSearchParams } from 'react-router'

interface GridLayoutProps extends ComponentPropsWithoutRef<'div'> {
  // files: ItemCardProps[];
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  children,
  className,
  ...props
}) => {
  let [searchParams] = useSearchParams()
  const isGridLayout = searchParams.has('layout', 'grid')
  if (!isGridLayout) return null
  return (
    <div
      className={cn(
        'grid xl:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2 grid-rows-[repeat(auto-fill,minmax(10rem,1fr))]',
        className
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout">{children}</AnimatePresence>
    </div>
  )
}
