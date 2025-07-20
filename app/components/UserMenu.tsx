import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Button } from '@/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import {
	Link,
	useLoaderData,
	useRouteLoaderData,
	useSubmit,
} from 'react-router'
import {
	RiLogoutBoxLine,
	RiSettingsLine,
	RiUser6Line,
} from '@/components/icons'
import { toUserInitial } from '@/utils/converters'
import type { User } from 'better-auth'
import { authClient } from '../services/auth.client'
import type { Route } from '../routes/+types/layout'

export function UserMenu() {
	const data = useLoaderData<Route.ComponentProps['loaderData']>()
	const user = data.user as User | null
	const submit = useSubmit()
	const _onClick = () => {
		submit(null, { method: "POST", action: "/auth/sign-out", replace: true });
	}

	if (!user) {
		return null
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild className='cursor-pointer'>
				<Button variant="ghost" size="icon" className="h-8 w-8">
					<Avatar className="h-8 w-8 rounded-sm">
						<AvatarImage src={user.image || ''} alt={user.name} />
						<AvatarFallback className="rounded-sm font-sans">
							{toUserInitial(user.name)}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="right"
				align="end"
				sideOffset={4}
				className="z-9999 shadow-sm border border-background"
			>
				<DropdownMenuLabel className="p-0 font-sans leading-tight">
					<div className="flex items-center gap-2 px-1 py-1.5 text-left text-xs">
						<div className="grid flex-1 gap-1">
							<span className="truncate text-xs text-foreground">
								{user.name}
							</span>
							<span className="truncate text-xs font-light text-card-foreground">
								{user.email}
							</span>
						</div>
					</div>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />
				<DropdownMenuItem className="hover:cursor-pointer" asChild>
					<Link to={`/${user.id}/settings`}>
						<RiSettingsLine className="mr-2 h-4 w-4" />
						<span>Settings</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem className="hover:cursor-pointer" asChild>
					<Link to={`/${user.id}/profile`}>
						<RiUser6Line className="mr-2 h-4 w-4" />
						<span>Profile</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="hover:cursor-pointer" asChild>
					<Button
						variant="ghost"
						size="sm"
						className="w-full justify-start focus-visible:ring-0"
						onClick={_onClick}
					>
						<RiLogoutBoxLine className="mr-2 h-4 w-4" />
						<span>Logout</span>
					</Button>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
