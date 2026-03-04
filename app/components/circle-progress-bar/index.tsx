import React from 'react'
import { useSlots } from '@/hooks/use-slots'
import { cn } from '@/utils/styles'

export interface CircularProgressbarProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string
}

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
      width="100%"
      height="100%"
      viewBox="0 0 80 80"
      {...props}
    >
      {circule}
      {indicator}
      {value}
    </svg>
  )
})

export const ProgressBarCircle = React.forwardRef<
  React.ComponentRef<'circle'>,
  React.ComponentPropsWithoutRef<'circle'>
>(({ children, className, radius = 24, ...props }, forwardRef) => {
  let styles =
    'dark:stroke-white/20 fill-transparent stroke-black/20 group-data-[state=aborted]:dark:stroke-white/40'
  return (
    <circle
      ref={forwardRef}
      strokeWidth="6"
      cx="50%"
      cy="50%"
      r={radius}
      fill="transparent"
      className={cn(styles, className)}
      {...props}
    ></circle>
  )
})

export const Indicator = React.forwardRef<
  React.ComponentRef<'circle'>,
  React.ComponentPropsWithoutRef<'circle'> & { progress?: number }
>(
  (
    { children, className, radius = 24, progress = 0, ...props },
    forwardRef
  ) => {
    if (!radius) return
    const circumference = 2 * Math.PI * Number(radius)
    let offsets = circumference - (progress / 100) * circumference
    let styles =
      'transition-all duration-[350ms] -rotate-90 origin-center stroke-foreground'
    return (
      <circle
        ref={forwardRef}
        strokeWidth="6"
        strokeLinecap="round"
        cx="50%"
        cy="50%"
        fill="transparent"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offsets}
        className={cn(styles, className)}
        {...props}
      ></circle>
    )
  }
)

export const ProgressBarText = React.forwardRef<
  React.ComponentRef<'text'>,
  React.ComponentPropsWithoutRef<'text'>
>(({ children, className, ...props }, forwardRef) => {
  let styles = 'dark:text-white/20 text-xs font-stashly'
  return (
    <text
      ref={forwardRef}
      x="30%"
      y="30%"
      textAnchor="middle"
      alignmentBaseline="middle"
      className={cn(styles, className)}
      {...props}
    >
      {children}
    </text>
  )
})

export const Value = React.forwardRef<
  React.ComponentRef<'foreignObject'>,
  React.ComponentPropsWithoutRef<'foreignObject'>
>(({ children, className, ...props }, forwardRef) => {
  let styles = ''
  return (
    <foreignObject
      ref={forwardRef}
      x="50%"
      y="50%"
      className={cn(styles, className)}
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
