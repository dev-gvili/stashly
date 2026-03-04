import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { Link, useLoaderData, useSubmit } from 'react-router'
import { LogoutIcon, SettingsIcon, UserIcon } from '@/components/icons'
import { toUserInitial } from '@/utils/converters'
import type { Route } from '../routes/+types/layout'
import { SidebarMenuButton, useSidebar } from './ui/sidebar'

export function UserMenu() {
  const submit = useSubmit()
  const data = useLoaderData<Route.ComponentProps['loaderData']>()
  const user = data.user
  if (!user) return null
  let { isMobile } = useSidebar()
  const _onClick = () => {
    submit(null, { method: 'POST', action: '/auth/sign-out', replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="cursor-pointer">
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-sm">
            <AvatarImage src={user.image || ''} alt={user.name} />
            <AvatarFallback className="rounded-sm font-sans">
              {toUserInitial(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 mb-4"
        align="start"
        side={isMobile ? 'bottom' : 'right'}
        sideOffset={4}
      >
        <DropdownMenuLabel className="font-stashly text-sm leading-tight">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-xs">
            <div className="grid flex-1 gap-1">
              <span className="truncate text-xs text-foreground font-stashly">
                {user.name}
              </span>
              <span className="truncate text-xs font-light text-card-foreground font-stashly">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuItem className="hover:cursor-pointer" asChild>
          <Link to={`/${user.id}/profile`}>
            <UserIcon className="size-5! text-current" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="hover:cursor-pointer" asChild>
          <Link to={`/${user.id}/settings`}>
            <SettingsIcon className="size-5! text-current" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="hover:cursor-pointer" onClick={_onClick}>
          <LogoutIcon className="size-5! text-current" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
