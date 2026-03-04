import { useFetcher, useRouteLoaderData } from 'react-router'
import type { loader } from '../root' // Import loader type for type-safety
import { AnimatePresence, motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Button } from './ui/button'
import { MoonIcon, SunIcon } from './icons'

export function ThemeToggle() {
  const fetcher = useFetcher()
  const rootData = useRouteLoaderData<typeof loader>('root')

  // Optimistic UI: Check if we are currently submitting a new theme
  const optimisticTheme = fetcher.formData?.get('theme')
  const currentTheme = optimisticTheme ?? rootData?.theme ?? 'light'

  const nextTheme = currentTheme === 'light' ? 'dark' : 'light'

  console.log(nextTheme, currentTheme)
  return (
    <fetcher.Form method="post" action="/api/theme">
      <input type="hidden" name="theme" value={nextTheme} />
      <Tooltip content="Toggle Theme" asChild>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-8 bg-inherit border-border rounded-md hover:bg-muted! hover:cursor-pointer"
        >
          {currentTheme === 'light' ? (
            <MoonIcon className="size-5!" />
          ) : (
            <SunIcon className="size-5!" />
          )}
        </Button>
      </Tooltip>
    </fetcher.Form>
  )
}
