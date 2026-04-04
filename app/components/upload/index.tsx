import { CircleProgressBar } from '@/components/circle-progress-bar'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { uploadProgress } from '@/schemas/machine.schemas'
import type {
  Config,
  MediaFile,
  MediaFileStatus,
  Status,
  User,
} from '@/types/machine.types'
import { uploadMachine } from '@/machines/upload/upload.machine'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Logo } from '../logo'
import { toCategory, toIcon, toMediaFile } from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { callAll } from '@/utils/misc'
import { cn } from '@/utils/styles'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useComposedRefs } from '@radix-ui/react-compose-refs'
import { shallowEqual, useSelector } from '@xstate/react'
import { Label as LabelPrimitive, VisuallyHidden } from 'radix-ui'
import React, { useState } from 'react'
import { createActor } from 'xstate'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { RiExpandUpDownLine } from '@remixicon/react'
import {
  CheckSqureIcon,
  DoubleCheckIcon,
  PauseIcon,
  PauseV2Icon,
  RemoveIcon,
  RemoveSquareIcon,
  ResumeIcon,
  SuccessIcon,
} from '../icons'
// ====================================================== //
// Actor                                                  //
// ====================================================== //
export const upload = createActor(uploadMachine, {
  id: 'uploadManager',
})
upload.start()

const updateConfig = (config: Config) => {
  upload.send({
    type: 'upload.config',
    config,
  })
}

const addFile = (file: File, rootId: string, skipQuotaCheck?: boolean) => {
  upload.send({
    type: 'upload.add',
    mediaFile: toMediaFile(file, rootId),
    skipQuotaCheck,
  })
}

// Reads all entries from a directory (readEntries returns ≤100 at a time).
async function readAllEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []
  let batch: FileSystemEntry[]
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    )
    entries.push(...batch)
  } while (batch.length > 0)
  return entries
}

// Recursively collects all File objects under a FileSystemEntry.
async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve, reject) =>
      (entry as FileSystemFileEntry).file((f) => resolve([f]), reject)
    )
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children = await readAllEntries(reader)
    const nested = await Promise.all(children.map(collectFiles))
    return nested.flat()
  }
  return []
}

// Checks whether the server quota allows uploading totalSize bytes.
async function verifyBatchQuota(totalSize: number): Promise<boolean> {
  const res = await fetch('/api/quota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-free-quota', dataSize: totalSize }),
  })
  return res.json() as Promise<boolean>
}

const cancelUpload = (mediaFileId: string) => {
  upload.send({
    type: 'upload.abort',
    mediaFileId,
  })
}

const pauseUpload = (mediaFileId: string) => {
  upload.send({ type: 'upload.pause', mediaFileId })
}

const resumeUpload = (mediaFileId: string) => {
  upload.send({ type: 'upload.resume', mediaFileId })
}

//)
// ====================================================== //
// Hooks                                                  //
// ====================================================== //

export const useUploadProgress = (mediaFileId: string) => {
  let progress = useSelector(upload, (state) => {
    return state.context.mediaFiles.get(mediaFileId)?.progress
  })
  return progress
}

export const useUploadStatus = (mediaFileId: string) => {
  let status = useSelector(upload, (state) => {
    return state.context.mediaFiles.get(mediaFileId)?.status
  })
  return status
}

export const useUploadFile = (mediaFileId: string) => {
  let mediaFile = useSelector(upload, (state) => {
    return state.context.mediaFiles.get(mediaFileId)
  })
  return mediaFile
}

export const useUploadFiles = () => {
  let mediaFiles = useSelector(upload, (state) => state.context.mediaFiles)
  return Array.from(mediaFiles.values())
}

export const useUploadConfig = () => {
  let config = useSelector(upload, (state) => state.context.config)
  const setConfig = (newConfig: Config) =>
    upload.send({ type: 'upload.config', config: newConfig })
  return { config, setConfig }
}

export const useUploadUser = () => {
  let user = useSelector(upload, (state) => state.context.config?.user)
  return user
}

export const useFileActor = (mediaFileId: string) => {
  let actor = useSelector(upload, (state) => {
    return state.context.fileActors.get(mediaFileId)
  })
  return actor
}

export const useUploadMediaFiles = () => {
  let mediaFiles = useSelector(upload, (state) => state.context.mediaFiles)
  if (mediaFiles && mediaFiles.size > 0) {
    return Array.from(mediaFiles.values())
  }
  return []
}

export const useFiles = () => {
  const files = useSelector(
    upload,
    (state) => Array.from(state.context?.mediaFiles?.values()).reverse(),
    shallowEqual
  )
  return files
}

export const useUploadingFiles = () => {
  return useSelector(upload, (state) => {
    return Array.from(state.context.mediaFiles.values()).filter(
      (f) => f.status === 'uploading'
    )
  })
}

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
  FileList: 'w-full space-y-4',
  Item: 'relative overflow-hidden grid grid-cols-8 w-full rounded-lg bg-muted p-1 list-none  border border-cursor h-auto place-content-between place-items-center gap-2 group',
  ItemBody: 'col-span-6 w-full',
  ItemContent: 'flex w-full justify-between',
  Progress:
    'group/progress group-data-[state=aborted]:opacity-40 group-data-[state=uploading]:hover:cursor-default',
  FileIcon:
    'flex appearance-none items-center justify-center bg-transparent [&_svg]:size-6 group-data-[state=aborted]:opacity-40',
  FileName:
    'overflow-hidden text-ellipsis text-nowrap text-start font-stashly text-xs font-bold text-foreground group-data-[state=aborted]:opacity-20',
  Total:
    'w-56 overflow-hidden text-ellipsis text-nowrap text-start font-stashly text-xs font-bold dark:text-white group-data-[state=aborted]:dark:opacity-20',
  CountDown:
    'text-start font-stashly text-xs group-data-[state=aborted]:hidden text-nowrap',
  StatusText: (status: Status) =>
    `text-start font-stashly text-xs group-data-[state=aborted]:block! group-data-[state=aborted]:opacity-20! group-data-[state=uploading]:hidden! text-nowrap capitalize`,
  Description:
    'font-stashly text-xs text-muted-foreground group-data-[state=aborted]:opacity-20',
  Cancel:
    'appearance-none bg-inherit fill-foreground disabled:cursor-default hidden group-data-[state=uploading]:group-hover/progress:block! group-data-[status=done]:hidden group-hover:fill-foreground',
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
  React.ComponentPropsWithoutRef<'div'> & {
    user: User
  }
>(({ className, user, children, ...props }, forwardRef) => {
  React.useEffect(() => {
    updateConfig({ user })
  }, [])
  return (
    <div ref={forwardRef} className={cn(className)} {...props}>
      {children}
    </div>
  )
})
Upload.displayName = 'Upload'

// export const UploadRoot = ({
// 	children,
// 	user,
// }: {
// 	children: React.ReactNode
// 	user: User
// }) => {
// 	React.useEffect(() => {
// 		upload.send({
// 			type: 'upload.config',
// 			config: {
// 				user: {
// 					...user,
// 					storagePlanId: 'cmd9wntnk0002twfgmr9zrajo',
// 					subscriptionId: '',
// 					driveId: 'drv_66A1ohEISyV5OA3sbek4_A',
// 				},
// 			},
// 		})
// 	}, [])
// 	return <>{children}</>
// }
// UploadRoot.displayName = 'UploadRoot'

export const DropArea = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(
  (
    {
      id,
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
    id = id || React.useId()
    let { config } = useSelector(upload, (state) => {
      return { config: state.context.config }
    })
    const _onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.classList.remove('bg-inherit')
      event.currentTarget.classList.add('bg-sidebar')
    }

    const _onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      for (const child of event.currentTarget.children) {
        child.classList.add('pointer-events-none')
      }
      event.currentTarget.classList.remove('bg-inherit')
      event.currentTarget.classList.add('bg-sidebar')
    }

    const _onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.classList.remove('bg-sidebar')
      event.currentTarget.classList.add('bg-inherit')
      for (const child of event.currentTarget.children) {
        child.classList.remove('pointer-events-none')
      }
    }

    const _onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.classList.remove('bg-sidebar')
      event.currentTarget.classList.add('bg-inherit')

      for (const child of event.currentTarget.children) {
        child.classList.remove('pointer-events-none')
      }

      // Collect all dropped files — folders are resolved recursively before
      // adding anything so we can do a single quota check for the whole batch.
      const allFiles: File[] = []
      let hasFolderDrop = false

      for (const item of event.dataTransfer.items) {
        const entry = item.webkitGetAsEntry()
        if (entry) {
          if (entry.isDirectory) hasFolderDrop = true
          const files = await collectFiles(entry)
          allFiles.push(...files)
        } else {
          const file = item.getAsFile()
          if (file) allFiles.push(file)
        }
      }

      if (allFiles.length === 0) return

      // For folder drops (or batches larger than 1 file) do ONE quota check
      // for the total batch size instead of N per-file requests.
      if (hasFolderDrop && allFiles.length > 1) {
        const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)
        const allowed = await verifyBatchQuota(totalSize)
        if (!allowed) {
          // TODO: surface a quota-exceeded toast/notification
          return
        }
        for (const file of allFiles) {
          addFile(file, config.user?.rootId, true)
        }
      } else {
        for (const file of allFiles) {
          addFile(file, config.user?.rootId)
        }
      }
    }

    return (
      <div
        id={id}
        ref={forwardRef}
        className={cn(Styles.DropArea, className)}
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
      id,
      className,
      webkitdirectory,
      name = 'files',
      onChange,
      ...props
    },
    forwardRef
  ) => {
    id = id || React.useId()
    let { config } = useSelector(upload, (state) => {
      return { config: state.context.config }
    })
    const _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return
      for (const file of event.target.files) {
        addFile(file, config.user?.rootId)
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
>(({ children, className, id, ...props }, forwardRef) => {
  id = id || React.useId()
  let [parent] = useAutoAnimate<HTMLUListElement>()
  let refs = useComposedRefs(forwardRef, parent)
  const files = useFiles()
  return (
    <ScrollArea className={cn('h-40 w-full rounded-lg')}>
      <div className="p-2 space-y-3">
        <AnimatePresence mode="popLayout">
          <ul
            id={id}
            ref={refs}
            className={cn(Styles.FileList, className)}
            {...props}
          >
            {files.map((mediaFile) => {
              return (
                <Item
                  mediaFileId={mediaFile.id}
                  key={mediaFile.id}
                  id={`media-file-${mediaFile.id}`}
                />
              )
            })}
          </ul>
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
})
FileList.displayName = 'Items'

const Item = React.forwardRef<
  React.ComponentRef<'li'>,
  React.ComponentPropsWithoutRef<'li'> & { mediaFileId: string }
>(({ children, className, id, mediaFileId, ...props }, forwardRef) => {
  id = id || React.useId()
  let mediafile = useSelector(upload, (state) => {
    return state.context.mediaFiles.get(mediaFileId)
  })
  return (
    <li
      id={id}
      ref={forwardRef}
      className={cn(Styles.Item, className)}
      tabIndex={0}
      data-state={mediafile?.status}
      data-value={mediafile?.progress.percentage}
      {...props}
    >
      <FileIcon file={mediafile!.file} />
      <div className={Styles.ItemBody}>
        <FileName>{mediafile!.file.name}</FileName>
        <div className={Styles.ItemContent}>
          <FileSize>
            {formatSize('byte', 'unit', mediafile!.file.size)}
          </FileSize>
          <CountDown mediafileId={mediaFileId} />
          <StatusText status={mediafile!.status} mediaFileId={mediaFileId}>
            {mediafile!.status}
          </StatusText>
        </div>
      </div>
      <Progress mediafileId={mediaFileId}>
        <DoubleCheckIcon className="hidden group-data-[state=done]:block! size-12" />
        <Cancel mediaFileId={mediaFileId!} />
        <PauseResume mediaFileId={mediaFileId!} />
      </Progress>
    </li>
  )
})
Item.displayName = 'Item'

const Progress = React.forwardRef<
  React.ComponentRef<'svg'>,
  React.ComponentPropsWithoutRef<typeof CircleProgressBar.Root> & {
    mediafileId: string
  }
>(({ id, children, mediafileId, className, ...props }, forwardRef) => {
  id = id || React.useId()
  let progress = useUploadProgress(mediafileId)
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
        width={60}
        height={60}
        x="22.5"
        y="22.5"
        className="flex-col content-center justify-items-center w-14 h-14"
      >
        {children}
        <p className="text-xl text-center font-stashly hidden group-data-[state=uploading]:block! group-data-[state=paused]:block!">
          {`${progress?.percentage}%`}
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
  let total = useSelector(upload, (state) => state.context.mediaFiles.size)
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
  // let progress = useSelector(upload, (state) => {
  //   return state.context.mediaFiles.get(mediafileId)?.progress;
  // });
  let progress = useUploadProgress(mediafileId)
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
CountDown.displayName = 'CountDown'

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
  let status = useUploadStatus(mediaFileId)
  const _onClick = () => cancelUpload(mediaFileId)
  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            hidden={status === 'done'}
            disabled={status === 'aborted' || status === 'done'}
            ref={forwardRef}
            onClick={callAll(_onClick, onClick)}
            className={cn(
              Styles.Cancel,
              'hover:cursor-pointer w-8 h-8',
              className
            )}
            {...props}
          >
            <RemoveSquareIcon className="size-8" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancel</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
})
Cancel.displayName = 'CancelButton'

const PauseResume = React.forwardRef<
  React.ComponentRef<'button'>,
  React.ComponentPropsWithoutRef<'button'> & { mediaFileId: string }
>(({ className, mediaFileId, onClick, ...props }, forwardRef) => {
  let status = useSelector(upload, (state) => {
    return state.context.mediaFiles.get(mediaFileId)?.status
  })
  const isPaused = status === 'paused'
  const isUploading = status === 'uploading'

  if (!isPaused && !isUploading) return null

  const _onClick = () =>
    isPaused ? resumeUpload(mediaFileId) : pauseUpload(mediaFileId)

  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            ref={forwardRef}
            onClick={callAll(_onClick, onClick)}
            className={cn(
              'hover:cursor-pointer hidden group-hover/progress:block',
              className
            )}
            {...props}
          >
            {isPaused ? (
              <ResumeIcon className="size-6" />
            ) : (
              <PauseV2Icon className="size-6" />
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
    <Empty className="p-3 -mt-12!">
      <EmptyHeader className="font-stashly">
        <EmptyMedia variant="icon">
          <Logo className="size-16" />
        </EmptyMedia>
        <EmptyTitle>Stashly Storage</EmptyTitle>
        <EmptyDescription>Drag and Drop files here to upload.</EmptyDescription>
        {/* <Button size="sm" asChild>
          <Trigger className="font-stashly capitalize">Select Files</Trigger>
        </Button> */}
      </EmptyHeader>
    </Empty>
  )
}
EmptyOutline.displayName = 'EmptyOutline'

export const UploadPanel = ({ user }: { user: User }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [closed, setIsClosed] = useState(false)
  const uploadingFiles = useSelector(upload, (state) => {
    return Array.from(state.context.mediaFiles.values()).filter(
      (f) => f.status === 'uploading'
    )
  })
  const onClose = () => setIsClosed(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      hidden={closed}
      className="fixed bottom-8 right-8 w-md bg-sidebar border border-card rounded shadow-lg z-50 flex flex-col max-h-2/3 overflow-hidden p-0"
    >
      <Upload user={user}>
        <div className="flex justify-between items-center h-12 *:px-4 bg-muted rounded-tl rounded-tr border-b border-card">
          <Label className="font-stashly text-sm">
            Uploading Files ({uploadingFiles.length})
          </Label>
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <RiExpandUpDownLine className="size-4" />
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
              <DropArea className="border-none h-auto p-0">
                {uploadingFiles.length === 0 && <EmptyOutline />}
                <FileList className="px-2 pt-2 h-full" />
              </DropArea>
            </motion.div>
          )}
        </AnimatePresence>
      </Upload>
    </motion.div>
  )
}
