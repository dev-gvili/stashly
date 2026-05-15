import {
  ArchiveIcon,
  AudioIcon,
  BinaryIcon,
  CodeIcon,
  CollectionIcon,
  CollectionLineIcon,
  DocumentIcon,
  FileIcon,
  FolderIcon,
  HashTagIcon,
  ImageIcon,
  LockedIcon,
  Pdf2Icon,
  ShareIcon,
  ShellIcon,
  SlidesIcon,
  TrashIcon,
  Video2Icon,
} from '@/components/icons'
import type {
  MediaFile,
  Status,
  UploadProgress,
} from '@/types/machine.types'
import { ItemCategory, type ItemType } from '@/prisma/browser'
import crypto from 'crypto-js'
import { href } from 'react-router'
import { z } from 'zod'
import type { ItemCardProps } from '../components/stash/item-card'

/**
 * Convert an AsyncIterable of Uint8Array to buffer
 */
export async function toBuffer(data: AsyncIterable<Uint8Array>) {
  const result: Uint8Array[] = []
  for await (const chunk of data) {
    result.push(chunk)
  }
  return Buffer.concat(result)
}

/**
 * return base64 encoded string
 */
export const toBase64 = (input: string): string => {
  return crypto
    .MD5(input)
    .toString(crypto.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generates a user avatar fallback with 2 letters.
 * @param input - The input string (name, email, username, etc.)
 * @returns string - The generated initials (2 letters).
 */
export function toUserInitial(input: string): string {
  if (!input) return 'NN'

  if (input.includes('@')) {
    // If the input is an email, take the part before the `@`
    input = input.split('@')[0]
  }

  // Split the input string on `-`, `_`, `.`, and space
  const delimiters = /[-_.\s]+/
  const parts = input.split(delimiters).filter(Boolean)

  if (parts.length > 1) {
    // If the input contains more than 1 word, take the first letter of the first 2 words
    return parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
  } else {
    // If the input contains only 1 word or is an email with 1 word before `@`
    const firstWord = parts[0]
    return firstWord.slice(0, 2).toUpperCase()
  }
}

/**
 * Determines the `ItemCategory` of a file based on its MIME type and file extension.
 * It performs strong type checks first, followed by office productivity, technical types, and code fallbacks.
 * 
 * @param file - The browser File object to categorize.
 * @returns The matched `ItemCategory` or `ItemCategory.unknown` if no match is found.
 * 
 * @example
 * const file = new File([""], "resume.pdf", { type: "application/pdf" });
 * const category = toCategory(file); // returns ItemCategory.pdf
 * @example
 * const codeFile = new File(["void 0"], "app.js", { type: "text/javascript" });
 * const category = toCategory(codeFile); // returns ItemCategory.code
 */
export function toCategory(file: File): ItemCategory {
  const type = file.type.toLowerCase()
  // Extract extension safely (handle files with no extension)
  const name = file.name.toLowerCase()
  const lastDotIndex = name.lastIndexOf('.')
  const extension = lastDotIndex !== -1 ? name.substring(lastDotIndex + 1) : ''

  // --- 1. Strong Type Checks (MIME Prefix) ---

  // PDF
  if (type === 'application/pdf') return ItemCategory.pdf

  // Media
  if (type.startsWith('image/')) return ItemCategory.image
  if (type.startsWith('video/')) return ItemCategory.video
  if (type.startsWith('audio/')) return ItemCategory.audio

  // --- 2. Office & Productivity (MIME & Extension) ---

  // Word / Text Documents
  if (
    type.includes('msword') ||
    type.includes('wordprocessingml') ||
    type.includes('officedocument.text') ||
    ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'markdown'].includes(extension)
  ) {
    return ItemCategory.document
  }

  // Spreadsheets
  if (
    type.includes('excel') ||
    type.includes('spreadsheetml') ||
    type.includes('officedocument.spreadsheet') ||
    type === 'text/csv' ||
    ['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(extension)
  ) {
    return ItemCategory.spreadsheet
  }

  // Presentations
  if (
    type.includes('powerpoint') ||
    type.includes('presentationml') ||
    type.includes('officedocument.presentation') ||
    ['ppt', 'pptx', 'odp', 'key'].includes(extension)
  ) {
    return ItemCategory.presentation
  }

  // --- 3. Technical Types ---

  // Archives
  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    type.includes('tar') ||
    type.includes('rar') ||
    type.includes('7z') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'].includes(extension)
  ) {
    return ItemCategory.archive
  }

  // 3D Graphics / CAD / Design
  if (
    type.includes('model/') ||
    type.includes('application/vnd.ms-3mfdocument') ||
    type.includes('application/vnd.ms-pki.stl') ||
    type.includes('application/x-tgif') ||
    [
      'stl',
      'obj',
      '3mf',
      'fbx',
      'ply',
      'step',
      'stp',
      'dxf',
      'dwg',
      'ai',
      'eps',
    ].includes(extension)
  ) {
    return ItemCategory.graphic
  }

  // Binaries / Executables / Disk Images
  if (
    type.includes('application/x-msdownload') ||
    type.includes('application/x-executable') ||
    ['exe', 'msi', 'bin', 'dmg', 'iso', 'deb', 'rpm', 'apk'].includes(extension)
  ) {
    return ItemCategory.binaries
  }

  // --- 4. Code & Scripts (Fallbacks) ---

  // Scripts (Shell/Automation)
  if (
    ['ps1', 'psm1', 'psd1', 'sh', 'bat', 'cmd', 'zsh', 'bash'].includes(
      extension
    )
  ) {
    return ItemCategory.script
  }

  // Code (Source/Config)
  // Note: We check this last because many code files identify as 'text/plain' or 'application/octet-stream'
  const codeExtensions = new Set([
    // Web
    'html',
    'htm',
    'css',
    'scss',
    'less',
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'xml',
    'svg',
    // Backend/System
    'java',
    'c',
    'cpp',
    'h',
    'cs',
    'php',
    'py',
    'rb',
    'go',
    'rs',
    'swift',
    'kt',
    'dart',
    // Config/Data
    'yaml',
    'yml',
    'toml',
    'ini',
    'sql',
    'graphql',
    'env',
    'gitignore',
  ])

  if (
    codeExtensions.has(extension) ||
    type.includes('javascript') ||
    type.includes('json') ||
    type.includes('xml')
  ) {
    return ItemCategory.code
  }

  return ItemCategory.unknown
}
/**
 * A union type representing all possible keys that can be mapped to an icon.
 * This includes all possible `ItemCategory` values plus other specific UI states.
 */
export type IconKey =
  | ItemCategory
  | 'file'
  | 'folder'
  | 'collection'
  | 'archived'
  | 'trashed'
  | 'text'
  | 'shared'
  | 'locked'

/**
 * Maps Category or ItemType to their corresponding Remix icon components
 * @param value - The category or item type to get an icon for
 * @returns RemixiconComponentType - The corresponding Remix icon component
 * @enum {RemixiconComponentType} - Icons for: audio, video, image, archive, spreadsheet, document, code, script, pdf, presentation, executable, file, folder, collection, and more.
 */
export function toIcon(value: IconKey) {
  switch (value) {
    case 'audio':
      return AudioIcon
    case 'video':
      return Video2Icon
    case 'image':
      return ImageIcon
    case 'archive':
      return ArchiveIcon
    case 'spreadsheet':
      return HashTagIcon
    case 'document':
      return DocumentIcon
    case 'code':
      return CodeIcon
    case 'script':
      return ShellIcon
    case 'pdf':
      return Pdf2Icon
    case 'presentation':
      return SlidesIcon
    case 'binaries':
      return BinaryIcon
    case 'file':
      return FileIcon
    case 'folder':
      return FolderIcon
    case 'collection':
      return CollectionLineIcon
    case 'archived':
      return ArchiveIcon
    case 'trashed':
      return TrashIcon
    case 'text':
      return DocumentIcon
    case 'shared':
      return ShareIcon
    case 'locked':
      return LockedIcon
    default:
      return FileIcon
  }
}

/**
 * Splits an array into smaller arrays (chunks) of a specified size.
 *
 * @template T The type of elements in the array.
 * @param {Array<T>} array The array to be split into chunks.
 * @param {number} chunkSize The maximum size of each chunk. Must be a positive integer.
 * @returns {Array<T[]>} A new array containing the smaller chunk arrays.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const chunks = toChunkArray(numbers, 3);
 * // => [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]
 *
 * @example
 * const letters = ['a', 'b', 'c', 'd'];
 * const chunks2 = toChunkArray(letters, 5);
 * // => [['a', 'b', 'c', 'd']]
 *
 * @example
 * const users = [
 *   { name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' },
 *   { name: 'David' }, { name: 'Eve' }
 * ];
 * const userChunks = toChunkArray(users, 2);
 * // => [[{ name: 'Alice' }, { name: 'Bob' }], [{ name: 'Charlie' }, { name: 'David' }], [{ name: 'Eve' }]]
 */
export function toChunkArray<T>(
  array: Array<T>,
  chunkSize: number
): Array<T[]> {
  if (!Array.isArray(array) || chunkSize <= 0) {
    return []
  }
  const result: Array<T[]> = []
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize))
  }
  return result
}

/**
 * return the color mode from `prefers-color-scheme` or localStorage
 */
export function toColorMode() {
  if (typeof window !== undefined) {
    window.document.documentElement.dataset.theme === 'light'
      ? (window.document.documentElement.dataset.theme = 'dark')
      : (window.document.documentElement.dataset.theme = 'light')
  }
}

interface ToTypedObjectsInput<
  T extends Record<string, unknown>,
  K extends keyof T = keyof T,
> {
  fieldName: string
  requireId?: boolean
  transform?: (obj: T, index: number) => T
  fields?: K[]
}

interface ToTypedObjectsOutput<T> {
  data: T[]
  errors: string[]
}

/**
 * Converts FormData entries into typed objects without mutating the original FormData
 * @param formData Original FormData object
 * @param options Configuration options
 * @returns Object containing converted data and any validation errors
 */
export function toTypedObjects<
  T extends Record<string, unknown>,
  K extends keyof T = keyof T,
>(
  formData: FormData,
  options: ToTypedObjectsInput<T, K>
): ToTypedObjectsOutput<T> {
  const result: ToTypedObjectsOutput<T> = { data: [], errors: [] }

  if (!formData) {
    result.errors.push('FormData is required')
    return result
  }
  if (!options.fieldName) {
    result.errors.push('fieldName is required')
    return result
  }

  const entries = formData.getAll(options.fieldName)
  if (!entries.length) {
    result.errors.push(`No entries found for field: ${options.fieldName}`)
    return result
  }

  const keys = (options.fields as string[]) ?? Array.from(formData.keys())

  entries.forEach((entry, index) => {
    try {
      const obj = {} as T

      // Set ID if required
      if (options.requireId) {
        if (typeof entry !== 'string') {
          throw new Error(`Invalid ID value at index ${index}`)
        }
        obj[options.fieldName as K] = entry as T[K]
      }

      // Add other fields (skip fieldName if requireId)
      keys.forEach((key) => {
        if (key === options.fieldName && options.requireId) return
        const values = formData.getAll(key)
        if (values[index] !== undefined) {
          obj[key as K] = values[index] as T[K]
        }
      })

      const finalObj = options.transform
        ? options.transform(obj, index)
        : (obj as T)

      result.data.push(finalObj)
    } catch (error) {
      result.errors.push(
        `Error processing entry ${index}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  })

  return result
}

/**
 * Converts an enum object to an array of its keys
 * @param input - The enum object to convert
 * @returns Array<string> - Array of keys from the enum object
 */
export function toEnumKeys<T extends object>(input: T): Array<keyof T> {
  return Object.keys(input).map((key) => key as keyof T)
}

/**
 * Constructs a full item path within a drive.
 *
 * @param driveName The name of the drive.
 * @param parentPath The path of the parent folder, if any.
 * @param itemName The name of the item (file or folder).
 * @returns The full path of the item.
 * @example
 * toItemPath('MyDrive', 'Documents', 'MyFile.txt'); // Returns "MyDrive/Documents/MyFile.txt"
 */
export const toItemPath = (
  driveName: string,
  parentPath?: string,
  itemName?: string
): string => {
  return parentPath ? `${parentPath}/${itemName}` : `${driveName}/${itemName}`
}

/**
 * Generates the S3 object key for an uploaded file.
 * @param {File} file - The File object to generate the key for.
 * @param {string | undefined} workspaceId - The ID of the workspace, if the file belongs to one.
 * @example
 * // When a user want's to upload a folder named photos that containe file named image.jpg in workspace
 * toUploadFileKey(file, 'ws-123'); // Returns "ws-123/photos/image.jpg"
 * @example
 *  // When a user want's to upload a file in workspace
 * toUploadFileKey(file, 'ws-123'); // Returns "ws-123/document.pdf"
 * @example
 * // For a file named report.docx without a workspace
 * toUploadFileKey(file); // Returns "report.docx"
 */
function toUploadFileKey<
  TFile extends File,
  TrootId extends string,
  TWorkspaceId extends string | undefined,
>(file: TFile, rootId: TrootId, workspaceId: TWorkspaceId) {
  if (file.webkitRelativePath && workspaceId) {
    // If the file has a webkitRelativePath, use it as the key
    return `${workspaceId}/${rootId}/${file.webkitRelativePath}`
  }
  if (file.webkitRelativePath && !workspaceId) {
    // If the file has a webkitRelativePath but no workspaceId, use it directly
    return `${rootId}/${file.webkitRelativePath}`
  }
  if (!file.webkitRelativePath && workspaceId) {
    return `${workspaceId}/${rootId}/${file.name}`
  } else {
    return `${rootId}/${file.name}`
  }
}

export let toUploadFile = (
  file: File,
  rootId: string,
  workspaceId?: string
) => {
  return {
    id: toObjectId(getPrefixForModel('Item')),
    file: file,
    key: toUploadFileKey(file, rootId, workspaceId),
    status: 'pending' as Status,
    progress: {
      percentage: 0,
      timeLeft: {
        hours: 0,
        minutes: 0,
        seconds: 0,
      },
      speed: {
        value: 0,
        unit: 'KB/s',
      },
    } as UploadProgress,
  }
}

/**
 * Converts a browser File object into a standardized MediaFile object used by the upload machines.
 * This initializes the file with a unique ID, generated S3 key, and default progress/status values.
 * 
 * @param file - The native File object from the browser.
 * @param rootId - The ID of the root folder or directory where the file is being uploaded.
 * @param workspaceId - Optional ID of the workspace if the file belongs to one.
 * @returns A MediaFile object ready for processing by the XState upload manager.
 * 
 * @example
 * const file = new File(["content"], "hello.png", { type: "image/png" });
 * const mediaFile = toMediaFile(file, "item_root123");
 * // Returns { id: "item_...", key: "item_root123/hello.png", status: "pending", ... }
 */
export let toMediaFile = (
  file: File,
  rootId: string,
  workspaceId?: string
): MediaFile => {
  return {
    id: toObjectId(getPrefixForModel('Item')),
    key: toUploadFileKey(file, rootId, workspaceId),
    file: file,
    progress: {
      percentage: 0,
      speed: {
        unit: 'KB/s',
        value: 0,
      },
      timeLeft: {
        hours: 0,
        minutes: 0,
        seconds: 0,
      },
    },
    status: 'pending',
    etag: '',
    processingStatus: undefined,
    processingError: '',
    caption: '',
    embedding: [],
  }
}

/**
 * Creates a Zod schema that transforms a comma-separated string into a validated array.
 *
 * This function is highly generic and can be used to validate any type of array
 * derived from a string. It works in two steps: a transformation and a validation pipe.
 *
 * 1. **Transform:** It splits the input string (e.g., "tag1,tag2,tag3") into an array of strings.
 * For robustness, it also trims whitespace from each resulting tag.
 * 2. **Validate:** It uses a `.pipe()` to ensure that every element in the array
 * conforms to the provided `elementSchema`.
 *
 * @template T The Zod schema type for each element in the final array.
 * @example
 * // Example 1: Validating against a native enum (like the original function)
 * enum ItemCategory {
 * audio = 'audio',
 * video = 'video',
 * }
 * const categorySchema = toZodArraySchema(z.enum(ItemCategory));
 * categorySchema.parse('audio,video'); // Returns ['audio', 'video']
 *
 * @example
 * // Example 2: Validating a simple array of strings (like for a "tags" filter)
 * // We use `z.string().trim().min(1)` to ensure each tag is a non-empty string.
 * const tagsSchema = toZodArraySchema(z.string().trim().min(1));
 * tagsSchema.parse('red,  blue , green'); // Returns ['red', 'blue', 'green']
 *
 * @example
 * // Example 3: Validating an array of numbers
 * const numbersSchema = toZodArraySchema(z.coerce.number());
 * numbersSchema.parse('1,2,3'); // Returns [1, 2, 3]
 *
 * @example
 * // Example 4: Throwing an error for invalid values
 * enum ItemCategory {
 * 	audio = 'audio',
 * 	video = 'video',
 * }
 * const categorySchema = toZodArraySchema(z.nativeEnum(ItemCategory));
 * categorySchema.parse('audio,video,pdf'); // Throws ZodError: "Invalid enum value. Expected 'audio' | 'video', received 'pdf'"
 *
 */
export const toZodArraySchema = <T extends z.ZodType<any, string, any>>(
  elementSchema: T
) => {
  return z
    .string()
    .transform((str) => str.split(',').map((s) => s.trim()))
    .pipe(z.array(elementSchema))
}

/**
 * Creates a Zod schema that transforms a string like "field:direction,nested.field:direction"
 * into a Prisma-compatible `orderBy` object, with a type assertion.
 *
 * @example
 * toZodOrderBySchema().parse('createdAt:desc,owner.name:asc');
 * // returns { createdAt: 'desc', owner: { name: 'asc' } }
 * @returns A Zod schema for parsing and transforming an orderBy string.
 */
export const toZodOrderBySchema = <T extends object>() => {
  return z.string().transform((str, ctx) => {
    const orderByObject: Record<string, any> = {}
    const pairs = str.split(',').map((s) => s.trim())

    for (const pair of pairs) {
      const [key, direction] = pair.split(':')

      if (!key || (direction !== 'asc' && direction !== 'desc')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid orderBy pair: ${pair}. Expected format is 'field:asc' or 'field:desc'.`,
        })
        return z.NEVER
      }

      const keys = key.split('.')
      let current = orderByObject

      for (let i = 0; i < keys.length - 1; i++) {
        const currentKey = keys[i]
        current[currentKey] = current[currentKey] || {}
        current = current[currentKey]
      }

      current[keys[keys.length - 1]] = direction
    }

    // This is the controlled type assertion. We are trusting that the user-provided
    // field paths are valid for the Prisma model.
    return orderByObject as T
  })
}

/**
 * Creates a flexible Zod schema for search queries, combining model-specific filters
 * with dynamic pagination and common search options.
 *
 * The resulting schema validates:
 * 1.  **Custom Filters**: Fields defined in the provided `filterSchema`.
 * 2.  **Common Options**: `orderBy` and `include` fields.
 * 3.  **Pagination**: A discriminated union based on the `strategy` field:
 *     - `strategy: 'offset'`: Requires `page` and `take`.
 *     - `strategy: 'cursor'`: Requires `cursor` and `take`.
 *     - `strategy: 'stream'`: Requires `take`.
 *
 * All fields in the final schema are marked as optional (`.partial()`) to accommodate
 * various search scenarios.
 *
 * @template TFilterSchema - A Zod object schema for the model-specific filters.
 * @template TOrderBy - The expected object type for the `orderBy` parameter.
 * @param {TFilterSchema} filterSchema - The Zod schema for custom filter fields.
 * @returns A comprehensive Zod schema for search parameters.
 */
export const toSearchSchema = () =>
  //   filterSchema: TFilterSchema
  {
    // Base options common to all search strategies
    const cursorPagination = z.object({
      strategy: z.literal('cursor'),
      cursor: z.string().optional(),
      take: z.coerce.number().default(5),
    })

    const offsetPagination = z.object({
      strategy: z.literal('offset'),
      page: z.coerce.number().default(1),
      take: z.coerce.number().default(5),
    })

    const streamPagination = z.object({
      strategy: z.literal('stream'),
    })

    const pagination = z.discriminatedUnion('strategy', [
      cursorPagination,
      offsetPagination,
      streamPagination,
    ])

    return pagination.optional()
  }

/**
 * A mapping from the full model name to a short, unique prefix.
 * This is used when generating a new ID to get the correct prefix for a given model.
 * The keys are strongly typed to values from the ModelName object.
 */
export const StashlyPrefixMap = {
  Account: 'acc',
  ItemAction: 'ia',
  AccessAction: 'aa',
  CommentAction: 'ca',
  CreateAction: 'cra',
  DeleteAction: 'dela',
  EditAction: 'ea',
  MoveAction: 'mva',
  CopyAction: 'cpa',
  RenameAction: 'rna',
  RestoreAction: 'rsa',
  ShareAction: 'sha',
  VersionAction: 'va',
  PermissionAction: 'pa',
  Activity: 'act',
  ActivityTime: 'at',
  AuditLog: 'aud',
  CollectionMember: 'cm',
  Comment: 'cmt',
  Drive: 'drv',
  File: 'file',
  Folder: 'fld',
  Image: 'img',
  Video: 'vid',
  Audio: 'ado',
  Photo: 'pht',
  Favorite: 'fav',
  PinItem: 'pin',
  Invitation: 'inv',
  InvitationRecipient: 'invr',
  Item: 'item',
  LockedItem: 'li',
  Metadata: 'meta',
  Notification: 'ntf',
  Permission: 'perm',
  Quota: 'qot',
  Search: 'srch',
  SearchChunk: 'schk',
  Session: 'sess',
  ShareLink: 'sl',
  StoragePlan: 'sp',
  Subscription: 'sub',
  Tag: 'tag',
  Thumbnail: 'thumb',
  Trash: 'trsh',
  TrashItem: 'ti',
  User: 'usr',
  Verification: 'ver',
  ItemVersion: 'iv',
  Workspace: 'ws',
  WorkspaceMember: 'wm',
  Preview: 'prv',
  FileShare: 'fs',
  View: 'view',
} as const

/**
 * A union type representing all possible prefix strings.
 * Using this type in function signatures provides autocompletion and prevents
 * the use of invalid prefixes.
 *
 * Example: `function generateId(prefix: ModelPrefix) { ... }`
 */
export type StashlyObjectPrefix =
  (typeof StashlyPrefixMap)[keyof typeof StashlyPrefixMap]

/**
 *
 * @param objectType
 * @returns
 */
/**
 * Retrieves the prefix associated with a specific model name.
 * @param objectType - The name of the model (e.g., 'Item', 'User').
 * @returns The short prefix string for that model.
 */
export function getPrefixForModel<
  TObjectType extends keyof typeof StashlyPrefixMap,
>(objectType: TObjectType) {
  return StashlyPrefixMap[objectType] as (typeof StashlyPrefixMap)[TObjectType]
}

/**
 * Generates a unique, cryptographically secure ID in a Stripe-like format.
 * The ID is composed of a prefix, an underscore, and a 20-character URL-safe
 * alphanumeric string.
 * @param {string} prefix The short, descriptive prefix for the ID (e.g., 'cus', 'sub', 'pi').
 */
export function toObjectId<TPrefix extends StashlyObjectPrefix>(
  prefix: TPrefix
) {
  if (!prefix || typeof prefix !== 'string' || prefix.includes('_')) {
    throw new Error(
      'Invalid prefix: must be a non-empty string without an underscore.'
    )
  }

  const randomString = crypto.lib.WordArray.random(16)
    .toString(crypto.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return `${prefix}_${randomString}` as `${TPrefix}_${string}`
}

/**
 * Checks if a specific user has favorited an item.
 * 
 * @param props - The properties containing favorites list and user ID.
 * @param props.favorites - The list of favorite objects associated with an item.
 * @param props.userId - The ID of the user to check for.
 * @returns A boolean indicating whether the user is in the favorites list.
 * 
 * @example
 * const isFav = toFavorite({ favorites: item.favorites, userId: 'usr_123' });
 */
export const toFavorite = ({
  favorites,
  userId,
}: {
  favorites: ItemCardProps['favorites']
  userId: string
}) => favorites.some((favorite) => favorite.favoritedBy.id === userId)

type ToItemUrlProps = {
  type: ItemType
  id: string
  parentId: string
  ownerId: string
}

/**
 * Generates a type-safe URL for different item types within the stash.
 *
 * @param props - The properties of the item.
 * @param props.type - The type of the item ('folder', 'file', 'collection').
 * @param props.id - The unique identifier of the item.
 * @param props.parentId - The ID of the parent folder (required for files).
 * @param props.ownerId - The ID of the user who owns the item.
 * @returns A string representing the relative URL path.
 *
 * @example
 * toItemUrl({ type: 'folder', id: 'fld_123', parentId: 'root', ownerId: 'usr_456' });
 * // Returns "/usr_456/stash/folders/fld_123"
 */
export const toItemUrl = ({ type, id, parentId, ownerId }: ToItemUrlProps) => {
  switch (type) {
    case 'folder':
      return href('/:me/stash/folders/:folderId', { me: ownerId, folderId: id })
    case 'file':
      return href('/:me/stash/folders/:folderId/files/:fileId', {
        me: ownerId,
        folderId: parentId,
        fileId: id,
      })
    case 'collection':
      return href('/:me/stash/collections/:collectionId', {
        me: ownerId,
        collectionId: id,
      })
    default:
      return href('/:me/stash', { me: ownerId })
  }
}
