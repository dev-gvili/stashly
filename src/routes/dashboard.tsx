import { json, LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react'
import { useState } from 'react'
import { 
  Home, 
  Folder, 
  Video, 
  Image, 
  Clock, 
  Settings, 
  Search, 
  Star, 
  Grid3X3, 
  List, 
  MoreHorizontal,
  Filter,
  Plus,
  ChevronDown
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Toggle } from '@/components/ui/toggle'
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter, 
  SidebarNav, 
  SidebarNavItem 
} from '@/components/ui/sidebar'
import { FileIcon } from '@/components/FileIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { FilePreviewPanel } from '@/components/FilePreviewPanel'
import { fetchFileData, fetchFileById } from '@/data/files'
import { FileItem } from '@/types/file'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const selectedFileId = url.searchParams.get('file')
  
  const fileData = await fetchFileData()
  const selectedFile = selectedFileId ? await fetchFileById(selectedFileId) : null

  return json({
    fileData,
    selectedFile
  })
}

export default function Dashboard() {
  const { fileData, selectedFile } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showPreview, setShowPreview] = useState(true)
  const activeSection = searchParams.get('section') || 'all-files'

  const navigationItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'all-files', label: 'All Files', icon: Folder },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'photos', label: 'Photos', icon: Image },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const handleNavigation = (sectionId: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('section', sectionId)
      return newParams
    })
  }

  const handleFileSelect = (file: FileItem) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('file', file.id)
      return newParams
    })
  }

  const handleClosePreview = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.delete('file')
      return newParams
    })
  }

  return (
    <div className="flex h-screen bg-background text-foreground" data-theme="dark">
      {/* Sidebar */}
      <Sidebar>
        <SidebarHeader>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                N
              </div>
              <span className="font-medium">Nike Team</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav>
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <SidebarNavItem
                  key={item.id}
                  active={activeSection === item.id}
                  onClick={() => handleNavigation(item.id)}
                  className="cursor-pointer"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </SidebarNavItem>
              )
            })}
          </SidebarNav>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center space-x-3">
            <UserAvatar initial="U" className="w-8 h-8" />
            <div className="flex-1">
              <div className="text-sm font-medium">User</div>
            </div>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* File Area */}
        <div className={`${showPreview && selectedFile ? 'flex-1' : 'w-full'} flex flex-col`}>
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold">All Files</h1>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-8">
              <button className="pb-2 border-b-2 border-primary text-primary font-medium">
                Folders
              </button>
              <button className="pb-2 text-muted-foreground hover:text-foreground">
                Recent Files
              </button>
              <button className="pb-2 text-muted-foreground hover:text-foreground">
                Shared
              </button>
              <button className="pb-2 text-muted-foreground hover:text-foreground">
                Starred
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 space-y-8">
            {/* Folders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fileData.folders.map((folder) => (
                <Card key={folder.id} className="hover:bg-accent cursor-pointer transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${folder.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                        {folder.icon}
                      </div>
                      <div>
                        <div className="font-medium">{folder.name}</div>
                        <div className="text-sm text-muted-foreground">{folder.fileCount} files</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Files Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Recent Files</h3>
                <div className="flex items-center space-x-2">
                  <Toggle
                    pressed={viewMode === 'list'}
                    onPressedChange={() => setViewMode('list')}
                    size="sm"
                  >
                    <List className="w-4 h-4" />
                  </Toggle>
                  <Toggle
                    pressed={viewMode === 'grid'}
                    onPressedChange={() => setViewMode('grid')}
                    size="sm"
                  >
                    <Gri```tsx:src/routes/dashboard.tsx
// ... existing code ...
                  <Toggle
                    pressed={viewMode === 'grid'}
                    onPressedChange={() => setViewMode('grid')}
                    size="sm"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Toggle>
                </div>
              </div>

              {/* Files List */}
              <div className="space-y-2">
                {fileData.files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center space-x-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                      selectedFile?.id === file.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleFileSelect(file)}
                  >
                    <FileIcon type={file.type} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-sm text-muted-foreground">{file.date} • {file.size}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex -space-x-1">
                        {file.sharedWith.map((initial, index) => (
                          <UserAvatar key={index} initial={initial} className="w-6 h-6 border-2 border-background" />
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <Star className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* File Preview Panel */}
        {showPreview && selectedFile && (
          <FilePreviewPanel
            file={selectedFile}
            onClose={handleClosePreview}
          />
        )}
      </div>
    </div>
  )
}
