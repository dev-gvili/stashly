'use client'

import * as React from 'react'
import { cn } from '@/utils/styles'

type EditableElement = HTMLSpanElement | HTMLDivElement | HTMLHeadingElement

interface EditableProps
  extends Omit<React.HTMLAttributes<EditableElement>, 'onChange'> {
  value: string
  onChange: (next: string) => void
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  commitOnEnter?: boolean
}

function Editable({
  value,
  onChange,
  as: Tag = 'span',
  commitOnEnter = true,
  className,
  onPointerDown,
  onBlur,
  onKeyDown,
  ...props
}: EditableProps) {
  const Component = Tag as 'span'
  return (
    <Component
      data-slot="editable"
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown?.(e)
      }}
      onBlur={(e) => {
        onChange(e.currentTarget.textContent ?? '')
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (commitOnEnter && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        onKeyDown?.(e)
      }}
      className={cn(
        '-mx-0.5 cursor-text rounded-[3px] px-0.5 whitespace-nowrap outline-none transition-shadow',
        'focus:bg-background focus:shadow-[0_0_0_1.5px_var(--ring,#c96442)]',
        className
      )}
      {...props}
    >
      {value}
    </Component>
  )
}

export { Editable }
export type { EditableProps }
