import { LoaderIcon } from '@/components/icons'
import { toUserInitial } from '@/utils/converters'
import { cn } from '@/utils/styles'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { useId, useState } from 'react'
import { useFetcher } from 'react-router'
import { SETTINGS_CARD } from './settings-layout'

interface ProfileUser {
  name: string
  email: string
  image: string | null
}

type ProfileResult = { ok: true; name: string } | { fieldErrors: { name: string } }

/**
 * Profile: photo, full name (editable) and email (read-only, still focusable so
 * it can be copied). Save is enabled only once the trimmed name differs from
 * the saved one. Changing the photo is not offered: there is no avatar upload
 * path yet, so the avatar shows the sign-in provider's image or initials.
 */
export function ProfileSettings({ user }: { user: ProfileUser }) {
  const fetcher = useFetcher<ProfileResult>()
  const [name, setName] = useState(user.name)
  const nameId = useId()
  const emailId = useId()
  const errorId = useId()

  const submitting = fetcher.state !== 'idle'
  const error =
    fetcher.state === 'idle' && fetcher.data && 'fieldErrors' in fetcher.data
      ? fetcher.data.fieldErrors.name
      : undefined
  const dirty = name.trim() !== user.name

  return (
    <Card className={cn(SETTINGS_CARD, 'flex flex-col gap-5 p-6')}>
      <fetcher.Form method="post" className="contents">
        <input type="hidden" name="intent" value="update_profile" />

        <div className="flex items-center gap-4">
          {/* Squarish like the sidebar's avatar: project rules win over the
              mockup's circle (no rounded-full, owner's rule 13 Nov). */}
          <Avatar className="size-14 rounded-md">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="rounded-md bg-secondary text-lg text-secondary-foreground">
              {toUserInitial(user.name)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId} className="text-xs text-muted-foreground">
              Full name
            </Label>
            <Input
              id={nameId}
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error && (
              <p id={errorId} className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={emailId} className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input
              id={emailId}
              value={user.email}
              readOnly
              aria-readonly
              className="bg-muted text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-input pt-5">
          <Button type="submit" disabled={!dirty || submitting}>
            {submitting && <LoaderIcon aria-hidden className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </fetcher.Form>
    </Card>
  )
}
