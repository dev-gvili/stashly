import { FileData } from '@/types/file'

export const mockFileData: FileData = {
  folders: [
    { 
      id: '1', 
      name: 'Documents', 
      fileCount: 24, 
      icon: '📄', 
      color: 'bg-blue-500',
      path: '/files/documents'
    },
    { 
      id: '2', 
      name: 'Music', 
      fileCount: 508, 
      icon: '🎵', 
      color: 'bg-purple-500',
      path: '/files/music'
    },
    { 
      id: '3', 
      name: 'Work Project', 
      fileCount: 50, 
      icon: '💼', 
      color: 'bg-green-500',
      path: '/files/work'
    },
    { 
      id: '4', 
      name: 'Personal Media', 
      fileCount: 4880, 
      icon: '📸', 
      color: 'bg-orange-500',
      path: '/files/media'
    },
    { 
      id: '5', 
      name: 'Reddingo Backup', 
      fileCount: 19, 
      icon: '💾', 
      color: 'bg-red-500',
      path: '/files/backup'
    },
    { 
      id: '6', 
      name: 'Root', 
      fileCount: 97, 
      icon: '🗂️', 
      color: 'bg-gray-500',
      path: '/files/root'
    }
  ],
  files: [
    {
      id: '1',
      name: 'Licence Agreement on Waterfall INC.pdf',
      type: 'pdf',
      date: '20.05.2021',
      size: '2.4 MB',
      sharedWith: ['A'],
      path: '/files/documents/licence-agreement.pdf'
    },
    {
      id: '2',
      name: 'Drone Test Drive Tour.sketch',
      type: 'sketch',
      date: '19.05.2021',
      size: '15.2 MB',
      sharedWith: ['N', 'B', 'A'],
      path: '/files/work/drone-tour.sketch'
    },
    {
      id: '3',
      name: 'Virtual Tour Scope.mp4',
      type: 'mp4',
      date: '18.05.2021',
      size: '2.5 GB',
      duration: '01H:30M:45S',
      sharedWith: ['B', 'A'],
      description: 'I literally just learned that my favorite board game in the whole world (Monopoly) is based on Atlantic City!',
      thumbnail: 'https://placehold.co/400x225/374151/ffffff?text=Video+Preview',
      path: '/files/media/virtual-tour.mp4'
    },
    {
      id: '4',
      name: 'Waterfall INC Introduction.docx',
      type: 'docx',
      date: '12.05.2021',
      size: '1.8 MB',
      sharedWith: ['A'],
      path: '/files/documents/introduction.docx'
    },
    {
      id: '5',
      name: 'Zoom Redesign Kit.sketch',
      type: 'sketch',
      date: '08.05.2021',
      size: '28.4 MB',
      sharedWith: ['N', 'B', 'A'],
      path: '/files/work/zoom-kit.sketch'
    },
    {
      id: '6',
      name: 'Marketing Campaign Assets.zip',
      type: 'zip',
      date: '05.05.2021',
      size: '156 MB',
      sharedWith: ['B', 'A', 'N'],
      path: '/files/work/marketing-assets.zip'
    }
  ]
}

// Simulate API delay
export const fetchFileData = async (): Promise<FileData> => {
  await new Promise(resolve => setTimeout(resolve, 100))
  return mockFileData
}

export const fetchFileById = async (id: string): Promise<FileItem | null> => {
  await new Promise(resolve => setTimeout(resolve, 50))
  return mockFileData.files.find(file => file.id === id) || null
}
