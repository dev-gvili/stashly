import { cn } from '@/utils/styles'

export interface BrandLogoProps extends React.ComponentProps<'a'> {
  src?: string
}

/** Mark + Share Tech Mono wordmark. The mark is ink-black; it inverts in dark mode. */
export function BrandLogo({ src = '/stashly.svg', href = '/', className, ...props }: BrandLogoProps) {
  return (
    <a
      href={href}
      className={cn('flex w-fit items-center gap-2.25 text-foreground', className)}
      {...props}
    >
      <img src={src} alt="" className="size-6.5 dark:brightness-0 dark:invert" />
      <span className="font-stashly text-lg tracking-wide">stashly</span>
    </a>
  )
}
