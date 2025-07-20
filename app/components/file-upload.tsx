import { CircleProgressBar } from '@/components/circle-progress-bar'
import {
	RiCloseCircleFill as RemoveIcon,
	RiCheckboxCircleFill as SuccessIcon,
} from '@/components/icons'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { timeLeft } from '@/machines/schema.zod'
import type { Config, MediaFile, MediaFileStatus } from '@/machines/types'
import { uploadMachine } from '@/machines/upload.machine'
import { toCategory, toIcon, toMediaFile } from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { callAll } from '@/utils/misc'
import { cn } from '@/utils/styles'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useComposedRefs } from '@radix-ui/react-compose-refs'
import { useSelector } from '@xstate/react'
import { Label as LabelPrimitive, VisuallyHidden } from 'radix-ui'
import React from 'react'
import { createActor } from 'xstate'
import {createBrowserInspector} from "@statelyai/inspect"
import type { User } from 'better-auth'
// ====================================================== //
// Actor                                                  //
// ====================================================== //
const {inspect} = createBrowserInspector()
export const uploadManagerActor = createActor(uploadMachine, {
	systemId: 'uploadManager',
	inspect,
})
uploadManagerActor.start()

// ====================================================== //
// Hooks                                                  //
// ====================================================== //
export const useUploadMediaFiles = () => {
	let mediaFiles = useSelector(
		uploadManagerActor,
		(state) => state.context.mediaFiles
	)
	if (mediaFiles && mediaFiles.size > 0) {
		return Array.from(mediaFiles.values())
	}
	return []
}

// export const useUploadConfig = () => {
// 	let config = useSelector(
// 		uploadManagerActor,
// 		(state) => state.context.config
// 	)
// 	const setConfig = (config: Config) =>
// 		uploadManagerActor.send({ type: 'upload.config', {...config, user} })
// 	return { config, setConfig }
// }

// ====================================================== //
// Styles                                                 //
// ====================================================== //
const Styles = {
	FileExtention:
		'font-bold text-[0.55rem] dark:text-black dark:bg-white/40 bg-black text-white w-full max-w-max  flex items-center justify-center uppercase h-4 py-1 px-2 rounded-md group-data-[state=aborted]:dark:opacity-20',
	DropArea:
		'group z-50 min-w-96 w-full h-32 border-dashed border bg-inherit shadow-none rounded-lg p-4 grid place-items-center',
	Trigger:
		'max-w-max rounded-md bg-inherit px-2 py-1.5 font-mono text-xs  focus:outline-background hover:cursor-pointer border border-border/10',
	FileList: 'w-full max-w-md h-full space-y-3 p-1',
	Item: 'relative overflow-hidden grid grid-cols-8 w-full rounded-lg bg-card/5 p-1 list-none border-border border h-auto place-content-between place-items-center gap-2 group',
	ItemBody: 'col-span-6 w-full',
	ItemContent: 'flex w-full justify-between',
	Progress:
		'group group-data-[state=aborted]:opacity-20 group-data-[state=uploading]:hover:cursor-pointer',
	FileIcon:
		'flex appearance-none items-center justify-center bg-transparent w-8 h-8 group-data-[state=aborted]:opacity-20',
	FileName:
		'overflow-hidden text-ellipsis text-nowrap text-start font-mono text-xs font-bold dark:text-white group-data-[state=aborted]:dark:opacity-10',
	Total: 'w-56 overflow-hidden text-ellipsis text-nowrap text-start font-mono text-xs font-bold dark:text-white group-data-[state=aborted]:dark:opacity-20',
	CountDown:
		'text-start font-mono text-xs group-data-[state=aborted]:hidden text-nowrap',
	StatusText: (status: MediaFileStatus) =>
		`text-start font-mono text-xs hidden group-data-[state=aborted]:dark:opacity-10 group-data-[state=${status}]:block text-nowrap capitalize`,
	Description:
		'font-mono text-xs text-muted-foreground group-data-[state=aborted]:opacity-20',
	Cancel: 'appearance-none bg-transparent disabled:cursor-default hidden group-data-[state=uploading]:group-hover:block',
} as const

// ====================================================== //
// Helpers                                                //
// ====================================================== //
const formatCountdown = (value: any) => {
	let parsedtimeLeft = timeLeft.parse(value)
	let countdownString = ''
	if (parsedtimeLeft.hours > 0)
		countdownString += `${parsedtimeLeft.hours} hours `
	if (parsedtimeLeft.minutes > 0)
		countdownString += `${parsedtimeLeft.minutes} minutes `
	if (parsedtimeLeft.seconds > 0)
		countdownString += `${parsedtimeLeft.seconds} seconds `
	if (countdownString) countdownString += 'left'
	return `${countdownString}`
}

// ====================================================== //
// Components                                             //
// ====================================================== //
export const MediaUploadRoot = ({
	children,
	bucketName,
	ownerId,
	user
}: {
	children: React.ReactNode
	bucketName: string
	ownerId: string
	user: User & { bucket: string}
}) => {
	React.useEffect(() => {
		uploadManagerActor.send({
			type: 'upload.config',
			user,
			config: {
				bucketName,
				ownerId,
			},
		})
	}, [])
	return <>{children}</>
}
MediaUploadRoot.displayName = 'MediaUploadRoot'

export const DropArea = React.forwardRef<
	React.ComponentRef<'div'>,
	React.ComponentPropsWithoutRef<'div'>
>(
	(
		{
			id: propId,
			children,
			className,
			onDrop,
			onDragOver,
			onDragLeave,
			onDragEnter,
			...props
		},
		forwardRef
	) => {
		const id = propId || React.useId()
		const styles =
			'group z-50 min-w-96 w-full h-32 border-dashed dark:border dark:border-white/10 dark:bg-inherit dark:shadow-none rounded-lg p-4 grid place-items-center dark:border-dashed'

		const _onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault()
			event.currentTarget.classList.remove('bg-inherit')
			event.currentTarget.classList.add('bg-background')
		}

		const _onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault()
			event.stopPropagation()
			for (const child of event.currentTarget.children) {
				child.classList.add('pointer-events-none')
			}
			event.currentTarget.classList.remove('bg-inherit')
			event.currentTarget.classList.add('bg-background')
		}

		const _onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault()
			event.stopPropagation()
			event.currentTarget.classList.remove('bg-background')
			event.currentTarget.classList.add('bg-inherit')
			for (const child of event.currentTarget.children) {
				child.classList.remove('pointer-events-none')
			}
		}

		const _onDrop = (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault()
			event.currentTarget.classList.remove('bg-background')
			event.currentTarget.classList.add('bg-inherit')
			for (const child of event.currentTarget.children) {
				child.classList.remove('pointer-events-none')
			}
			for (const item of event.dataTransfer.items) {
				const file = item.getAsFile()
				if (!file) return
				uploadManagerActor.send({
					type: 'upload.add',
					mediaFile: toMediaFile(file),
				})
			}
		}

		return (
			<div
				id={id}
				ref={forwardRef}
				className={cn(styles, className)}
				onDragEnter={callAll(_onDragEnter, onDragEnter)}
				onDragLeave={callAll(_onDragLeave, onDragLeave)}
				onDragOver={callAll(_onDragOver, onDragOver)}
				onDrop={callAll(_onDrop, onDrop)}
				{...props}
			>
				{children}
			</div>
		)
	}
)
DropArea.displayName = 'DropArea'

interface TriggerProps extends Omit<LabelPrimitive.LabelProps, 'onChange'> {
	name?: string
	webkitdirectory?: string
	onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined
}

export const Trigger = React.forwardRef<
	React.ComponentRef<typeof LabelPrimitive.Root>,
	TriggerProps
>(
	(
		{
			children,
			id: propId,
			className,
			webkitdirectory,
			name = 'files',
			onChange,
			...props
		},
		forwardRef
	) => {
		const id = propId || React.useId()
		const _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			if (!event.target.files) return
			for (const file of event.target.files) {
				let mediaFile = toMediaFile(file)
				uploadManagerActor.send({
					type: 'upload.add',
					mediaFile,
				})
			}
			event.currentTarget.value = ''
		}
		return (
			<Label
				ref={forwardRef}
				htmlFor={id}
				className={cn(Styles.Trigger, className)}
				{...props}
			>
				<VisuallyHidden.Root>
					<input
						title="select files to upload"
						id={id}
						type="file"
						multiple
						webkitdirectory={webkitdirectory}
						name={name}
						className="h-1 w-1"
						onChange={callAll(_onChange, onChange)}
					/>
				</VisuallyHidden.Root>
				{children}
			</Label>
		)
	}
)
Trigger.displayName = 'Trigger'

export const FileList = React.forwardRef<
	React.ComponentRef<'ul'>,
	React.ComponentPropsWithoutRef<'ul'>
>(({ children, className, id: propId, ...props }, forwardRef) => {
	const id = propId || React.useId()
	let [parent] = useAutoAnimate<HTMLUListElement>()
	let refs = useComposedRefs(forwardRef, parent)
	const files = useSelector(uploadManagerActor, (state) =>
		Array.from(state.context.mediaFiles.values()).reverse()
	)
	return (
		<ScrollArea
			className={cn(
				'h-80 max-h-80 min-w-96',
				files.length < 1 && 'h-0',
				files.length < 6 && `h-[${files.length * 48}]`
			)}
		>
			<ul
				id={id}
				ref={refs}
				className={cn(Styles.FileList, className)}
				{...props}
			>
				{files.map((mediaFile) => {
					return (
						<Item
							mediaFile={mediaFile}
							key={mediaFile.id}
							id={`media-file-${mediaFile.id}`}
							data-state={mediaFile.status}
							data-value={mediaFile.progress}
						/>
					)
				})}
			</ul>
		</ScrollArea>
	)
})
FileList.displayName = 'Items'

const Item = React.forwardRef<
	React.ComponentRef<'li'>,
	React.ComponentPropsWithoutRef<'li'> & { mediaFile: MediaFile }
>(({ children, className, id: propId, mediaFile, ...props }, forwardRef) => {
	const id = propId || `media-file-${mediaFile.id}`
	return (
		<li
			id={id}
			ref={forwardRef}
			className={cn(Styles.Item, className)}
			tabIndex={0}
			{...props}
		>
			<FileIcon file={mediaFile.file} />
			<div className={Styles.ItemBody}>
				<FileName>{mediaFile.file.name}</FileName>
				<div className={Styles.ItemContent}>
					<FileSize>
						{formatSize('byte', 'unit', mediaFile.file.size)}
					</FileSize>
					<CountDown>{formatCountdown(mediaFile.timeLeft)}</CountDown>
					<StatusText status={mediaFile.status}>
						{mediaFile.status}
					</StatusText>
				</div>
			</div>
			<Progress progress={mediaFile.progress || 0}>
				<Cancel mediaFile={mediaFile!} />
				<SuccessIcon className="hidden h-8 w-8 group-data-[state=done]:block dark:fill-white" />
			</Progress>
		</li>
	)
})
Item.displayName = 'Item'

const Progress = React.forwardRef<
	React.ComponentRef<'svg'>,
	React.ComponentPropsWithoutRef<typeof CircleProgressBar.Root> & {
		progress: number
	}
>(({ id, children, progress, className, ...props }, forwardRef) => {
	id = id || React.useId()
	return (
		<CircleProgressBar.Root
			ref={forwardRef}
			className={cn(Styles.Progress, className)}
			{...props}
		>
			<CircleProgressBar.Circle />
			<CircleProgressBar.Indicator progress={progress} />
			<CircleProgressBar.Value width={34} height={34} x="30%" y="30%">
				{children}
				<p className="mt-1 w-full text-center font-mono font-bold">
					{`${progress}%`}
				</p>
			</CircleProgressBar.Value>
		</CircleProgressBar.Root>
	)
})
Progress.displayName = 'Progress'

const FileIcon = React.forwardRef<
	React.ComponentRef<'div'>,
	React.ComponentPropsWithoutRef<'div'> & { file: File }
>(({ children, className, id, file, ...props }, forwardRef) => {
	id = id || React.useId()
	let category = toCategory(file)
	const Icon = toIcon(category)
	return (
		<div
			id={id}
			ref={forwardRef}
			className={cn(Styles.FileIcon, className)}
			{...props}
		>
			<Icon />
		</div>
	)
})
FileIcon.displayName = 'FileIcon'

const FileExtention = React.forwardRef<
	React.ComponentRef<'span'>,
	React.ComponentPropsWithoutRef<'span'> & { fileName: string }
>(({ children, className, id, fileName, ...props }, forwardRef) => {
	id = id || React.useId()
	let regex = new RegExp(/.(\w+|\d+)$/)
	let ext = fileName.match(regex) ?? []
	return (
		<span
			id={id}
			ref={forwardRef}
			className={cn(Styles.FileExtention, className)}
			{...props}
		>
			{ext[1]}
		</span>
	)
})
FileExtention.displayName = 'FileExtention'

const FileName = React.forwardRef<
	React.ComponentRef<'h1'>,
	React.ComponentPropsWithoutRef<'h1'>
>(({ className, children, ...props }, ref) => (
	<h1
		ref={ref}
		title={`${children}`}
		className={cn(Styles.FileName, className)}
		{...props}
	>
		{children}
	</h1>
))
FileName.displayName = 'FileName'

export const Total = React.forwardRef<
	React.ComponentRef<'h1'>,
	React.ComponentPropsWithoutRef<'h1'>
>(({ className, children, ...props }, ref) => {
	let total = useSelector(
		uploadManagerActor,
		(state) => state.context.mediaFiles.size
	)
	return (
		<h1
			ref={ref}
			title={`${children}`}
			className={cn(Styles.Total, className)}
			{...props}
		>
			{total}
		</h1>
	)
})
Total.displayName = 'Total'

export const CountDown = React.forwardRef<
	React.ComponentRef<'h1'>,
	React.ComponentPropsWithoutRef<'h1'>
>(({ className, children, ...props }, ref) => {
	return (
		<h1 ref={ref} className={cn(Styles.CountDown, className)} {...props}>
			{children}
		</h1>
	)
})
CountDown.displayName = 'CountDown'

export const StatusText = React.forwardRef<
	React.ComponentRef<'h1'>,
	React.ComponentPropsWithoutRef<'h1'> & { status: MediaFileStatus }
>(({ className, children, status, ...props }, ref) => {
	return (
		<h1
			ref={ref}
			className={cn(Styles.StatusText(status), className)}
			{...props}
		>
			{children}
		</h1>
	)
})
CountDown.displayName = 'CountDown'

const Description = React.forwardRef<
	React.ComponentRef<'p'>,
	React.ComponentPropsWithoutRef<'p'>
>(({ className, children, ...props }, forwardRef) => (
	<p
		ref={forwardRef}
		className={cn(Styles.Description, className)}
		{...props}
	>
		{children}
	</p>
))
Description.displayName = 'Description'

const FileSize = React.forwardRef<
	React.ComponentRef<'p'>,
	React.ComponentPropsWithoutRef<'p'>
>(({ children, ...props }, forwardRef) => (
	<Description ref={forwardRef} {...props}>
		{children}
	</Description>
))
FileSize.displayName = 'FileSize'

const Cancel = React.forwardRef<
	React.ComponentRef<'button'>,
	React.ComponentPropsWithoutRef<'button'> & { mediaFile: MediaFile }
>(({ className, children, onClick, mediaFile, ...props }, forwardRef) => {
	const _onClick = () => {
		uploadManagerActor.send({
			type: 'upload.abort',
			mediaFile,
		})
	}
	return (
		<button
			disabled={mediaFile.status === 'aborted'}
			ref={forwardRef}
			onClick={callAll(_onClick, onClick)}
			className={cn(Styles.Cancel, className)}
			{...props}
		>
			<RemoveIcon className="h-8 w-8 dark:fill-white/20 group-hover:dark:fill-white" />
		</button>
	)
})
Cancel.displayName = 'CancelButton'
