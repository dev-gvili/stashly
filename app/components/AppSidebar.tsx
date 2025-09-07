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
	RiHomeLine,
	RiStarLine,
	RiStackLine,
	RiDeleteBin7Line,
	RiTimeLine,
	RiGroupLine,
	RiFoldersLine,
} from '@remixicon/react'
import { Link, NavLink, useMatch, useResolvedPath, type To } from 'react-router'
import { UserMenu } from './UserMenu'
import { Button } from './ui/button'
import { Logo } from './logo'

export type SidebarItem = {
	icon: React.ReactNode
	label?: string
	to: To
	items?: SidebarItem[]
}

export interface SidebarItemProps extends SidebarItem {
	tooltip?: string
}

const sidebarItems: SidebarItemProps[] = [
	{
		icon: <RiHomeLine className="h-5 w-5" />,
		to: '/dashboard',
		tooltip: 'home',
	},
	{
		icon: <RiTimeLine className="mr-2 h-4 w-4" />,
		to: '/dashboard/recent',
		tooltip: 'recent',
	},
	{
		icon: <RiStarLine className="mr-2 h-4 w-4" />,
		to: '/dashboard/favorites',
		tooltip: 'favorites',
	},
	{
		icon: <RiStackLine className="mr-2 h-4 w-4" />,
		to: '/dashboard/collections',
		tooltip: 'collections',
	},
	{
		icon: <RiGroupLine className="mr-2 h-4 w-4" />,
		to: '/dashboard/shares',
		tooltip: 'shares',
	},
	{
		icon: <RiFoldersLine className="mr-2 h-4 w-4" />,
		to: '/dashboard/folders',
		tooltip: 'folders',
	},
	{
		icon: <RiDeleteBin7Line className="mr-2 h-4 w-4" />,
		to: '/dashboard/trash',
		tooltip: 'trash',
	},
]

export const AppSidebar = () => {
	return (
		<Sidebar
			side="left"
			collapsible="icon"
			variant="sidebar"
			className="border-none"
		>
			<SidebarHeader className="p-3 group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[collapsible=icon]:pl-4  group-data-[collapsible=icon]:pt-6 transition-[width,height,padding-left,padding-top]">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/">
						<Logo className="size-9" />
					</Link>
				</Button>
			</SidebarHeader>
			<SidebarContent className="w-(--sidebar-width-icon)">
				<SidebarGroup className="p-4">
					<SidebarGroupContent>
						<SidebarMenu className="gap-y-3">
							{sidebarItems.map((item, index) => (
								<SidebarItem {...item} key={item.tooltip} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="p-4">
				{/* <LocaleToggle /> */}
				<UserMenu />
			</SidebarFooter>
		</Sidebar>
	)
}

function SidebarItem({ icon, label, to, tooltip }: SidebarItemProps) {
	const resolved = useResolvedPath(to)
	const match = useMatch({ path: resolved.pathname, end: true })
	return (
		<SidebarMenuItem key={label}>
			<SidebarMenuButton
				isActive={Boolean(match)}
				asChild={true}
				className="py-2 px-4 h-10 data-[active=true]:bg-background data-[active=true]:text-primary data-[active=true]:font-normal"
				tooltip={tooltip}
			>
				<Link to={to}>
					{icon}
					{label}
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}
