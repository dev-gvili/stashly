import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/styles'

export interface MagicLinkFormProps extends Omit<React.ComponentProps<'form'>, 'onChange' | 'onSubmit'> {
  email: string
  error?: string | null
  sentTo?: string | null
  pending?: boolean
  onEmailChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

export function MagicLinkForm({
  email,
  error,
  sentTo,
  pending = false,
  onEmailChange,
  onSubmit,
  className,
  ...props
}: MagicLinkFormProps) {
  const id = useId()
  const errorId = id + '-error'

  return (
    <form noValidate onSubmit={onSubmit} className={cn('flex flex-col', className)} {...props}>
      <Field data-invalid={!!error} className="gap-2">
        <FieldLabel htmlFor={id} className="font-sans text-xs font-normal text-muted-foreground">
          Email
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id={id}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-10.5 rounded-lg border-sidebar-border bg-card px-3.5 font-sans text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 dark:bg-card"
          />
          <Button type="submit" aria-busy={pending} className="h-10.5 rounded-lg px-4 font-sans">
            <span className="font-sans">{pending ? 'Sending…' : 'Send link'}</span>
          </Button>
        </div>
        {error ? (
          <FieldError id={errorId} className="font-sans text-xs">
            {error}
          </FieldError>
        ) : null}
        {sentTo && !error ? (
          <FieldDescription className="font-sans text-xs text-primary">
            {'Check your inbox — we sent a link to ' + sentTo}
          </FieldDescription>
        ) : null}
      </Field>
    </form>
  )
}
