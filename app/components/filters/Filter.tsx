import { RiStarSFill, RiStarSLine } from '@remixicon/react'
import { Button } from '@/ui/button'
import { useLocation, useSearchParams } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Toggle } from '../ui/toggle'

export function Filter({
  filterKey,
  label,
  icon,
}: {
  filterKey: string
  label: string
  icon: (pressed: boolean) => React.ReactNode
}) {
  const location = useLocation()
  if (
    location.pathname.includes('/videos') ||
    location.pathname.includes('/gallery')
  ) {
    return null
  }
  let [searchParams, setSearchParams] = useSearchParams()
  let pressed = searchParams.has(`${filterKey}`)
  return (
    <Tooltip content={`${label}`} asChild>
      <Button
        size="icon-lg"
        data-state={pressed ? 'on' : 'off'}
        aria-pressed={pressed}
        variant="outline"
        className="h-8 w-8 rounded-sm font-stashly data-[state=on]:bg-foreground/20 data-[state=on]:text-accent-foreground hover:text-accent-foreground hover:cursor-pointer"
        onClick={() => {
          setSearchParams(
            (params) => {
              if (params.has(filterKey)) {
                params.delete(filterKey)
              } else {
                params.delete('cursor')
                params.set(filterKey, 'true')
              }
              return params
            },
            { replace: true }
          )
        }}
      >
        {icon(pressed)}
      </Button>
    </Tooltip>
  )
}
