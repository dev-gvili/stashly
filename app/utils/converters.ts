import {
  ArchiveFillIcon,
  ArchiveIcon,
  AudioFillIcon,
  AudioIcon,
  BinariesFillIcon,
  BinaryIcon,
  CodeFillIcon,
  CodeIcon,
  CollectionIcon,
  CollectionLineIcon,
  CollectionFillIcon,
  DocumentFillIcon,
  DocumentIcon,
  FileFillIcon,
  FileIcon,
  FolderFillIcon,
  FolderIcon,
  GraphicIcon,
  HashTagIcon,
  ImageFillIcon,
  ImageIcon,
  LockedFillIcon,
  LockedIcon,
  Pdf2Icon,
  PresentationFillIcon,
  ShareFillIcon,
  ShareIcon,
  ShellFillIcon,
  ShellIcon,
  SlidesIcon,
  SpreadSheetFillIcon,
  TrashFillIcon,
  TrashIcon,
  VideoFillIcon,
  WorkspaceFillIcon,
} from '@/components/icons'
import type {
  LinkState,
  SharedLink,
  StashItem,
  StashPickerItem,
} from '@/types/stash.types'
import type { MediaFile, Status, UploadProgress } from '@/types/machine.types'
import { ItemCategory, type ItemType } from '@/prisma/browser'
import { href } from 'react-router'
import { z, type Schema } from 'zod'
import type { ItemCardProps } from '../components/stash/item-card'
import { paginationOptions } from '@/schemas/filters.schemas'

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
 * Converts a string to a SHA-256 hash.
 * @param input - The input string to hash.
 * @returns A promise resolving to the SHA-256 hash.
 */
export const toSHA256 = async (input: string): Promise<string> => {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  )
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
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

  // --- 0. Ambiguous-Extension Guard ---
  // Browsers report .ts/.tsx as MPEG transport stream video
  // ('video/vnd.dlna.mpeg-tts' / 'video/mp2t') because the extension
  // predates TypeScript in OS MIME tables. If normalizeFile already ran,
  // type is 'text/typescript' and this never matches; the guard protects
  // any path where a raw un-normalized File reaches toCategory.
  if (
    (extension === 'ts' || extension === 'tsx') &&
    /^video\/(vnd\.dlna\.)?(mpeg-tts|mp2t)/.test(type)
  ) {
    return ItemCategory.code
  }

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
  | 'workspace'

/**
 * Maps Category or ItemType to their corresponding Remix icon components
 * @param value - The category or item type to get an icon for
 * @returns RemixiconComponentType - The corresponding Remix icon component
 * @enum {RemixiconComponentType} - Icons for: audio, video, image, archive, spreadsheet, document, code, script, pdf, presentation, executable, file, folder, collection, and more.
 */
export function toIcon(value: IconKey) {
  switch (value) {
    case 'audio':
      return AudioFillIcon
    case 'video':
      return VideoFillIcon
    case 'image':
      return ImageFillIcon
    case 'archive':
      return ArchiveFillIcon
    case 'spreadsheet':
      return SpreadSheetFillIcon
    case 'document':
      return DocumentFillIcon
    case 'code':
      return CodeFillIcon
    case 'script':
      return ShellFillIcon
    case 'pdf':
      return Pdf2Icon
    case 'presentation':
      return PresentationFillIcon
    case 'binaries':
      return BinariesFillIcon
    case 'graphic':
      return GraphicIcon
    case 'file':
      return FileFillIcon
    case 'folder':
      return FolderFillIcon
    case 'collection':
      return CollectionFillIcon
    case 'archived':
      return ArchiveFillIcon
    case 'trashed':
      return TrashFillIcon
    case 'text':
      return DocumentFillIcon
    case 'shared':
      return ShareFillIcon
    case 'locked':
      return LockedFillIcon
    case 'workspace':
      return WorkspaceFillIcon
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

/**
 * The S3 key an upload's bytes are stored under: its root, its item id, then
 * the file's name.
 *
 * Unique per upload, so two uploads of one name never land on one object: the
 * second used to replace the bytes behind the first's row, which left no old
 * version to keep and made both duplicate copies show the same content. The
 * folders live in the upload path (`File.uploadPath`), not here. The server
 * refuses a row whose key is not this, so a client can't file over an object
 * another row already serves.
 *
 * @example
 * toObjectKey('item_root/photos/2024/a.jpg', 'item_abc') // → 'item_root/item_abc/a.jpg'
 */
export function toObjectKey(uploadPath: string, itemId: string): string {
  const segments = uploadPath.split('/')
  return `${segments[0]}/${itemId}/${segments[segments.length - 1]}`
}

export let toUploadFile = (
  file: File,
  rootId: string,
  workspaceId?: string
) => {
  const id = toObjectId(getPrefixForModel('Item'))
  const uploadPath = toUploadFileKey(file, rootId, workspaceId)
  return {
    id,
    file: file,
    key: toObjectKey(uploadPath, id),
    uploadPath,
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
 * // Returns { id: "item_abc", key: "item_root123/item_abc/hello.png", uploadPath: "item_root123/hello.png", status: "pending", ... }
 */
export let toMediaFile = (
  file: File,
  rootId: string,
  workspaceId?: string
): MediaFile => {
  const id = toObjectId(getPrefixForModel('Item'))
  const uploadPath = toUploadFileKey(file, rootId, workspaceId)
  return {
    id,
    key: toObjectKey(uploadPath, id),
    uploadPath,
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
    uploadId: '',
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
 * Wraps the schema of a field that holds text someone typed.
 *
 * The form and search-param decoders turn "42", "true", "false" and "null" into
 * values, so a file renamed to "2024" or a search for "true" reached a
 * `z.string()` as a number or boolean and failed validation. Only those scalars
 * are turned back into text; `undefined` passes through untouched, so a missing
 * required field still fails rather than becoming the word "undefined".
 *
 * @example
 * newName: toUserText(z.string().nonempty())
 */
export const toUserText = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'number' || typeof value === 'boolean' || value === null
        ? String(value)
        : value,
    schema
  )

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
 * The query-shape keys every paginated search schema gains on top of its model
 * filters.
 *
 * `orderBy` / `include` are `z.custom`, i.e. deliberately **unvalidated** — they
 * exist so a correctly-typed Prisma object survives the parse, not to police it.
 * Authority still belongs in the action (`app/.server/*-actions.ts`), and
 * `buildFiltersFactory` ignores these keys because they have no filter entry.
 */
type SearchExtras<TOrderBy, TInclude> = typeof paginationOptions.shape & {
  orderBy: z.ZodOptional<z.ZodCustom<TOrderBy, TOrderBy>>
  include: z.ZodOptional<z.ZodCustom<TInclude, TInclude>>
}

/** A `[model]FilterSchema` widened with pagination + Prisma query shape. */
export type SearchSchema<
  S extends z.ZodObject,
  TOrderBy,
  TInclude,
> = z.ZodObject<
  z.core.util.Extend<S['shape'], SearchExtras<TOrderBy, TInclude>>
>

/**
 * Widen a `[model]FilterSchema` into the schema a list loader actually needs:
 * its own filters **plus** `cursor` / `take` (from {@link paginationOptions})
 * plus a typed `orderBy` / `include` passthrough.
 *
 * Keeps the four pagination keys out of every `*.filters.ts` file — a filters
 * file describes `where`, and nothing else.
 *
 * @example
 * let parsedParams = parseSearchParams({
 *   schema: toSearchSchema<
 *     typeof itemFilterSchema,
 *     Prisma.ItemOrderByWithRelationInput,
 *     Prisma.ItemInclude
 *   >({ schema: itemFilterSchema }),
 *   searchParams,
 * })
 * // parsedParams.take   -> number   (defaulted, never undefined)
 * // parsedParams.cursor -> string | undefined
 * // parsedParams.orderBy -> Prisma.ItemOrderByWithRelationInput | undefined
 *
 * @remarks
 * All three type arguments must be supplied: TypeScript has no partial type
 * argument inference, so naming `TOrderBy`/`TInclude` forces `S` to be named too.
 *
 * The assertion is load-bearing. Calling `.extend()` on a value whose type is
 * the *generic* `S` resolves against `S`'s constraint, so the concrete shape is
 * erased and every filter key would disappear from the result. Re-stating the
 * result with `S['shape']` — through Zod's own `util.Extend`, the exact helper
 * `.extend()` uses — restores it. The runtime value is what the cast claims.
 */
export const toSearchSchema = <
  S extends z.ZodObject,
  TOrderBy = unknown,
  TInclude = unknown,
>({
  schema,
}: {
  schema: S
}): SearchSchema<S, TOrderBy, TInclude> => {
  return schema.extend({
    ...paginationOptions.shape,
    orderBy: z.custom<TOrderBy>().optional(),
    include: z.custom<TInclude>().optional(),
  }) as unknown as SearchSchema<S, TOrderBy, TInclude>
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
  PinAction: 'pna',
  UploadAction: 'ula',
  CollectionAction: 'cola',
  FavoriteAction: 'fava',
  BucketAction: 'bka',
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
  Pdf: 'pdf',
  Markdown: 'mdn',
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

  const randomString = crypto
    .getRandomValues(new Uint8Array(16))
    .reduce((acc, byte) => acc + String.fromCharCode(byte), '')

  const base64String = btoa(randomString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return `${prefix}_${base64String}` as `${TPrefix}_${string}`
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
  /**
   * Value for the `:me` URL segment — the *viewing* user, not the item's owner.
   * In the personal stash the two are the same; in a workspace they are not, so
   * passing an item's `ownerId` here would put a teammate's id in the URL.
   */
  me: string
  /**
   * When set, the item is addressed through its workspace
   * (`/:me/workspaces/:workspaceId/...`) instead of the personal stash.
   */
  workspaceId?: string
}

/**
 * Generates a type-safe URL for different item types within the stash.
 *
 * Personal-stash and workspace URLs are the same page reached through two route
 * trees, so the only thing that varies is the prefix: pass `workspaceId` to get
 * the workspace form. Prefer the `useItemUrl` hook inside components — it reads
 * `:me` and `:workspaceId` off the current route so callers can't get them wrong.
 *
 * @param props - The properties of the item.
 * @param props.type - The type of the item ('folder', 'file', 'collection').
 * @param props.id - The unique identifier of the item.
 * @param props.parentId - The ID of the parent folder (required for files).
 * @param props.me - The viewing user's ID, for the `:me` segment.
 * @param props.workspaceId - Workspace to address the item through, if any.
 * @returns A string representing the relative URL path.
 *
 * @example
 * toItemUrl({ type: 'folder', id: 'fld_123', parentId: 'root', me: 'usr_456' });
 * // Returns "/usr_456/stash/folders/fld_123"
 *
 * @example
 * toItemUrl({ type: 'folder', id: 'fld_123', parentId: 'root', me: 'usr_456', workspaceId: 'wsp_9' });
 * // Returns "/usr_456/workspaces/wsp_9/folders/fld_123"
 */
export const toItemUrl = ({
  type,
  id,
  parentId,
  me,
  workspaceId,
}: ToItemUrlProps) => {
  if (workspaceId) {
    switch (type) {
      case 'folder':
        return href('/:me/workspaces/:workspaceId/folders/:folderId', {
          me,
          workspaceId,
          folderId: id,
        })
      case 'file':
        return href(
          '/:me/workspaces/:workspaceId/folders/:folderId/files/:fileId',
          { me, workspaceId, folderId: parentId, fileId: id }
        )
      case 'collection':
        return href('/:me/workspaces/:workspaceId/collections/:collectionId', {
          me,
          workspaceId,
          collectionId: id,
        })
      default:
        return href('/:me/workspaces/:workspaceId', { me, workspaceId })
    }
  }

  switch (type) {
    case 'folder':
      return href('/:me/stash/folders/:folderId', { me, folderId: id })
    case 'file':
      return href('/:me/stash/folders/:folderId/files/:fileId', {
        me,
        folderId: parentId,
        fileId: id,
      })
    case 'collection':
      return href('/:me/stash/collections/:collectionId', {
        me,
        collectionId: id,
      })
    default:
      return href('/:me/stash', { me })
  }
}

/**
 * Derives a stable pseudo-random seed (3–99) from a string id, so the same item
 * always renders the same generated waveform. Used by the audio stage.
 *
 * @example
 * toSeedFromId('item_abc') // e.g. 42
 */
export function toSeedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xffffffff
  }
  return (Math.abs(h) % 97) + 3
}

/**
 * Generates a deterministic waveform: `n` bar heights (0–1) shaped by a sine
 * envelope, jittered by a seeded PRNG. Pair with {@link toSeedFromId} so a given
 * item always renders the same waveform.
 *
 * @example
 * toWaveform(72, toSeedFromId(item.id)) // number[] of length 72
 */
export function toWaveform(n: number, seed: number): number[] {
  let s = seed
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: n }, (_, i) => {
    const env = Math.sin((i / n) * Math.PI)
    return 0.12 + (0.35 + 0.65 * rnd()) * (0.45 + 0.55 * env)
  })
}

// Zoom is a multiplier on top of the fit-to-width scale; 1 = fit width.
export const ZOOM_LEVELS = [
  0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3,
]

/**
 * Steps a zoom multiplier to the next/previous level in {@link ZOOM_LEVELS}.
 * When the current value isn't a known level, snaps to the nearest level in the
 * requested direction. Used by the PDF stage zoom controls.
 *
 * @param dir `1` to zoom in, `-1` to zoom out.
 */
export function toSteppedZoom(zoom: number, dir: 1 | -1): number {
  const idx = ZOOM_LEVELS.findIndex((z) => Math.abs(z - zoom) < 0.001)
  if (idx === -1) {
    return dir === 1
      ? (ZOOM_LEVELS.find((z) => z > zoom) ??
          ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
      : ([...ZOOM_LEVELS].reverse().find((z) => z < zoom) ?? ZOOM_LEVELS[0])
  }
  return ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir))]
}

/**
 * Share-link lifecycle. `expired` is trusted from the server when present so
 * the client never disagrees with it; otherwise it is derived from `expiresAt`,
 * with a 7-day warning window.
 */
export function toLinkState(link: SharedLink): LinkState {
  if (link.expired) return 'expired'
  if (!link.expiresAt) return 'live'
  const days = (new Date(link.expiresAt).getTime() - Date.now()) / 86_400_000
  if (days <= 0) return 'expired'
  return days <= 7 ? 'expiring' : 'live'
}

/**
 * Fills a slim picker shape out to a full `StashItem`, so it can render
 * through `ItemCard` or provide `ItemCardContext` (the thumbnail hooks read it).
 * The picker only carries a finished thumbnail URL, so it stands in as a
 * stage-2 row — what `ItemCard.Cover` looks for.
 *
 * @example
 * <ItemCard {...toStashItem(pickerItem)} />
 */
export function toStashItem(item: StashPickerItem): StashItem {
  return {
    ...item,
    status: 'normal',
    inclusiveSize: item.size,
    updatedAt: null,
    parentId: null,
    parent: null,
    ownerId: '',
    workspaceId: null,
    driveId: '',
    tags: [],
    thumbnails: item.thumbnailUrl
      ? [
          {
            id: item.id,
            url: item.thumbnailUrl,
            width: null,
            height: null,
            size: 'medium' as const,
            view: 'grid' as const,
            stage: 2,
          },
        ]
      : [],
    favorites: [],
    locked: null,
    file: item.file ?? null,
    folder: null,
  }
}
