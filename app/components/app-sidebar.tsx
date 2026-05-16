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
} from '@/ui/sidebar'

import {
  AIcon,
  CollectionFillIcon,
  CollectionIcon,
  CollectionLineIcon,
  FavoriteIcon,
  FolderIcon,
  HomeFillIcon,
  HomeIcon,
  ImagesFillIcon,
  ImagesIcon,
  PinIcon,
  RecentIcon,
  SendInvitationIcon,
  ShareIcon,
  StorageFillIcon,
  TrashFillIcon,
  VideoFillIcon,
  VideosIcon,
} from '@/components/icons'
import { NavMedia } from '@/components/navigation/nav-media'
import {
  NavWorkspaces,
  type WorkspacesSidebarItem,
} from '@/components/navigation/nav-workspaces'
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
import { Logo } from './logo'
import { UserMenu } from './user-menu'
import { GalleryWide } from '@/components/icons'
import { cn } from '@/utils/styles'
import { ScrollArea } from './ui/scroll-area'
import type { User } from '../.server/auth.types'
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

const home: SidebarItemProps = {
  icon: (isActive) => (
    <HomeFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
  ),
  label: 'My stash',
  to: '/',
  state: {
    reset: true,
  },
  tooltip: 'Home',
}

const libraryItems: SidebarItemProps[] = [
  {
    icon: (isActive) => (
      <RecentIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Recent Files',
    to: 'recent',
    tooltip: 'Recent Files',
  },
  {
    icon: (isActive) => (
      <CollectionFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Collections',
    to: 'collections?layout=grid',
    tooltip: 'Collections',
  },
  {
    icon: (isActive) => (
      <FavoriteIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Favorites',
    to: 'favorites?layout=grid',
    tooltip: 'Favorites',
  },
  {
    icon: (isActive) => (
      <PinIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Pinned',
    to: 'pinned?layout=grid',
    tooltip: 'Pinned',
  },
]

const sharingItems: SidebarItemProps[] = [
  {
    icon: (isActive) => (
      <ShareIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Shares',
    to: 'shares',
    tooltip: 'Shares',
  },
  {
    icon: (isActive) => (
      <SendInvitationIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Invitations',
    to: 'invitations',
    tooltip: 'Invitations',
  },
]

const manageItems: SidebarItemProps[] = [
  {
    icon: (isActive) => (
      <StorageFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Storage',
    to: 'storage',
    tooltip: 'Storage',
  },
  {
    icon: (isActive) => (
      <TrashFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Trash',
    to: 'trash?status=trashed&layout=grid&take=100',
    tooltip: 'Trash',
  },
  {
    icon: (isActive) => (
      <AIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'AI',
    to: 'demo',
    tooltip: 'AI',
  },
]

const mediaItems: SidebarItemProps[] = [
  {
    icon: (isActive) => (
      <FolderIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'All Files',
    to: 'all?layout=grid&take=25',
    tooltip: 'All Files',
    prefetch: 'intent',
    state: {
      reset: true,
    },
  },
  {
    icon: (isActive) => (
      <ImagesFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Images',
    to: 'images?layout=waterfall',
    tooltip: 'Images',
    prefetch: 'intent',
  },
  {
    icon: (isActive) => (
      <VideoFillIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Videos',
    to: 'videos?layout=grid',
    tooltip: 'Videos',
    prefetch: 'intent',
  },
]

/**
 * AppSidebar
 *
 * Main left-hand application sidebar. Renders the primary navigation
 * items and the workspaces section. This component composes the
 * Sidebar primitives from the UI library and wires up navigation
 * links using react-router.
 */
export const AppSidebar = ({ user, workspaces }: { user: User; workspaces: WorkspacesSidebarItem[] }) => {
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
      variant="sidebar"
      className="border-none shadow-md shadow-primary py-2 z-50"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="hover:cursor-pointer max-w-max"
            >
              <Link to={'/'}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8! items-center justify-center rounded-md ">
                  <Logo className="size-6" />
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full group-data-[state=collapsed]:pr-0 pr-1">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarItem {...home} to={`${home.to}`} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <NavMedia media={mediaItems} basePath={url} />
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {libraryItems.map((item) => (
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
            <SidebarGroupLabel>Sharing</SidebarGroupLabel>
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
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {manageItems.map((item) => (
                  <SidebarItem
                    {...item}
                    key={item.tooltip}
                    to={`${url}/${item.to}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <NavWorkspaces workspaces={workspaces} />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="bg-sidebar">
        <SidebarMenu>
          <UserMenu />
        </SidebarMenu>
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
    <SidebarMenuItem key={label}>
      <SidebarMenuButton
        size="default"
        isActive={isActive}
        asChild
        tooltip={tooltip}
        className={cn(
          'group-data-[state=collapsed]:-ml-4! hover:text-current! hover:bg-sidebar-primary/30 transition-colors duration-200',
          isActive && 'w-full border-2 border-primary! bg-muted! text-accent-foreground! hover:text-accent-foreground!',
        )}
      >
        <NavLink
          to={to}
          end
          className={cn(
            'flex items-center w-full group-data-[collapsible=icon]:justify-center'
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
