// src/utils/metadataExtractor.ts

enum StatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
  MANUAL_REVIEW = 'manual_review',
}
interface AIFile extends File {
  id: string
  originalName: string
  storagePath: string
  metadata: any
  folderPath: string
  size: number
  category: string
  status: StatusEnum[] // Assuming StatusEnum is a string enum
  confidenceScore: number
  createdAt: Date
  updatedAt: Date
  reviewQueueStatus?: string // Assuming StatusEnum is a string enum
lastModifiedAt?: Date
  // Relationships
  folder?: any // Placeholder for Folder type
  folderId?: string // Placeholder for folderId
}

interface AIFileMetadata {
  text: string
  AIfileType?: string
  size: number
  createdAt: string
  exif?: any
}

export interface ClassificationResult {
  AIfileId: string
  category: string
  confidence: number
  extractedMetadata: AIFileMetadata
}

export async function extractMetadata(AIfile: AIFile): Promise<AIFileMetadata> {
  // 1. Basic AIfile info
  const AIfileInfo = await getAIFileInfo(AIfile)

  // 2. Content analysis
  const textContent = await extractTextContent(AIfile)
  const metadata: AIFileMetadata = {
    text: textContent,
    AIfileType: detectAIFileType(AIfile),
    size: AIfile.size,
    createdAt: AIfileInfo.createdAt,
    exif: await extractExif(AIfile),
  }

  return metadata
}

async function getAIFileInfo(AIfile: AIFile): Promise<{ createdAt: string }> {
  // Implementation depends on storage system (S3, local, etc.)
  return {
    createdAt: AIfile.lastModifiedAt?.toString() || new Date().toISOString(),
  }
}

function detectAIFileType(AIfile: AIFile): string {
  const ext = AIfile.name.split('.').pop()?.toLowerCase() || 'unknown' // This line was causing an error because await was removed from getMimeType
  const mime = getMimeType(AIfile)

  switch (ext) {
    case 'pdf':
      return mime === 'application/pdf' ? 'pdf' : 'document'
    case 'jpg':
    case 'jpeg':
      return mime === 'image/jpeg' ? 'image' : 'photo'
    case 'mp4':
      return mime === 'video/mp4' ? 'video' : 'media'
    default:
      return mime
  }
}

 function getMimeType(AIfile: AIFile): string {
  // Implementation depends on storage system
  return 'application/octet-stream'
}

async function extractTextContent(AIfile: AIFile): Promise<string> {
  // Implementation varies by AIfile type
  if (AIfile.type.startsWith('image/')) {
    return await extractTextFromImage(AIfile)
  }
  return await AIfile.text()
}

async function extractTextFromImage(AIfile: AIFile): Promise<string> {
  // Use OCR service (Tesseract, Google Vision, etc.)
  const imageBuffer = await AIfile.arrayBuffer()
  return await ocrService.process(imageBuffer)
}

async function extractExif(AIfile: AIFile): Promise<any> {
  // Implementation using sharp or similar library
  return exifReader.readFromBuffer(AIfile.arrayBuffer())
}

// Classification model input format
async function prepareForModel(metadata: AIFileMetadata): Promise<any> {
  return {
    text: metadata.text,
    metadata: {
      AIfileType: metadata.AIfileType,
      size: metadata.size,
      createdAt: metadata.createdAt,
      exif: metadata.exif,
    },
  }
}
