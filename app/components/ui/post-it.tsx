'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/styles'

const postItVariants = cva(
  [
    'absolute z-5 px-4 py-3.5 text-sm leading-snug',
    'font-["Comic_Sans_MS","Marker_Felt","Segoe_Print",cursive]',
    'shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]',
  ],
  {
    variants: {
      color: {
        yellow: 'bg-[#fef4a8] text-[#5a4a2a]',
        pink:   'bg-[#fbcfe8] text-[#831843]',
        blue:   'bg-[#bfdbfe] text-[#1e3a8a]',
        green:  'bg-[#bbf7d0] text-[#14532d]',
        peach:  'bg-[#fed7aa] text-[#7c2d12]',
      },
    },
    defaultVariants: { color: 'yellow' },
  }
)

interface PostItProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof postItVariants> {
  rotate?: number
}

function PostIt({
  className,
  color,
  rotate = -2,
  style,
  ...props
}: PostItProps) {
  return (
    <div
      data-slot="post-it"
      className={cn(postItVariants({ color }), className)}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
      {...props}
    />
  )
}

export { PostIt, postItVariants }
export type { PostItProps }
