import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/ui/sidebar'

import { SidebarItem, type SidebarItemProps } from '@/components/app-sidebar'
import { cn } from '../../utils/styles'
export function NavMedia({
  media,
  basePath,
}: {
  media: SidebarItemProps[]
  basePath: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)-(--spacing(3)))]">
          {media.map((item) => (
            <SidebarItem
              key={item.label}
              {...item}
              to={`${basePath}/${item.to}`}
              label={item.label}
              tooltip={item.tooltip}
              icon={item.icon}
              state={item.state}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
