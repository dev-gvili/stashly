import { ColorSchemeIcon, MoonIcon, SunIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useFetcher, useRouteLoaderData } from 'react-router'
import type { loader } from '../root'
import { Popover, PopoverContent, PopoverTrigger } from './ui'
import { cn } from '@/utils'

export function ModeToggle() {
  let fetcher = useFetcher<{ colorScheme: 'dark' | 'light' | 'system' | null }>(
    { key: 'color-scheme' }
  )
  let data = fetcher.data || useRouteLoaderData<typeof loader>('root')
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild className="cursor-pointer hover:mr-0 mr-0 peer">
        <Button
          variant="outline"
          size="icon"
          className="font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground  rounded-md!"
        >
          {data?.colorScheme === 'dark' && <MoonIcon className="size-5!" />}
          {data?.colorScheme === 'light' && <SunIcon className="size-5!" />}
          {data?.colorScheme === 'system' && (
            <ColorSchemeIcon className="size-5!" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex-col flex rounded-md shadow-xl overflow-hidden font-stashly border border-sidebar-border p-2 bg-sidebar max-w-max"
      >
        <Button
          className={cn(
            'font-stashly bg-sidebar text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'dark' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <MoonIcon className="size-5! text-current!" />
          <span>Dark</span>
        </Button>
        <Button
          className={cn(
            'font-stashly bg-sidebar text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'light' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <SunIcon className="size-5! text-current!" />
          <span>Light</span>
        </Button>
        <Button
          className={cn(
            'font-stashly bg-sidebar text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'system' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <ColorSchemeIcon className="size-5! text-current!" />
          <span>System</span>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
