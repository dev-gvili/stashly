import { cn } from '@/utils/styles';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Button } from '@/ui/button';
import {
	RiMoreFill,
	RiDownload2Line,
	RiFileCopyLine,
	RiEditBoxLine,
	RiShareForward2Line,
	RiInformationLine,
	RiDeleteBin7Line,
	RiTaskLine,
    RiMore2Fill,
} from '@/components/icons';

export const ActionsMenu = ({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger>) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild {...props}>
				<Button
					variant="ghost"
					size="icon"
					className={cn('z-20 hover:bg-transparent', className)}
				>
					<RiMore2Fill className="size-5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-56 bg-popover font-sans z-20 border-background"
			>
				<DropdownMenuItem>
					<RiDownload2Line className="text-card-foreground size-5" />
					<span>Download</span>
				</DropdownMenuItem>
				<DropdownMenuItem>
					<RiFileCopyLine className="text-card-foreground size-5" />
					<span>Copy</span>
				</DropdownMenuItem>
				<DropdownMenuItem>
					<RiEditBoxLine className="text-card-foreground size-5" />
					<span>Rename</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator className='border-background border'/>
				<DropdownMenuItem className="gap-x-2">
					<RiShareForward2Line className="text-popover-foreground size-5" />
					<span>Share</span>
					<DropdownMenuShortcut className="font-medium text-xs capitalize">
						Ctrl+Alt+A
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className="[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 text-card-foreground gap-x-2">
						<RiInformationLine />
						<span>Information</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent
							sideOffset={10}
							className="bg-popover"
						>
							<DropdownMenuItem>
								<RiTaskLine className="text-card-foreground size-5" />
								<span>Activity</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<RiInformationLine className="text-card-foreground size-5" />
								<span>Details</span>
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
				<DropdownMenuSeparator className='border-background border'/>
				<DropdownMenuItem>
					<RiDeleteBin7Line className="text-card-foreground size-5" />
					<span>Remove</span>
					<DropdownMenuShortcut className="font-medium text-xs capitalize">
						Delete
					</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
