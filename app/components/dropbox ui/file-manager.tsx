'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/dropbox ui/sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { FileGrid } from '@/components/dropbox ui/file-grid'
import { FilePreview } from '@/components/dropbox ui/file-preview'
import { CommentsPanel } from '@/components/dropbox ui/comments-panel'
import { SettingsPage } from '@/components/dropbox ui/settings-page'
import { StoragePanel } from '@/components/dropbox ui/storage-panel'
import { faker } from '@faker-js/faker'

export type FolderType = {
  id: string
  name: string
  fileCount: number
}

export type FileType = {
  id: string
  name: string
  type: string
  size: string
  date: string
  sharedWith: { initial: string; name: string }[]
  description?: string
  thumbnail?: string
  duration?: string
}

export const folders: FolderType[] = [
  { id: 'f1', name: 'Documents', fileCount: 24 },
  { id: 'f2', name: 'Music', fileCount: 508 },
  { id: 'f3', name: 'Work Project', fileCount: 50 },
  { id: 'f4', name: 'Personal Media', fileCount: 4680 },
  { id: 'f5', name: 'Reddingo Backup', fileCount: 19 },
  { id: 'f6', name: 'Root', fileCount: 97 },
]

export const files: FileType[] = [
  {
    id: '1',
    name: 'Licence Agreement on Waterfall INC.pdf',
    type: 'pdf',
    size: '2.3 MB',
    date: '20.05.2021',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    description:
      'I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!',
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
  },
  {
    id: '2',
    name: 'Drone Test Drive Tour.sketch',
    type: 'sketch',
    size: '18.6 MB',
    date: '18.05.2021',
    sharedWith: [
      { initial: 'N', name: 'Nickolas Peterson' },
      { initial: 'J', name: 'John Doe' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
  },
  {
    id: '3',
    name: 'Virtual Tour Scope.mp4',
    type: 'mp4',
    size: '2.5 GB',
    date: '18.05.2021',
    sharedWith: [
      { initial: 'G', name: 'George Williamson' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    description:
      'I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/54055225af6f27b7e9e64e9a9712a364-hd5uieUi2tlxV2RQYaRwhd0DW5CsVf.png',
  },
  {
    id: '4',
    name: 'Waterfall INC Introduction.word',
    type: 'word',
    size: '5.7 MB',
    date: '12.05.2021',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
  },
  {
    id: '5',
    name: 'Zoom Redesign Kit.sketch',
    type: 'diamond',
    size: '448.4 MB',
    date: '06.05.2021',
    sharedWith: [
      { initial: 'N', name: 'Nickolas Peterson' },
      { initial: 'B', name: 'Bob Smith' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
  },
]

const videoFiles: FileType[] = [
  {
    id: 'v1',
    name: 'Miami Vlog - Going to Garage.mp4',
    type: 'mp4',
    size: '3.4 GB',
    date: '29:16',
    sharedWith: [
      { initial: 'G', name: 'George Williamson' },
      { initial: 'J', name: 'John Doe' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '29:16',
  },
  {
    id: 'v2',
    name: 'Park Overview.mp4',
    type: 'mp4',
    size: '462 MB',
    date: '04:36',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '04:36',
  },
  {
    id: 'v3',
    name: "Sandra's Party 2019.mp4",
    type: 'mp4',
    size: '569 MB',
    date: '21:05',
    sharedWith: [
      { initial: 'J', name: 'John Doe' },
      { initial: 'D', name: 'David Barnes' },
      { initial: 'S', name: 'Sandra Smith' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '21:05',
  },
  {
    id: 'v4',
    name: 'The Force Rising.mp4',
    type: 'mp4',
    size: '462 MB',
    date: '08:48',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '08:48',
  },
  {
    id: 'v5',
    name: 'Arches National Park Road Trip.mp4',
    type: 'mp4',
    size: '3.4 GB',
    date: '33:04',
    sharedWith: [
      { initial: 'O', name: 'Oliver Johnson' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '33:04',
  },
  {
    id: 'v6',
    name: 'Fantastic Turkey 2018.mp4',
    type: 'mp4',
    size: '830 MB',
    date: '15:34',
    sharedWith: [
      { initial: 'R', name: 'Rachel Green' },
      { initial: 'A', name: 'Alexander Mikoleienko (You)' },
    ],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '15:34',
  },
  {
    id: 'v7',
    name: 'City Timelapse.mp4',
    type: 'mp4',
    size: '1.2 GB',
    date: '06:48',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '06:48',
  },
  {
    id: 'v8',
    name: 'Aerial City View.mp4',
    type: 'mp4',
    size: '890 MB',
    date: '12:22',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '12:22',
  },
  {
    id: 'v9',
    name: 'Building Architecture.mp4',
    type: 'mp4',
    size: '1.5 GB',
    date: '24:05',
    sharedWith: [{ initial: 'A', name: 'Alexander Mikoleienko (You)' }],
    thumbnail: faker.image.urlPicsumPhotos({ height: 800, width: 800 }),
    duration: '24:05',
  },
]

export function FileManager() {
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [viewMode, setViewMode] = useState<'files' | 'videos' | 'settings'>(
    'videos'
  )

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar activeView={viewMode} onViewChange={setViewMode} />
        <SidebarInset>
          <div className="flex h-screen bg-background">
            {viewMode === 'settings' ? (
              <SettingsPage />
            ) : (
              <FileGrid
                folders={folders}
                files={viewMode === 'videos' ? videoFiles : files}
                onFileSelect={setSelectedFile}
                selectedFileId={selectedFile?.id || ''}
                viewMode={viewMode}
              />
            )}
          </div>
        </SidebarInset>
        {viewMode === 'settings' ? (
          <StoragePanel />
        ) : selectedFile ? (
          showComments ? (
            <CommentsPanel
              fileName={selectedFile.name}
              onShowPreview={() => setShowComments(false)}
            />
          ) : (
            <FilePreview
              file={selectedFile}
              onShowComments={() => setShowComments(true)}
            />
          )
        ) : null}
      </div>
    </SidebarProvider>
  )
}
