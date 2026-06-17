import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import type { Route } from '../+types/root'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { ButtonGroup } from './ui/button-group'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { RiExpandUpDownLine } from '@remixicon/react'
import { CopyFillIcon, ExpandCollapsedIcon, HomeFillIcon, RefreshIcon } from './icons'

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  error = error ?? useRouteError()

  const navigate = useNavigate()
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  let message = 'Error!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="w-full" role="alert" aria-live="assertive">
      <Alert className="bg-muted font-stashly">
        <AlertTitle
          className="flex justify-between w-full"
          ref={titleRef}
          tabIndex={-1}
        >
          <span className="text-md text-muted-foreground">{message}</span>
          <ButtonGroup>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-xs"
              onClick={() => window.location.reload()}
            >
              <RefreshIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-xs"
              onClick={() => navigate('/')}
            >
              <HomeFillIcon className="size-5" />
            </Button>

            {stack && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-xs"
                onClick={() => navigator.clipboard?.writeText(stack)}
              >
                <CopyFillIcon className="size-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              className="text-xs"
              hidden={!stack}
              onClick={() => setShowDetails((s) => !s)}
            >
              <ExpandCollapsedIcon className="size-5" />
            </Button>
          </ButtonGroup>
        </AlertTitle>
        <AlertDescription>
          <span className="text-primary">{details}</span>
          {showDetails && stack && (
            <ScrollArea className="h-60 w-full">
              <div className="mt-8 w-full font-stashly text-sm text-foreground! flex flex-col gap-y-1">
                {stack.split('\n').map((line, index) => {
                  return (
                    <span key={index} className="w-full">
                      <span className="font-stashly text-muted-foreground/40 ">
                        {index}.{' '}
                      </span>
                      {line.trim()}
                      {index < stack.split('\n').length - 1 && <br />}
                    </span>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </AlertDescription>
      </Alert>
    </main>
  )
}
