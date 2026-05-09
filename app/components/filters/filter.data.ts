import { toIcon } from '@/utils'
import type { GlyphItem, FlagItem } from './filter.types'

export const MULTI_KEYS = ['category', 'status', 'type'] as const
export const FLAG_KEYS = ['locked', 'favorited'] as const
export const QUERY_KEY = 'query'
export const SEARCH_MODE_KEY = 'searchMode'
export const CURSOR_KEY = 'cursor'

export const CATEGORIES: GlyphItem[] = [
  { id: 'archive', label: 'Archive', glyph: 'ARC', icon: toIcon('archive') },
  { id: 'audio', label: 'Audio', glyph: 'AUD', icon: toIcon('audio') },
  { id: 'binaries', label: 'Binaries', glyph: 'BIN', icon: toIcon('binaries') },
  { id: 'code', label: 'Code', glyph: 'COD', icon: toIcon('code') },
  { id: 'document', label: 'Document', glyph: 'DOC', icon: toIcon('document') },
  { id: 'graphic', label: 'Graphic', glyph: 'GFX', icon: toIcon('graphic') },
  { id: 'image', label: 'Image', glyph: 'IMG', icon: toIcon('image') },
  { id: 'pdf', label: 'Pdf', glyph: 'PDF', icon: toIcon('pdf') },
  { id: 'presentation', label: 'Presentation', glyph: 'PPT', icon: toIcon('presentation') },
  { id: 'script', label: 'Script', glyph: 'SCR', icon: toIcon('script') },
  { id: 'spreadsheet', label: 'Spreadsheet', glyph: 'XLS', icon: toIcon('spreadsheet') },
  { id: 'video', label: 'Video', glyph: 'VID', icon: toIcon('video') },
  { id: 'unknown', label: 'Unknown', glyph: 'UNK', icon: toIcon('unknown') },
]

export const STATUSES: GlyphItem[] = [
  { id: 'archived', label: 'Archived', glyph: 'ARC', icon: toIcon('archived') },
  { id: 'locked', label: 'Locked', glyph: 'LCK', icon: toIcon('locked') },
  { id: 'shared', label: 'Shared', glyph: 'SHR', icon: toIcon('shared') },
  { id: 'trashed', label: 'Trashed', glyph: 'TRH', icon: toIcon('trashed') },
]

export const TYPES: GlyphItem[] = [
  { id: 'collection', label: 'Collection', glyph: 'COL', icon: toIcon('collection') },
  { id: 'file', label: 'File', glyph: 'FIL', icon: toIcon('file') },
  { id: 'folder', label: 'Folder', glyph: 'FLD', icon: toIcon('folder') },
]

export const FLAGS: FlagItem[] = [
  { id: 'locked', label: 'Locked' },
  { id: 'favorited', label: 'Favorited' },
]
