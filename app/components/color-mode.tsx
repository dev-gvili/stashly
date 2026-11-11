import {
    ColorModeFillIcon,
    DarkModeFillIcon,
    LightModeFillIcon
} from '@/components/icons';
import { Button } from '@/ui/button';
import { cn } from '@/utils';
import { useFetcher, useLocation, useRouteLoaderData } from 'react-router';
import type { loader } from '../root';
import { Popover, PopoverContent, PopoverTrigger } from './ui';

export function ModeToggle() {
  const location = useLocation()
  let fetcher = useFetcher<{ colorScheme: 'dark' | 'light' | 'system' | null }>(
    { key: 'color-scheme' }
  )
  let data = fetcher.data || useRouteLoaderData<typeof loader>('root')
  return (
    <Popover modal={false} key={fetcher.data?.colorScheme}>
      <PopoverTrigger asChild className="cursor-pointer hover:mr-0 mr-0 peer">
        <Button
          variant="outline"
          size="icon"
          aria-label="Color mode"
          className="font-stashly bg-card! ring-2 ring-accent border-none data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground rounded-md!"
        >
          {data?.colorScheme === 'dark' && <DarkModeFillIcon className="size-5!" />}
          {data?.colorScheme === 'light' && <LightModeFillIcon className="size-5!" />}
          {data?.colorScheme === 'system' && (
            <ColorModeFillIcon className="size-5!" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex-col flex rounded-md shadow-xl overflow-hidden font-stashly ring-2 ring-accent border-none p-0 bg-card max-w-max"
      >
        <Button
          className={cn(
            'font-stashly bg-transparent text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'dark' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <DarkModeFillIcon className="size-5! text-current!" />
          <span>Dark</span>
        </Button>
        <Button
          className={cn(
            'font-stashly bg-transparent text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'light' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <LightModeFillIcon className="size-5!" />
          <span>Light</span>
        </Button>
        <Button
          className={cn(
            'font-stashly bg-transparent text-sidebar-foreground justify-start px-1.5 hover:bg-transparent'
          )}
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'system' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <ColorModeFillIcon className="size-5!" />
          <span>System</span>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
