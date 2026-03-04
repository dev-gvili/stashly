import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/ui/sidebar'

import {
  AIcon,
  CollectionIcon,
  FolderIcon,
  HomeIcon,
  ImagesIcon,
  RecentIcon,
  ShareIcon,
  TrashIcon,
  VideosIcon,
} from '@/components/icons'
import { NavMedia } from '@/components/navigation/nav-media'
import {
  NavWorkspaces,
  type WorkspacesSidebarItem,
} from '@/components/navigation/nav-workspaces'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
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
    <HomeIcon className="size-5! group-data-[state=collapsed]:ml-2" />
  ),
  label: 'My stash',
  to: "/",
  state: {
    reset: true,
  },
  tooltip: 'Home',
}

const sidebarItems: SidebarItemProps[] = [
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
      <CollectionIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Collections',
    to: 'collections',
    tooltip: 'Collections',
  },
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
      <TrashIcon className="size-5! group-data-[state=collapsed]:ml-2" />
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
    to: 'all?layout=grid&take=100',
    tooltip: 'All Files',
    prefetch: 'intent',
    state: {
      reset: true,
    },
  },
  {
    icon: (isActive) => (
      <ImagesIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Images',
    to: 'gallery?layout=waterfall',
    tooltip: 'Images',
    prefetch: 'intent',
  },
  {
    icon: (isActive) => (
      <VideosIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Videos',
    to: 'videos?layout=grid',
    tooltip: 'Videos',
  },
]

const workspaces: WorkspacesSidebarItem[] = [
  {
    id: toObjectId(getPrefixForModel('Workspace')),
    name: 'Stashly Dev Team',
    slug: 'stashly-dev-team',
  },
  {
    id: toObjectId(getPrefixForModel('Workspace')),
    name: 'Personal',
    slug: 'personal',
  },
  {
    id: toObjectId(getPrefixForModel('Workspace')),
    name: 'Dark UX/UI',
    slug: 'dark-ux-ui',
  },
  {
    id: toObjectId(getPrefixForModel('Workspace')),
    name: 'Projects',
    slug: 'projects',
  },
  {
    id: toObjectId(getPrefixForModel('Workspace')),
    name: 'Public Docs',
    slug: 'public-docs',
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
export const AppSidebar = ({ user }: { user: User }) => {
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
      className="border-none z-50"
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
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8! items-center justify-center rounded ">
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
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarItems.map((item, index) => (
                  <SidebarItem
                    {...item}
                    key={item.tooltip}
                    to={`${url}/${item.to}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* <NavWorkspaces workspaces={workspaces} /> */}
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
        className={cn(isActive && 'w-full border-2 border-current/30!')}
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
