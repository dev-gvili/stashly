import { ColorSchemeIcon, MoonIcon, SunIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { useFetcher, useRouteLoaderData } from 'react-router'
import type { loader } from '../root'

export function ModeToggle() {
  let fetcher = useFetcher<{ colorScheme: 'dark' | 'light' | 'system' | null }>(
    { key: 'color-scheme' }
  )
  let data = fetcher.data || useRouteLoaderData<typeof loader>('root')
  return (
    <DropdownMenu modal={false}>
      <Tooltip content="Toggle Theme" align="end" asChild>
        <DropdownMenuTrigger asChild className="cursor-pointer hover:mr-0 mr-0 peer">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Toggle theme"
            className="text-current"
          >
            {data?.colorScheme === 'dark' && <MoonIcon className="size-5!" />}
            {data?.colorScheme === 'light' && <SunIcon className="size-5!" />}
            {data?.colorScheme === 'system' && (
              <ColorSchemeIcon className="size-5!" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className="hover:cursor-pointer w-full"
          onClick={(e) => {
            fetcher.submit(
              { 'color-scheme': 'dark' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <MoonIcon className="size-5! text-current!" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:cursor-pointer w-full"
          onSelect={(e) => {
            fetcher.submit(
              { 'color-scheme': 'light' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <SunIcon className="size-5! text-current!" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:cursor-pointer w-full"
          onSelect={(e) => {
            fetcher.submit(
              { 'color-scheme': 'system' },
              { method: 'post', action: '/api/theme' }
            )
          }}
        >
          <ColorSchemeIcon className="size-5! text-current!" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
