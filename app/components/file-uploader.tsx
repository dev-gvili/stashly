import * as React from 'react'
import { useFetcher } from 'react-router'
import {
  RiAlertLine,
  RiCheckLine,
  RiFolderLine,
  RiLoader4Line,
  RiUploadCloudLine,
  RiCloseLine,
} from '@/components/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { Button } from '@/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import { Progress } from '@/ui/progress'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/utils/styles'
import { useMachine } from '@xstate/react'

interface UploadableFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress: number
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const FileStatusIcon = ({ status }: { status: UploadableFile['status'] }) => {
  switch (status) {
    case 'uploading':
      return <RiLoader4Line className="h-5 w-5 animate-spin text-blue-500" />
    case 'success':
      return <RiCheckLine className="h-5 w-5 text-green-500" />
    case 'error':
      return <RiAlertLine className="h-5 w-5 text-red-500" />
    default:
      return <RiUploadCloudLine className="h-5 w-5 text-gray-500" />
  }
}

export function FileUploader({
  uploadAction = '/api/s3/upload',
}: {
  uploadAction?: string
}) {
  const fetcher = useFetcher<{
    results: Array<{ id: string; success: boolean; error?: string }>
    error?: string
  }>()
  const [uploadableFiles, setUploadableFiles] = React.useState<
    UploadableFile[]
  >([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [isClearAlertOpen, setIsClearAlertOpen] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)

  const pendingFiles = uploadableFiles.filter((f) => f.status === 'pending')
  const filesToUpload = uploadableFiles.filter(
    (f) => f.status === 'pending' || f.status === 'error'
  )
  const isUploading = fetcher.state === 'submitting'

  React.useEffect(() => {
    if (fetcher.state === 'submitting') {
      setUploadableFiles((prev) =>
        prev.map((f) =>
          f.status === 'pending' ? { ...f, status: 'uploading' } : f
        )
      )
    }

    if (fetcher.state === 'idle' && fetcher.data) {
      const { results, error } = fetcher.data
      if (error) {
        // Handle global error, maybe show a toast
        console.error('Upload failed:', error)
        return
      }
      setUploadableFiles((prev) =>
        prev.map((f) => {
          const result = results?.find((r) => r.id === f.id)
          if (!result) return f
          return {
            ...f,
            status: result.success ? 'success' : 'error',
            error: result.error,
          }
        })
      )
    }
  }, [fetcher.state, fetcher.data])

  const handleFilesSelected = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const newFiles = Array.from(selectedFiles).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      status: 'pending' as const,
      progress: 0,
    }))

    const formData = new FormData()

    Array.from(selectedFiles).forEach((file) => {
      formData.append('files', file, file.name)
      formData.append(
        'fileIds',
        `${file.name}-${file.size}-${file.lastModified}`
      )
    })

    await fetcher.submit(formData, {
      method: 'post',
      encType: 'multipart/form-data',
      action: uploadAction,
    })

    setUploadableFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id))
      const uniqueNewFiles = newFiles.filter((f) => !existingIds.has(f.id))
      return [...prev, ...uniqueNewFiles]
    })
  }

  const handleDragEvent = (
    e: React.DragEvent<HTMLDivElement>,
    drag: boolean
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(drag)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvent(e, false)
    handleFilesSelected(e.dataTransfer.files)
  }

  const handleRemoveFile = (id: string) => {
    setUploadableFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleClearAll = () => {
    setUploadableFiles([])
    setIsClearAlertOpen(false)
  }

  const handleUpload = () => {
    if (filesToUpload.length === 0 || isUploading) return

    const formData = new FormData()

    pendingFiles.forEach((item) => {
      formData.append('files', item.file, item.file.webkitRelativePath)
      formData.append('fileIds', item.id)
    })

    fetcher.submit(formData, {
      method: 'post',
      encType: 'multipart/form-data',
      action: uploadAction,
    })
    console.log('Submitting files:', fetcher.formData)
    console.log('Submitting files:', fetcher.data)
  }
  const handleRetry = (id: string) => {
    const fileToRetry = uploadableFiles.find((f) => f.id === id)
    if (!fileToRetry) return

    const formData = new FormData()
    formData.append('files', fileToRetry.file, fileToRetry.file.name)
    formData.append('fileIds', fileToRetry.id)

    setUploadableFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'uploading', error: undefined } : f
      )
    )

    fetcher.submit(formData, {
      method: 'post',
      encType: 'multipart/form-data',
      action: uploadAction,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Uploader</CardTitle>
        <CardDescription>
          Drag and drop files or click to select.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'relative flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 transition-colors',
            isDragging && 'border-gray-400 bg-gray-50'
          )}
          onDragEnter={(e) => handleDragEvent(e, true)}
          onDragLeave={(e) => handleDragEvent(e, false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => handleFilesSelected(e.target.files)}
            title="Select files to upload"
            placeholder="Choose files"
          />
          <RiFolderLine className="h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">
            Drag and drop files here, or click to select
          </p>
        </div>

        {uploadableFiles.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Files to Upload</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsClearAlertOpen(true)}
              >
                Clear All
              </Button>
            </div>
            <ScrollArea className="mt-2 h-48 w-full rounded-md border">
              <div className="mt-4 space-y-2">
                {uploadableFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between space-x-4 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-2">
                      <FileStatusIcon status={item.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatBytes(item.file.size)}
                          {item.error && (
                            <span className="ml-2 text-red-500">
                              - {item.error}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.status === 'error' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(item.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveFile(item.id)}
                      >
                        <RiCloseLine className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={isUploading || filesToUpload.length === 0}
              >
                {isUploading
                  ? 'Uploading...'
                  : `Upload ${filesToUpload.length} File(s)`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all files from the upload queue. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
