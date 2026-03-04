import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  useSidebar,
} from '@/ui/sidebar'
import { SidebarItem } from '@/components/app-sidebar'
import {
  AddIcon,
  FolderIcon,
  MoreIcon,
  SettingsIcon,
  ShareItemIcon,
  TrashIcon,
  WorkspaceIcon,
} from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useParams } from 'react-router'
import { useId } from 'react'

/**
 * WorkspacesSidebarItem
 *
 * Shape of an individual workspace entry displayed in the
 * Workspaces group of the sidebar.
 */
export interface WorkspacesSidebarItem {
  id: string
  name: string
  slug: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

/**
 * NavWorkspaces
 *
 * Renders the collapsible "Workspaces" group within the sidebar.
 * Each workspace is displayed as a SidebarItem with an attached
 * actions dropdown. The component adapts dropdown placement for
 * mobile using the useSidebar hook.
 */
export function NavWorkspaces({
  workspaces,
}: {
  workspaces: WorkspacesSidebarItem[]
}) {
  const id = useId()
  const { isMobile } = useSidebar()
  const params = useParams()
  return (
    <SidebarGroup id={id} key={id} className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
      <SidebarGroupAction title="add workspace">
        <AddIcon className="size-5! text-muted-foreground  hover:cursor-pointer" />
        <span className="sr-only">Add Workspace</span>
      </SidebarGroupAction>
      <SidebarMenu>
        {workspaces.map((item) => (
          <SidebarItem
            key={item.id}
            to={`/${params.me}/workspaces/${item.id}`}
            label={item.name}
            tooltip={item.name}
            icon={(isActive) => <WorkspaceIcon className="size-5!" />}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="rounded-xs" showOnHover>
                    <MoreIcon className="text-muted-foreground size-5!" />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="rounded-lg border border-border"
                  side={isMobile ? 'bottom' : 'right'}
                  align={isMobile ? 'end' : 'start'}
                >
                  <DropdownMenuItem>
                    <FolderIcon className="text-foreground size-5!" />
                    <span>View</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ShareItemIcon className="text-foreground size-5!" />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon className="text-foreground size-5!" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" className="mt-2">
                    <TrashIcon className="size-5!" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
