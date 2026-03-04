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
        'grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2 auto-rows-min rounded',
        className
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout">{children}</AnimatePresence>
    </div>
  )
}
