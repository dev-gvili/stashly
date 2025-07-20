// import { ActionsMenu } from 'components/ActionsMenu'
import { AspectRatio } from '@/ui/aspect-ratio'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/ui/card'
import { formatSize } from '@/utils/formaters'
import { RiFileFill, RiFolderFill } from '@remixicon/react'
import { Link } from 'react-router'
import { ItemType } from '@/prisma/enums'
import { cn } from '@/utils/styles'
import type { LinkProps } from 'react-router'
// import { Favorite } from 'components/buttons/Favorite'
import { Image } from '@/ui/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { Skeleton } from '@/ui/skeleton';
import { ActionsMenu } from '../ActionMenu'

export interface ItemCardProps extends LinkProps {
	size: number
	id: string
	name: string
	thumbnail?: string
	type: ItemType
	favorited: boolean
}

export const ItemCard = ({
	id,
	name,
	type,
	size,
	thumbnail,
	favorited,
	...props
}: ItemCardProps) => {
	return (
		<Link {...props} className="group/card card select-none">
			<AspectRatio ratio={1 / 1} asChild>
				<Card className="p-4 shadow-none grid gap-2 border-none  bg-sidebar rounded-none">
					<ItemHeader title={name} />
					<CardContent className="overflow-hidden">
						<ItemThumbnail
							type={type}
							thumbnail={thumbnail}
							alt={name}
						/>
					</CardContent>
					<CardFooter className="flex justify-between items-center">
						{/* <Favorite ItemId={id} favorited={favorited} /> */}
						<ItemSize size={size} />
					</CardFooter>
				</Card>
			</AspectRatio>
		</Link>
	)
}

const ItemHeader = ({ title }: { title: string }) => {
	return (
		<CardHeader className="grid grid-cols-3 p-0 items-center">
			<CardTitle
				title={title}
				className="text-foreground col-span-2 text-base font-normal font-sans truncate align-top ml-3"
			>
				{title}
			</CardTitle>
			<ActionsMenu className="peer group-hover/card:visible data-[state=open]:visible font-sans  transition-[visibility] shrink-0 place-self-end" />
		</CardHeader>
	)
}

interface ItemThumbnailProps
	extends React.ComponentPropsWithoutRef<typeof Image> {
	type: ItemType
	thumbnail?: string
}

const ItemThumbnail = ({
	type,
	thumbnail,
	...props
}: ItemThumbnailProps) => {
	if (type === 'file') {
		return (
			<Image
				height={500}
				width={500}
				src={`${thumbnail}`}
				alt="File thumbnail"
				className={cn(
					'object-cover rounded w-full h-full flex-1 aspect-video'
				)}
			/>
		)
	}

	return (
		<div className="w-full h-full aspect-video flex items-center justify-center rounded-md bg-background">
			<RiFolderFill className={cn('size-12 text-muted-foreground')} />
		</div>
	)
}

interface ItemSizeProps
	extends React.ComponentPropsWithoutRef<typeof CardDescription> {
	size: number
}

function ItemSize({
	className,
	children,
	size,
	...props
}: ItemSizeProps) {
	return (
		<CardDescription
			className={cn(
				'text-card-foreground text-xs font-sans shrink-0 mr-3 mt-1',
				className
			)}
			{...props}
		>
			{formatSize('byte', 'unit', size)}
		</CardDescription>
	)
}
