import React, { useState } from 'react'
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
  Share,
  Edit,
  Trash2,
  Play,
  FileText,
  Download,
  ChevronDown,
  Plus,
  Filter,
} from 'lucide-react'

interface FileItem {
  id: string
  name: string
  type: 'pdf' | 'sketch' | 'mp4' | 'word' | 'video' | 'image'
  date: string
  size?: string
  duration?: string
  sharedWith?: string[]
  description?: string
  thumbnail?: string
}

interface FolderItem {
  id: string
  name: string
  fileCount: number
  icon: string
  color: string
}

const FileManagementDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('all-files')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [showPreview, setShowPreview] = useState(true)

  const folders: FolderItem[] = [
    {
      id: '1',
      name: 'Documents',
      fileCount: 24,
      icon: '📄',
      color: 'bg-blue-500',
    },
    {
      id: '2',
      name: 'Music',
      fileCount: 508,
      icon: '🎵',
      color: 'bg-purple-500',
    },
    {
      id: '3',
      name: 'Work Project',
      fileCount: 50,
      icon: '💼',
      color: 'bg-green-500',
    },
    {
      id: '4',
      name: 'Personal Media',
      fileCount: 4880,
      icon: '📸',
      color: 'bg-orange-500',
    },
    {
      id: '5',
      name: 'Reddingo Backup',
      fileCount: 19,
      icon: '💾',
      color: 'bg-red-500',
    },
    { id: '6', name: 'Root', fileCount: 97, icon: '🗂️', color: 'bg-gray-500' },
  ]

  const files: FileItem[] = [
    {
      id: '1',
      name: 'Licence Agreement on Waterfall INC.pdf',
      type: 'pdf',
      date: '20.05.2021',
      size: '2.4 MB',
      sharedWith: ['A'],
    },
    {
      id: '2',
      name: 'Drone Test Drive Tour.sketch',
      type: 'sketch',
      date: '19.05.2021',
      size: '15.2 MB',
      sharedWith: ['N', 'B', 'A'],
    },
    {
      id: '3',
      name: 'Virtual Tour Scope.mp4',
      type: 'mp4',
      date: '18.05.2021',
      size: '2.5 GB',
      duration: '01H:30M:45S',
      sharedWith: ['B', 'A'],
      description:
        'I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!',
      thumbnail:
        'https://placehold.co/400x225/374151/ffffff?text=Video+Preview',
    },
    {
      id: '4',
      name: 'Waterfall INC Introduction.docx',
      type: 'word',
      date: '12.05.2021',
      size: '1.8 MB',
      sharedWith: ['A'],
    },
    {
      id: '5',
      name: 'Zoom Redesign Kit.sketch',
      type: 'sketch',
      date: '08.05.2021',
      size: '28.4 MB',
      sharedWith: ['N', 'B', 'A'],
    },
    {
      id: '6',
      name: 'Marketing Campaign Assets.zip',
      type: 'image',
      date: '05.05.2021',
      size: '156 MB',
      sharedWith: ['B', 'A', 'N'],
    },
  ]

  React.useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[2]) // Select Virtual Tour Scope.mp4 by default
    }
  }, [])

  const getFileIcon = (type: string) => {
    const iconClasses =
      'w-8 h-8 rounded flex items-center justify-center text-white text-xs font-semibold'
    switch (type) {
      case 'pdf':
        return <div className={`${iconClasses} bg-red-500`}>PDF</div>
      case 'sketch':
        return <div className={`${iconClasses} bg-yellow-500`}>SK</div>
      case 'mp4':
        return <div className={`${iconClasses} bg-blue-500`}>MP4</div>
      case 'word':
        return <div className={`${iconClasses} bg-blue-600`}>DOC</div>
      case 'image':
        return <div className={`${iconClasses} bg-green-500`}>ZIP</div>
      default:
        return <FileText className="w-8 h-8 text-gray-400" />
    }
  }

  const getUserAvatar = (initial: string) => {
    const colors = {
      A: 'bg-purple-500',
      B: 'bg-green-500',
      N: 'bg-blue-500',
      G: 'bg-orange-500',
    }
    return (
      <div
        className={`w-6 h-6 rounded-full ${colors[initial as keyof typeof colors] || 'bg-gray-500'} flex items-center justify-center text-white text-xs font-medium`}
      >
        {initial}
      </div>
    )
  }

  const navigationItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'all-files', label: 'All Files', icon: Folder },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'photos', label: 'Photos', icon: Image },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col">
        {/* Team Selector */}
        <div className="p-4 border-b border-gray-700">
          <button className="w-full flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                N
              </div>
              <span className="font-medium">Nike Team</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-6 py-3 text-left text-sm transition-colors ${
                  activeSection === item.id
                    ? 'bg-gray-700 text-white border-r-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* File Area */}
        <div
          className={`${showPreview ? 'flex-1' : 'w-full'} flex flex-col bg-gray-850`}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-white">All Files</h1>
              <div className="flex items-center space-x-3">
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filter</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Upload</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-8">
              <button className="pb-2 border-b-2 border-blue-500 text-blue-400 font-medium">
                Folders
              </button>
              <button className="pb-2 text-gray-400 hover:text-white">
                Recent Files
              </button>
              <button className="pb-2 text-gray-400 hover:text-white">
                Shared
              </button>
              <button className="pb-2 text-gray-400 hover:text-white">
                Starred
              </button>
            </div>
          </div>

          {/* Folders Grid */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-8">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 cursor-pointer transition-colors border border-gray-700"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 ${folder.color} rounded-lg flex items-center justify-center text-white text-lg`}
                    >
                      {folder.icon}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {folder.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {folder.fileCount} files
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Files Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Recent Files</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="p-2 rounded text-gray-400 hover:bg-gray-700 hover:text-white"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Files Table */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-400 uppercase tracking-wider">
                  <div className="col-span-5">FILE</div>
                  <div className="col-span-2">SIZE</div>
                  <div className="col-span-2">DATE</div>
                  <div className="col-span-2">SHARED</div>
                  <div className="col-span-1">ACTIONS</div>
                </div>

                <div className="divide-y divide-gray-700">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={`grid grid-cols-12 gap-4 p-4 cursor-pointer transition-colors ${
                        selectedFile?.id === file.id
                          ? 'bg-gray-700'
                          : 'hover:bg-gray-750'
                      }`}
                    >
                      <div className="col-span-5 flex items-center space-x-3">
                        {getFileIcon(file.type)}
                        <div>
                          <div className="font-medium text-white">
                            {file.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {file.type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center text-sm text-gray-300">
                        {file.size}
                      </div>
                      <div className="col-span-2 flex items-center text-sm text-gray-300">
                        {file.date}
                      </div>
                      <div className="col-span-2 flex items-center">
                        <div className="flex -space-x-1">
                          {file.sharedWith
                            ?.slice(0, 3)
                            .map((initial, index) => (
                              <div key={index}>{getUserAvatar(initial)}</div>
                            ))}
                          {file.sharedWith && file.sharedWith.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-medium">
                              +{file.sharedWith.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-1 flex items-center space-x-1">
                        <button className="p-1 hover:bg-gray-600 rounded">
                          <Star className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-600 rounded">
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* File Preview Panel */}
        {showPreview && selectedFile && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* Preview Header */}
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">File Preview</h3>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-6 space-y-6">
              {/* Video Preview */}
              {selectedFile.type === 'mp4' && (
                <div className="relative">
                  <img
                    src={selectedFile.thumbnail}
                    alt="Video preview showing aerial view of city intersection"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg hover:bg-opacity-40 transition-opacity">
                    <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </button>
                </div>
              )}

              {/* File Details */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-white text-lg mb-2">
                    {selectedFile.name}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    {selectedFile.size && <span>{selectedFile.size}</span>}
                    {selectedFile.duration && (
                      <span>{selectedFile.duration}</span>
                    )}
                  </div>
                </div>

                {selectedFile.description && (
                  <div>
                    <h5 className="text-sm font-semibold text-white mb-2">
                      Description
                    </h5>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {selectedFile.description}
                    </p>
                  </div>
                )}

                {selectedFile.sharedWith && (
                  <div>
                    <h5 className="text-sm font-semibold text-white mb-3">
                      Shared With
                    </h5>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        {getUserAvatar('G')}
                        <span className="text-sm text-gray-300">
                          George Williamson
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getUserAvatar('N')}
                        <span className="text-sm text-gray-300">
                          Nickolaus Peterson
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getUserAvatar('A')}
                        <span className="text-sm text-gray-300">
                          Alexander Mikhailenko (You)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-700">
              <div className="grid grid-cols-3 gap-3">
                <button className="flex flex-col items-center space-y-2 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                  <Share className="w-5 h-5 text-gray-300" />
                  <span className="text-xs text-gray-300 font-medium">
                    Share
                  </span>
                </button>
                <button className="flex flex-col items-center space-y-2 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                  <Edit className="w-5 h-5 text-gray-300" />
                  <span className="text-xs text-gray-300 font-medium">
                    Edit
                  </span>
                </button>
                <button className="flex flex-col items-center space-y-2 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="text-xs text-red-400 font-medium">
                    Delete
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FileManagementDashboard
