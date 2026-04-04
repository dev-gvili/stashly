import React from 'react'
import { useSlots } from '@/hooks/use-slots'
import { cn } from '@/utils/styles'

export interface CircularProgressbarProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string
}

const PERIMETER = 2 * (60 - 2 * 20) + 2 * (60 - 2 * 20) + 2 * Math.PI * 20 // Perimeter of a rounded rectangle with width=60, height=60, rx=20, ry=20. This simplifies to 2*(20) + 2*(20) + 2*PI*20 = 40 + 40 + 125.66 = 205.66. This is the correct perimeter for the rect element with x="20", y="20", width="60", height="60", rx="20", ry="20". was verified with an online SVG path length calculator.

const Root = React.forwardRef<
  React.ComponentRef<'svg'>,
  CircularProgressbarProps
>(({ children, ...props }, ref) => {
  let [{ circule, indicator, value }] = useSlots(children, {
    circule: ProgressBarCircle,
    indicator: Indicator,
    value: Value,
  })
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="2.5rem"
      height="2.5rem"
      viewBox="0 0 100 100"
      {...props}
    >
      {indicator}
      {circule}
      {value}
    </svg>
  )
})

export const ProgressBarCircle = React.forwardRef<
  SVGRectElement,
  React.ComponentPropsWithoutRef<'rect'>
>(({ className, ...props }, forwardRef) => {
  return (
    <rect
      ref={forwardRef}
      x="20"
      y="20"
      width="60"
      height="60"
      rx="20"
      ry="20"
      strokeWidth="4"
      fill="transparent"
      className={cn(
        'stroke-muted-foreground/20 group-data-[state=aborted]:stroke-foreground/40',
        className
      )}
      {...props}
    />
  )
})

export const Indicator = React.forwardRef<
  SVGRectElement,
  React.ComponentPropsWithoutRef<'rect'> & { progress?: number }
>(({ className, progress = 0, ...props }, forwardRef) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100)
  const offset = PERIMETER - (clampedProgress / 100) * PERIMETER
  return (
    <rect
      ref={forwardRef}
      x="20"
      y="20"
      width="60"
      height="60"
      rx="20"
      ry="20"
      strokeWidth="4"
      strokeLinecap="round"
      fill="transparent"
      strokeDasharray={PERIMETER}
      strokeDashoffset={offset}
      className={cn('transition-all duration-500 stroke-current', className)}
      {...props}
    />
  )
})

export const ProgressBarText = React.forwardRef<
  SVGTextElement,
  React.ComponentPropsWithoutRef<'text'>
>(({ children, className, ...props }, forwardRef) => {
  return (
    <text
      ref={forwardRef}
      x="50%"
      y="50%"
      textAnchor="middle"
      alignmentBaseline="middle"
      className={cn('text-foreground text-xs font-stashly', className)}
      {...props}
    >
      {children}
    </text>
  )
})

export const Value = React.forwardRef<
  SVGForeignObjectElement,
  React.ComponentPropsWithoutRef<'foreignObject'>
>(({ children, className, ...props }, forwardRef) => {
  return (
    <foreignObject
      ref={forwardRef}
      x="50%"
      y="50%"
      width="100%"
      height="100%"
      transform="translate( 2.5, 2.5)"
      className={cn(
        'text-foreground text-xs font-stashly text-center',
        className
      )}
      {...props}
    >
      {children}
    </foreignObject>
  )
})

const CircleProgressBar = Object.assign(
  {},
  {
    Value,
    Indicator,
    Circle: ProgressBarCircle,
    Root,
  }
)
export { CircleProgressBar }
