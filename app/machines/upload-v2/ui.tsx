/**
 * Upload V2 Components
 *
 * UI components adapted to work with the V2 queue-based upload architecture
 * Uses uploadManagerMachine, uploadQueueMachine, and uploadWorkerMachine
 */

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
import { uploadManagerMachineV2 } from './upload-manager.machine'
// import { uploadQueueMachineV2 } from './upload-queue.machine'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Logo } from '@/components/logo'
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
} from '@/ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { RiExpandUpDownLine } from '@remixicon/react'
import { RemoveIcon, SuccessIcon } from '@/components/icons'
import { uploadWorkerMachine } from './upload-worker.machine'
import { uploadQueueMachineV2 } from './upload-queue.machine'
import { quotaMachine } from '../quota/quota.machine'
import {createBrowserInspector} from "@statelyai/inspect"

let ispector = createBrowserInspector()

// ====================================================== //
// Actors - V2 Architecture
// ====================================================== //

/**
 * V2 Upload System:
 *
 * uploadManager: Top-level orchestration
 * quotaValidator: Validates file sizes against user quota
 * uploadWorker: Handles individual file multipart uploads
 * queue: Manages pending → validating → active → completed flow
 *
 * Note: In V2, we don't create per-file actors like V1.
 * Instead, files are managed by the queue machine as items.
 */

// Create quota validator actor first
const quotaValidator = createActor(quotaMachine, {
  id: 'quotaValidator',
}).start()

// Create worker actor
const uploadWorker = createActor(uploadWorkerMachine, {
  id: 'uploadWorker',
}).start()

// Create queue with validator and worker references
const queue = createActor(uploadQueueMachineV2, {
  id: 'uploadQueue',
  input: {
    maxConcurrency: 5,
    worker: uploadWorker,
  },
  inspect: ispector.inspect
}).start()

// Upload manager (optional - mainly for config management)
const uploadManager = createActor(uploadManagerMachineV2, {
  id: 'uploadManagerV2',
}).start()

const updateConfig = (config: Omit<Config, 'ui' | 'acceptedMimeTypes'>) => {
  uploadManager.send({
    type: 'upload.config',
    //@ts-ignore
    config,
  })
}

// Store file references for worker access
const fileReferences = new Map<string, File>()

/**
 * V2: Add file to queue instead of directly to upload machine
 * File will go through validation before upload
 */
const addFile = (file: File, rootId: string) => {
  const mediaFile = toMediaFile(file, rootId)
  fileReferences.set(mediaFile.id, file)
  // File references updated
  queue.send({
    type: '@queue.add',
    item: mediaFile
  })

  // Store file reference for worker to access
  // (In a real app, you'd pass this through the event or store in separate context)
}

/**
 * V2: Cancel file upload
 * File can be in pending, validating, or active state
 */
const cancelUpload = (mediaFileId: string) => {
  queue.send({
    type: '@queue.cancel',
    itemId: mediaFileId,
  })
}

// ====================================================== //
// Hooks - V2 Adapted
// ====================================================== //

/**
 * Hook to get progress for a file currently being uploaded
 * V2: Adapts to work with queue context
 */
export const useUploadProgress = (mediaFileId: string) => {
  // In V2, progress is tracked in worker or could be in separate context
  // For now, returning mock progress
  // In production, subscribe to worker progress events
  const progress = useSelector(uploadManager, (state) => {
    // Could track progress in manager context if needed
    return {
      percentage: 0,
      speed: { unit: 'KB/s', value: 0 },
      timeLeft: { hours: 0, minutes: 0, seconds: 0 },
    }
  })
  return progress
}

/**
 * V2: Get status of file based on queue state
 */
export const useUploadStatus = (mediaFileId: string): MediaFileStatus => {
  return useSelector(queue, (state) => {
    // Check which set the file is in and return appropriate status
    if (state.context.pending.has(mediaFileId)) return 'pending'
    if (state.context.validating.has(mediaFileId)) return 'uploading' // treating as uploading during validation
    if (state.context.active.has(mediaFileId)) return 'uploading'
    if (state.context.completed.has(mediaFileId)) return 'done'
    if (state.context.failed.has(mediaFileId)) return 'aborted'
    return 'pending'
  })
}

/**
 * V2: Get file object
 * Returns a constructed file object from stored references
 */
export const useUploadFile = (mediaFileId: string) => {
  return useSelector(queue, (state) => {
    const item = state.context.items.get(mediaFileId)
    const file = fileReferences.get(mediaFileId)

    if (!item || !file) return undefined

    return {
      id: mediaFileId,
      file,
      status: getFileStatus(state, mediaFileId),
      progress: { percentage: 0 },
      key: `${file.name}-${mediaFileId}`,
    } as unknown as MediaFile
  })
}

/**
 * Helper to determine file status from queue context
 */
const getFileStatus = (state: any, mediaFileId: string): MediaFileStatus => {
  if (state.context.pending.has(mediaFileId)) return 'pending'
  if (state.context.validating.has(mediaFileId)) return 'uploading'
  if (state.context.active.has(mediaFileId)) return 'uploading'
  if (state.context.completed.has(mediaFileId)) return 'done'
  if (state.context.failed.has(mediaFileId)) return 'aborted'
  return 'pending'
}

/**
 * V2: Get all files from queue context
 */
export const useUploadFiles = () => {
  return useSelector(queue, (state) => {
    return Array.from(state.context.items.entries()).map(([id, item]) => {
      const file = fileReferences.get(id)
      return {
        id,
        file: file || new File([], 'unknown'),
        status: getFileStatus(state, id),
        progress: { percentage: 0 },
        key: `${id}`,
      } as unknown as MediaFile
    })
  })
}

/**
 * V2: Get config
 */
export const useUploadConfig = () => {
  const config = useSelector(uploadManager, (state) => state.context.config)
  const setConfig = (newConfig: Config) =>
    uploadManager.send({ type: 'upload.config', config: newConfig })
  return { config, setConfig }
}

/**
 * V2: Get user from manager config
 */
export const useUploadUser = () => {
  return useSelector(uploadManager, (state) => state.context.config?.user)
}

/**
 * V2: Not applicable (no per-file actors in V2)
 * Keeping for compatibility
 */
export const useFileActor = (mediaFileId: string) => {
  return undefined
}

/**
 * V2: Get all media files
 */
export const useUploadMediaFiles = () => {
  return useSelector(queue, (state) => {
    const items = Array.from(state.context.items.entries()).map(
      ([id, item]) => {
        const file = fileReferences.get(id)
        return {
          id,
          file: file || new File([], 'unknown'),
          status: getFileStatus(state, id),
          progress: { percentage: 0 },
          key: `${id}`,
        } as unknown as MediaFile
      }
    )
    return items.length > 0 ? items : []
  })
}

/**
 * V2: Get files in reverse order (newest first)
 */
export const useFiles = () => {
  return useSelector(
    queue,
    (state) => {
      const items = Array.from(state.context.items.entries())
        .map(([id, item]) => {
          const file = fileReferences.get(id)
          return {
            id,
            file: file || new File([], 'unknown'),
            status: getFileStatus(state, id),
            progress: { percentage: 0 },
            key: `${id}`,
          } as unknown as MediaFile
        })
        .reverse()
      return items
    },
    shallowEqual
  )
}

/**
 * V2: Get uploading files (active in queue)
 */
export const useUploadingFiles = () => {
  return useSelector(queue, (state) => {
    return Array.from(state.context.active).map((id) => {
      const item = state.context.items.get(id)
      const file = fileReferences.get(id)
      return {
        id,
        file: file || new File([], 'unknown'),
        status: 'uploading' as const,
        progress: { percentage: 0 },
        key: `${id}`,
      } as unknown as MediaFile
    })
  })
}

/**
 * V2: Get queue statistics
 */
export const useQueueStats = () => {
  return useSelector(queue, (state) => state.context.stats)
}

// ====================================================== //
// Styles (unchanged from V1)
// ====================================================== //

const Styles = {
  FileExtention:
    'font-bold text-[0.55rem] dark:text-black dark:bg-white/40 bg-black text-white w-full max-w-max  flex items-center justify-center uppercase h-4 py-1 px-2 rounded-md group-data-[state=aborted]:dark:opacity-20',
  DropArea:
    'group z-50 w-full aspect-video  border border-border bg-inherit shadow-none rounded-lg p-4 grid place-items-center',
  Trigger:
    'rounded-md bg-inherit p-1.5 font-stashly text-xs focus:outline-background hover:cursor-pointer border border-border hover:bg-muted flex items-center justify-center',
  FileList: 'w-full space-y-4',
  Item: 'relative overflow-hidden grid grid-cols-8 w-full rounded-lg bg-sidebar p-1 list-none  border border-border h-auto place-content-between place-items-center gap-2 group',
  ItemBody: 'col-span-6 w-full',
  ItemContent: 'flex w-full justify-between',
  Progress:
    'group/progress group-data-[state=aborted]:opacity-40 group-data-[state=uploading]:hover:cursor-default',
  FileIcon:
    'flex appearance-none items-center justify-center bg-transparent w-8 h-8 group-data-[state=aborted]:opacity-40',
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
// Helpers (mostly unchanged)
// ====================================================== //

const formatCountdown = (value: any) => {
  try {
    let parsedProgress = uploadProgress.parse(value)
    let parsedtimeLeft = parsedProgress.timeLeft
    let countdownString = ''
    if (parsedtimeLeft.hours > 0)
      countdownString += `${parsedtimeLeft.hours} hr`
    if (parsedtimeLeft.minutes > 0)
      countdownString += `${parsedtimeLeft.minutes} min`
    if (parsedtimeLeft.seconds > 0 && parsedtimeLeft.minutes === 0)
      countdownString += `less than a min`
    if (countdownString) countdownString += ' left...'
    return `${countdownString}`
  } catch {
    return ''
  }
}

// ====================================================== //
// Components (adapted for V2)
// ====================================================== //

export const Upload = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & {
    user: User
  }
>(({ className, user, children, ...props }, forwardRef) => {
  React.useEffect(() => {
    updateConfig({ user })
  }, [user])
  return (
    <div ref={forwardRef} className={cn(className)} {...props}>
      {children}
    </div>
  )
})
Upload.displayName = 'Upload'

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
    let { config } = useSelector(uploadManager, (state) => {
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

    const _onDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.classList.remove('bg-sidebar')
      event.currentTarget.classList.add('bg-inherit')
      for (const child of event.currentTarget.children) {
        child.classList.remove('pointer-events-none')
      }
      for (const item of event.dataTransfer.items) {
        const file = item.getAsFile()
        if (!file) return
        // let mediafile = toMediaFile(file, config.user?.rootId)
        // console.log({ mediafile })
        // queue.send({
        //   type: '@queue.add',
        //   item: {
        //     id: mediafile.id,
        //     size: BigInt(mediafile.file.size),
        //   }
        // })
        // fileReferences.set(mediafile.id, file)
        // console.log(Array.from(fileReferences.entries()))
        addFile(file, config.user?.rootId)
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
    let { config } = useSelector(uploadManager, (state) => {
      return { config: state.context.config }
    })

    const _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return
      for (const file of event.target.files) {
        if (!file) return
        // let item = toMediaFile(file, config.user?.rootId)
        // console.log({ item })
        // queue.send({
        //   type: '@queue.add',
        //   item: {
        //     id: item.id,
        //     size: BigInt(file.size),
        //   }
        // })
        // fileReferences.set(item.id, file)
        // console.log(Array.from(fileReferences.entries()))
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
    //@ts-ignore
    <ScrollArea type="undefined" className={cn('h-44')}>
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
FileList.displayName = 'FileList'

const Item = React.forwardRef<
  React.ComponentRef<'li'>,
  React.ComponentPropsWithoutRef<'li'> & { mediaFileId: string }
>(({ children, className, id, mediaFileId, ...props }, forwardRef) => {
  id = id || React.useId()
  let mediafile = useUploadFile(mediaFileId)

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
      {mediafile && (
        <>
          <FileIcon file={mediafile.file} />
          <div className={Styles.ItemBody}>
            <FileName>{mediafile.file.name}</FileName>
            <div className={Styles.ItemContent}>
              <FileSize>
                {formatSize('byte', 'unit', mediafile.file.size)}
              </FileSize>
              <CountDown mediafileId={mediaFileId} />
              <StatusText status={mediafile.status} mediaFileId={mediaFileId}>
                {mediafile.status}
              </StatusText>
            </div>
          </div>
          <Progress mediafileId={mediaFileId}>
            <SuccessIcon className="hidden group-data-[state=done]:block! h-8 w-8 fill-foreground" />
            <Cancel mediaFileId={mediaFileId} />
          </Progress>
        </>
      )}
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
        className="group-data-[state=aborted]:stroke-destructive"
      />
      <CircleProgressBar.Value width={34} height={34} x="30%" y="30%">
        {children}
        <p className="mt-1 w-full text-base text-center font-stashly hidden group-data-[state=uploading]:block! group-hover/progress:hidden!">
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
  let total = useSelector(queue, (state) => state.context.items.size)

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
      className={cn(Styles.StatusText(status), className)}
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
            <RemoveIcon className="size-8" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancel</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
})
Cancel.displayName = 'CancelButton'

export function EmptyOutline() {
  return (
    <Empty className="p-3 -mt-12!">
      <EmptyHeader className="font-stashly">
        <EmptyMedia variant="default">
          <Logo className="size-15" />
        </EmptyMedia>
        <EmptyTitle>Stashly Storage</EmptyTitle>
        <EmptyDescription>
          Upload files to your stash using Drag and Drop or click the button
          below to select.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
EmptyOutline.displayName = 'EmptyOutline'

export const UploadPanel = ({ user }: { user: User }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [closed, setIsClosed] = useState(false)
  const uploadingFiles = useUploadingFiles()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      hidden={closed}
      className="fixed bottom-2 right-8 w-md bg-background border border-border rounded shadow-lg z-50 flex flex-col max-h-2/3 overflow-hidden p-0"
    >
      <Upload user={user}>
        <div className="flex justify-between items-center h-12 *:px-4 bg-background">
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
              <DropArea className="border-none">
                <EmptyOutline />
                <FileList />
              </DropArea>
            </motion.div>
          )}
        </AnimatePresence>
      </Upload>
    </motion.div>
  )
}
