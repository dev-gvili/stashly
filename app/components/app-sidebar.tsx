import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/ui/sidebar'

import {
  CollectionFillIcon,
  FavoritesFillIcon,
  FolderFillIcon,
  HomeFillIcon,
  ImagesFillIcon,
  PinFillIcon,
  InboxFillIcon,
  ShareFillIcon,
  StorageFillIcon,
  TrashFillIcon,
} from '@/components/icons'
import { NavMedia } from '@/components/navigation/nav-media'
import {
  NavWorkspaces,
  type WorkspacesSidebarItem,
} from '@/components/navigation/nav-workspaces'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/utils/styles'
import {
  Link,
  NavLink,
  useLocation,
  useMatch,
  useParams,
  useResolvedPath,
  type NavLinkProps,
  type To,
} from 'react-router'
import type { User } from '../.server/auth.types'
import { Logo } from './logo'
import { UserMenu } from './user-menu'
export type SidebarItemType = {
  icon: (isActive: boolean) => React.ReactNode
  label?: string
  to: To
  items?: SidebarItemType[]
} & NavLinkProps

export interface SidebarItemProps extends SidebarItemType {
  action?: React.ReactNode
  tooltip?: string
}


const OrganizeItems: SidebarItemProps[] = [
  {
    icon: (isActive) => <CollectionFillIcon />,
    label: 'Collections',
    to: 'collections?layout=grid',
    tooltip: 'Collections',
  },
  {
    icon: (isActive) => <FavoritesFillIcon />,
    label: 'Favorites',
    to: 'favorites?layout=grid',
    tooltip: 'Favorites',
  },
  {
    icon: (isActive) => <PinFillIcon />,
    label: 'Pinned',
    to: 'pinned?layout=grid',
    tooltip: 'Pinned',
  },
]

const sharingItems: SidebarItemProps[] = [
  {
    icon: (isActive) => <ShareFillIcon />,
    label: 'Shares',
    to: 'shares',
    tooltip: 'Shares',
  },
  {
    icon: (isActive) => <InboxFillIcon   />,
    label: 'Invitations',
    to: 'invitations',
    tooltip: 'Invitations',
  },
]

const manageItems: SidebarItemProps[] = [
  {
    icon: (isActive) => <StorageFillIcon />,
    label: 'Storage',
    to: 'storage',
    tooltip: 'Storage',
  },
  {
    icon: (isActive) => <TrashFillIcon />,
    label: 'Trash',
    to: 'trash?status=trashed&layout=grid&take=25',
    tooltip: 'Trash',
  },
  // {
  //   icon: (isActive) => <AIcon className="size-5!" />,
  //   label: 'AI',
  //   to: 'demo',
  //   tooltip: 'AI',
  // },
]

const mediaItems: SidebarItemProps[] = [
  {
    icon: (isActive) => <HomeFillIcon />,
    label: 'Home',
    to: '/',
    state: {
      reset: true,
    },
    tooltip: 'Home',
  },
  {
    icon: (isActive) => <FolderFillIcon />,
    label: 'All',
    to: 'all?layout=grid&take=25',
    tooltip: 'All Files',
    prefetch: 'intent',
    state: {
      reset: true,
    },
  },
  {
    icon: (isActive) => <ImagesFillIcon />,
    label: 'Images',
    to: 'images?layout=waterfall',
    tooltip: 'Images',
    prefetch: 'intent',
  },
  // {
  //   icon: (isActive) => <VideosFillIcon  />,
  //   label: 'Videos',
  //   to: 'videos?layout=grid',
  //   tooltip: 'Videos',
  //   prefetch: 'intent',
  // },
]

/**
 * AppSidebar
 *
 * Main left-hand application sidebar. Renders the primary navigation
 * items and the workspaces section. This component composes the
 * Sidebar primitives from the UI library and wires up navigation
 * links using react-router.
 */
export const AppSidebar = ({
  user,
  workspaces,
}: {
  user: User
  workspaces: WorkspacesSidebarItem[]
}) => {
  let { pathname } = useLocation()
  let params = useParams()
  let url = ''

  if (pathname.includes('workspaces') && !pathname.includes('stash')) {
    url = `/${user.id}/workspaces/${params.workspaceId}`
  }
  if (pathname.includes('stash') && !pathname.includes('workspaces')) {
    url = `/${user.id}/stash`
  }

  return (
    <Sidebar
      id="default"
      side="left"
      collapsible="icon"
      variant="floating"
      widthIcon="4rem"
    >
      <SidebarHeader className="bg-card pt-0">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <Link to={'/'} className="rounded-lg">
            <Logo className="size-10! text-primary" />
          </Link>
          <SidebarTrigger variant="ghost" size="icon-sm" />
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-card">
        <ScrollArea className="h-full" type="hidden">
          <NavMedia media={mediaItems} basePath={url} />
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              Organize
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {OrganizeItems.map((item) => (
                  <SidebarItem
                    {...item}
                    key={item.tooltip}
                    to={`${url}/${item.to}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              Collaboration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sharingItems.map((item) => (
                  <SidebarItem
                    {...item}
                    key={item.tooltip}
                    to={`${url}/${item.to}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              Manage
            </SidebarGroupLabel>
            {/* <SidebarGroupContent className="border-black border "> */}
            <SidebarMenu className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)-(--spacing(3)))]">
              {manageItems.map((item) => (
                <SidebarItem
                  {...item}
                  key={item.tooltip}
                  to={`${url}/${item.to}`}
                />
              ))}
            </SidebarMenu>
            {/* </SidebarGroupContent> */}
          </SidebarGroup>
          <NavWorkspaces workspaces={workspaces} />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="bg-card rounded-b-md">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 flex-1">
            <SidebarMenu>
              <UserMenu />
            </SidebarMenu>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * SidebarItem
 *
 * Renders a single navigational item inside the SidebarMenu. Uses
 * react-router's NavLink to handle active state and accepts an
 * optional action node (e.g. a dropdown trigger).
 */
export function SidebarItem({
  icon,
  label,
  to,
  tooltip,
  action,
  ...props
}: SidebarItemProps) {
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: true })
  const isActive = Boolean(match)
  let Icon = icon(isActive)
  return (
    <SidebarMenuItem
      key={label}
      data-active={isActive}
      data-tooltip={tooltip}
      className="group-data-[collapsible=icon]:grid! group-data-[collapsible=icon]:place-items-center! group-data-[collapsible=icon]:gap-0 "
    >
      <SidebarMenuButton
        isActive={isActive}
        asChild
        size="sm"
        tooltip={tooltip}
        className={cn(
          'w-full hover:text-current! hover:bg-sidebar-primary/30',
          isActive &&
            'w-full border-2 border-sidebar-primary! bg-sidebar-primary/30 text-accent-foreground! hover:text-accent-foreground!'
        )}
      >
        <NavLink
          to={to}
          end
          className={cn(
            'flex items-center flex-1  group-data-[state=collapsed]:items-center group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:justify-center'
          )}
          data-active={isActive}
          {...props}
        >
          {Icon}
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
      {action}
    </SidebarMenuItem>
  )
}
