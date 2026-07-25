import { CircleProgressBar } from '@/components/squer-progress-bar'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { uploadProgress } from '@/schemas/machine.schemas'
import type { MediaFileStatus, Status, User } from '@/types/machine.types'
import {
  useUpload,
  useUploadCounts,
  useUploadFileIds,
  useUploadFileMeta,
  useUploadProgress,
  useUploadStatus,
} from '@/hooks/useUpload'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Logo } from '../logo'
import { toCategory, toIcon } from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { callAll } from '@/utils/misc'
import { cn } from '@/utils/styles'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useComposedRefs } from '@radix-ui/react-compose-refs'
import { Label as LabelPrimitive, VisuallyHidden } from 'radix-ui'
import React, { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../ui/tooltip'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DoubleCheckIcon,
  DropdownIcon,
  ExpandCollapsedIcon,
  PauseFillIcon,
  RemoveIcon,
  RemoveSquareIcon,
  ResumeFillIcon,
} from '../icons'

// ====================================================== //
// Styles                                                 //
// ====================================================== //

const Styles = {
  FileExtention:
    'font-bold text-[0.55rem] dark:text-black dark:bg-white/40 bg-black text-white w-full max-w-max  flex items-center justify-center uppercase h-4 py-1 px-2 rounded-md group-data-[state=aborted]:dark:opacity-20',
  DropArea:
    'group z-50 w-full aspect-video  border border-border/20 bg-inherit shadow-none rounded-lg p-4 grid place-items-center',
  Trigger:
    'rounded-md bg-inherit p-1.5 font-stashly text-xs focus:outline-background hover:cursor-pointer border border-border hover:bg-muted flex items-center justify-center',
  FileList: 'w-full space-y-2',
  Item: 'relative overflow-hidden grid grid-cols-8 w-full rounded-lg bg-background p-1 list-none  h-auto place-content-between place-items-center gap-2 group',
  ItemBody: 'col-span-6 w-full',
  ItemContent: 'flex w-full justify-between',
  Progress:
    'group-data-[state=aborted]:opacity-50 group-data-[state=uploading]:hover:cursor-default',
  FileIcon:
    'flex appearance-none items-center justify-center bg-transparent [&_svg]:size-8 group-data-[state=aborted]:opacity-50',
  FileName:
    'overflow-hidden text-ellipsis text-nowrap text-start font-stashly text-xs font-bold text-foreground group-data-[state=aborted]:opacity-50',
  Total:
    'w-56 overflow-hidden text-ellipsis text-nowrap text-start font-stashly text-xs font-bold dark:text-white group-data-[state=aborted]:dark:opacity-20',
  CountDown:
    'text-start font-stashly text-xs group-data-[state=aborted]:hidden text-nowrap',
  StatusText: (status: Status) =>
    `text-start font-stashly text-xs group-data-[state=aborted]:block! group-data-[state=uploading]:hidden! text-nowrap capitalize`,
  Description:
    'font-stashly text-xs text-muted-foreground group-data-[state=aborted]:opacity-20',
  Cancel:
    'appearance-none bg-inherit fill-foreground disabled:cursor-default group-data-[status=done]:hidden group-hover:fill-foreground',
} as const

// ====================================================== //
// Helpers                                                //
// ====================================================== //

const formatCountdown = (value: any) => {
  let parsedProgress = uploadProgress.parse(value)
  let parsedtimeLeft = parsedProgress.timeLeft
  let countdownString = ''
  if (parsedtimeLeft.hours > 0) countdownString += `${parsedtimeLeft.hours} hr`
  if (parsedtimeLeft.minutes > 0)
    countdownString += `${parsedtimeLeft.minutes} min`
  if (parsedtimeLeft.seconds > 0 && parsedtimeLeft.minutes === 0)
    countdownString += `${parsedtimeLeft.seconds} sec`
  if (countdownString) countdownString += ' left...'
  return `${countdownString}`
}

// ====================================================== //
// Components                                             //
// ====================================================== //

export const Upload = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { user: User }
>(({ className, user, children, ...props }, forwardRef) => {
  const { configure } = useUpload()
  React.useEffect(() => {
    configure({ user })
  }, [])
  return (
    <div ref={forwardRef} className={cn(className)} {...props}>
      {children}
    </div>
  )
})
Upload.displayName = 'Upload'

export const DropArea = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { folderId?: string }
>(
  (
    {
      id,
      children,
      className,
      folderId,
      onDrop,
      onDragOver,
      onDragLeave,
      onDragEnter,
      ...props
    },
    forwardRef
  ) => {
    id = id || React.useId()
    const { dragHandlers, makeDropHandler } = useUpload()
    const targetedOnDrop = folderId
      ? makeDropHandler(folderId)
      : dragHandlers.onDrop

    const _onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
      for (const child of event.currentTarget.children) {
        child.classList.add('pointer-events-none')
      }
      event.currentTarget.classList.remove('bg-inherit')
      event.currentTarget.classList.add('bg-sidebar')
    }

    const _onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
      event.currentTarget.classList.remove('bg-sidebar')
      event.currentTarget.classList.add('bg-inherit')
      for (const child of event.currentTarget.children) {
        child.classList.remove('pointer-events-none')
      }
    }

    const _onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.currentTarget.classList.remove('bg-inherit')
      event.currentTarget.classList.add('bg-sidebar')
    }

    const _onDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.currentTarget.classList.remove('bg-sidebar')
      event.currentTarget.classList.add('bg-inherit')
      for (const child of event.currentTarget.children) {
        child.classList.remove('pointer-events-none')
      }
    }

    return (
      <div
        id={id}
        ref={forwardRef}
        className={cn(Styles.DropArea, className)}
        onDragEnter={callAll(
          dragHandlers.onDragEnter,
          _onDragEnter,
          onDragEnter
        )}
        onDragLeave={callAll(
          dragHandlers.onDragLeave,
          _onDragLeave,
          onDragLeave
        )}
        onDragOver={callAll(dragHandlers.onDragOver, _onDragOver, onDragOver)}
        onDrop={callAll(targetedOnDrop, _onDrop, onDrop)}
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
  folderId?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined
}

export const Trigger = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  TriggerProps
>(
  (
    {
      children,
      id,
      className,
      webkitdirectory,
      folderId,
      name = 'files',
      onChange,
      ...props
    },
    forwardRef
  ) => {
    id = id || React.useId()
    const { add, addBatch } = useUpload()

    const _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      if (!input.files || input.files.length === 0) return
      const files = Array.from(input.files)
      input.value = ''
      // Batch multi-file/folder selections: one quota check up front, then each
      // file starts immediately (skipQuotaCheck). Looping per-file `add` runs a
      // separate quota gate per file, which left them stuck "Pending" until the
      // whole selection had been added. Mirrors the drag-drop path.
      if (files.length === 1) {
        void add(files[0], folderId)
      } else {
        void addBatch(files, folderId)
      }
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
>(({ children, className, id, ...props }, forwardRef) => {
  id = id || React.useId()
  const [parent] = useAutoAnimate<HTMLUListElement>()
  const refs = useComposedRefs(forwardRef, parent)
  // Ids only — subscribing to the file objects re-rendered every row on every
  // progress tick, which is what tripped React's update-depth limit at 20+ files.
  const fileIds = useUploadFileIds()

  return (
    <ScrollArea className={cn('h-40 w-full rounded-lg')}>
      <div className="p-1.5">
        <AnimatePresence mode="popLayout">
          <ul
            id={id}
            ref={refs}
            className={cn(Styles.FileList, className)}
            {...props}
          >
            {fileIds.map((mediaFileId) => (
              <Item
                mediaFileId={mediaFileId}
                key={mediaFileId}
                id={`media-file-${mediaFileId}`}
              />
            ))}
          </ul>
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
})
FileList.displayName = 'Items'

const Item = React.memo(React.forwardRef<
  React.ComponentRef<'li'>,
  React.ComponentPropsWithoutRef<'li'> & { mediaFileId: string }
>(({ children, className, id, mediaFileId, ...props }, forwardRef) => {
  id = id || React.useId()
  // Identity + status only. The percentage is read inside `Progress`/`CountDown`
  // so a progress tick never re-renders this row — and therefore never re-runs
  // the HoverCard anchor effect below.
  const mediafile = useUploadFileMeta(mediaFileId)
  if (!mediafile.file) return null

  return (
    <li
      id={id}
      ref={forwardRef}
      className={cn(Styles.Item, className)}
      tabIndex={0}
      data-state={mediafile.status}
      {...props}
    >
      <FileIcon file={mediafile.file} thumbnail={mediafile.thumbnail} />
      <div className={Styles.ItemBody}>
        <FileName>{mediafile.file.name}</FileName>
        <div className={Styles.ItemContent}>
          <FileSize>{formatSize('byte', 'unit', mediafile.file.size)}</FileSize>
          <CountDown mediafileId={mediaFileId} />
          <StatusText status={mediafile.status!} mediaFileId={mediaFileId}>
            {mediafile.status}
          </StatusText>
        </div>
      </div>
      {mediafile.status === 'uploading' || mediafile.status === 'paused' ? (
        <HoverCard openDelay={50} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Progress
              mediafileId={mediaFileId}
              className="relative hover:**:data-[slot='double-check']:hidden"
            >
              <DoubleCheckIcon
                data-slot="double-check"
                className="size-14 group-data-[state=done]:block group-data-[state=uploading]:hidden group-data-[state=aborted]:hidden group-data-[state=paused]:hidden"
              />
              <Dismiss mediaFileId={mediaFileId} />
            </Progress>
          </HoverCardTrigger>
          <HoverCardContent
            side="left"
            align="center"
            sideOffset={-4}
            className="w-auto p-2 flex items-center gap-2 border-none rounded-md bg-background shadow-none"
          >
            <PauseResume mediaFileId={mediaFileId} />
            <Cancel mediaFileId={mediaFileId} />
          </HoverCardContent>
        </HoverCard>
      ) : (
        <Progress
          mediafileId={mediaFileId}
          className="relative hover:[&_[data-slot='double-check']]:hidden"
        >
          <DoubleCheckIcon
            data-slot="double-check"
            className="size-14 group-data-[state=done]:block group-data-[state=uploading]:hidden group-data-[state=aborted]:hidden group-data-[state=paused]:hidden"
          />
          <Dismiss mediaFileId={mediaFileId} />
        </Progress>
      )}
    </li>
  )
}))
Item.displayName = 'Item'

const Progress = React.forwardRef<
  React.ComponentRef<'svg'>,
  React.ComponentPropsWithoutRef<typeof CircleProgressBar.Root> & {
    mediafileId: string
  }
>(({ id, children, mediafileId, className, ...props }, forwardRef) => {
  id = id || React.useId()
  const progress = useUploadProgress(mediafileId)
  const status = useUploadStatus(mediafileId) // subscribe to status changes so we can re-render and show/hide controls

  return (
    <CircleProgressBar.Root
      ref={forwardRef}
      className={cn(Styles.Progress, className)}
      {...props}
    >
      <CircleProgressBar.Circle />
      <CircleProgressBar.Indicator
        progress={progress?.percentage}
        strokeLinejoin="round"
      />
      <CircleProgressBar.Value
        width={70}
        height={70}
        x="12.5"
        y="12.5"
        className="flex-col content-center justify-items-center text-lg"
      >
        {children}
        <p className="text-2xl! text-center font-stashly hidden group-data-[state=uploading]:block! group-data-[state=paused]:block group-data-[state=aborted]:hidden">
          {`${progress?.percentage}%`}
        </p>
      </CircleProgressBar.Value>
    </CircleProgressBar.Root>
  )
})
Progress.displayName = 'Progress'

const FileIcon = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { file: File; thumbnail?: string }
>(({ children, className, id, file, thumbnail, ...props }, forwardRef) => {
  id = id || React.useId()
  const category = toCategory(file)
  const Icon = toIcon(category)

  return (
    <div
      id={id}
      ref={forwardRef}
      className={cn(Styles.FileIcon, className)}
      {...props}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="size-8 rounded-sm object-cover"
        />
      ) : (
        <Icon />
      )}
    </div>
  )
})
FileIcon.displayName = 'FileIcon'

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
  const { total } = useUploadCounts()

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
  React.ComponentPropsWithoutRef<'h1'> & { mediafileId: string }
>(({ className, children, mediafileId, ...props }, ref) => {
  const progress = useUploadProgress(mediafileId)

  return (
    <h1 ref={ref} className={cn(Styles.CountDown, className)} {...props}>
      {formatCountdown(progress)}
    </h1>
  )
})
CountDown.displayName = 'CountDown'

export const StatusText = React.forwardRef<
  React.ComponentRef<'h1'>,
  React.ComponentPropsWithoutRef<'h1'> & {
    status: MediaFileStatus
    mediaFileId: string
  }
>(({ className, children, mediaFileId, ...props }, ref) => {
  const status = useUploadStatus(mediaFileId)

  return (
    <h1
      ref={ref}
      className={cn(Styles.StatusText(status!), className)}
      {...props}
    >
      {children}
    </h1>
  )
})
StatusText.displayName = 'StatusText'

export const Description = React.forwardRef<
  React.ComponentRef<'p'>,
  React.ComponentPropsWithoutRef<'p'>
>(({ className, children, ...props }, forwardRef) => (
  <p ref={forwardRef} className={cn(Styles.Description, className)} {...props}>
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
  React.ComponentPropsWithoutRef<'button'> & { mediaFileId: string }
>(({ className, children, onClick, mediaFileId, ...props }, forwardRef) => {
  const status = useUploadStatus(mediaFileId)
  const { cancel } = useUpload()

  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            hidden={status === 'done'}
            disabled={status === 'aborted' || status === 'done'}
            ref={forwardRef}
            onClick={callAll(() => cancel(mediaFileId), onClick)}
            className={cn(
              Styles.Cancel,
              'hover:cursor-pointer bg-sidebar border-input rounded-md',
              className
            )}
            {...props}
          >
            <RemoveIcon className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancel</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
})
Cancel.displayName = 'CancelButton'

const Dismiss = React.forwardRef<
  React.ComponentRef<'button'>,
  React.ComponentPropsWithoutRef<'button'> & { mediaFileId: string }
>(({ className, onClick, mediaFileId, ...props }, forwardRef) => {
  const status = useUploadStatus(mediaFileId)
  const { dismiss } = useUpload()

  if (status !== 'done' && status !== 'aborted') return null

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      ref={forwardRef}
      onClick={callAll(() => dismiss(mediaFileId), onClick)}
      className={cn(
        'hover:cursor-pointer hidden group-hover/progress:flex items-center justify-center hover:bg-accent/30! hover:text-foreground size-12 group-data-[state=aborted]:flex',
        className
      )}
      {...props}
    >
      <RemoveIcon className="text-current" />
    </Button>
  )
})
Dismiss.displayName = 'DismissButton'

const PauseResume = React.forwardRef<
  React.ComponentRef<'button'>,
  React.ComponentPropsWithoutRef<'button'> & { mediaFileId: string }
>(({ className, mediaFileId, onClick, ...props }, forwardRef) => {
  const status = useUploadStatus(mediaFileId)
  const { pause, resume } = useUpload()
  const isPaused = status === 'paused'
  const isUploading = status === 'uploading'

  if (!isPaused && !isUploading) return null

  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            ref={forwardRef}
            onClick={callAll(
              () => (isPaused ? resume(mediaFileId) : pause(mediaFileId)),
              onClick
            )}
            className={cn(
              'hover:cursor-pointer flex bg-sidebar border-input rounded-md!',
              className
            )}
            {...props}
          >
            {isPaused ? (
              <ResumeFillIcon className="size-3!" />
            ) : (
              <PauseFillIcon className="size-3!" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
})
PauseResume.displayName = 'PauseResumeButton'

export function EmptyOutline() {
  return (
    <Empty className="p-3">
      <EmptyHeader className="font-stashly">
        <EmptyMedia variant="default">
          <Logo className="size-16" />
        </EmptyMedia>
        <EmptyTitle>Stashly Storage</EmptyTitle>
        <EmptyDescription>Drag and Drop files here to upload.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
EmptyOutline.displayName = 'EmptyOutline'

export const UploadPanel = ({ user }: { user: User }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { isVisible, toggleView } = useUpload()
  const { uploading } = useUploadCounts()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      hidden={!isVisible}
      className="fixed bottom-8 right-8 w-md bg-sidebar rounded-md shadow-lg flex flex-col max-h-2/3 overflow-hidden z-50 border border-input!"
    >
      <Upload user={user}>
        <div className="flex justify-between items-center h-14 px-4 bg-sidebar rounded-md-tl rounded-md-tr">
          <Label className="font-stashly text-sm">
            Uploading Files ({uploading})
          </Label>
          <div className="inline-flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hover:cursor-pointer bg-sidebar border-input"
            >
              <DropdownIcon className={`${isCollapsed ? 'rotate-180' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleView}
              className="hover:cursor-pointer bg-sidebar border-input"
            >
              <RemoveIcon className="text-current size-5" />
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <DropArea className="h-auto p-0" data-testid="upload-drop-area">
                <FileList className="px-2 pt-2 h-full" />
              </DropArea>
            </motion.div>
          )}
        </AnimatePresence>
      </Upload>
    </motion.div>
  )
}
