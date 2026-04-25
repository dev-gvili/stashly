import React from 'react'
import { useSlots } from '@/hooks/use-slots'
import { cn } from '@/utils/styles'

export interface CircularProgressbarProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string
}

// formula to match the actual dimensions of the rect element in the SVG. The rect has x=15, y=15, width=70, height=70, rx=20, ry=20. The perimeter of a rounded rectangle can be calculated as:
// P = 2 * (width - 2 * rx) + 2 * (height - 2 * ry) + 2 * π * r
// where r is the radius of the rounded corners (which is the same as rx or ry in this case).
const PERIMETER = 2 * (70 - 2 * 20) + 2 * (70 - 2 * 20) + 2 * Math.PI * 20 // Perimeter of a rounded rectangle with width=70, height=70, rx=20, ry=20. This simplifies to 2*(20) + 2*(20) + 2*PI*20 = 40 + 40 + 125.66 = 205.66. This is the correct perimeter for the rect element with x="15", y="15", width="70", height="70", rx="20", ry="20". was verified with an online SVG path length calculator.

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
      x="15"
      y="15"
      width="70"
      height="70"
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
      x="15"
      y="15"
      width="70"
      height="70"
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
        'text-foreground text-xs font-stashly text-center group/progress',
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
