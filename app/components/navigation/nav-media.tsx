import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from '@/ui/sidebar'

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
      <SidebarMenu>
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
    </SidebarGroup>
  )
}
