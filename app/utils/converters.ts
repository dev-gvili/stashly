import { ItemCategory, ItemType } from '@/prisma/enums'
import {
	RiArchiveStackLine,
	RiBracesLine,
	RiClapperboardLine,
	RiFile2Line,
	RiFolderLine,
	RiImageFill,
	RiMicLine,
	RiSlideshow2Line,
	RiStackedView,
	RiStackLine,
	RiSwap3Line,
	RiTableView,
	RiTerminalLine,
} from '@/components/icons'
import crypto from 'crypto-js'
import type { MediaFile } from '../machines/machine.types'
import { z } from 'zod'

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
 * Returns the category enum value based on the file info.
 */
export function toCategory(file: File): ItemCategory {
	const type = file.type.toLowerCase()

	if (type.includes('pdf')) {
		return ItemCategory.pdf
	}
	if (type.includes('image')) {
		return ItemCategory.image
	}
	if (type.includes('video')) {
		return ItemCategory.video
	}
	if (type.includes('audio')) {
		return ItemCategory.audio
	}
	if (type.includes('zip') || type.includes('tar')) {
		return ItemCategory.archive
	}
	if (
		type.includes('msword') ||
		type.includes(
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		)
	) {
		return ItemCategory.document
	}
	if (type.includes('text/markdown')) {
		return ItemCategory.document
	}
	if (
		type.includes('excel') ||
		type.includes('csv') ||
		type.includes(
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		)
	) {
		return ItemCategory.spreadsheet
	}
	if (
		type.includes('powerpoint') ||
		type.includes(
			'application/vnd.openxmlformats-officedocument.presentationml.presentation'
		)
	) {
		return ItemCategory.presentation
	}
	if (type.includes('executable')) {
		return ItemCategory.binaries
	}
	if (
		type.includes('application/vnd.ms-3mfdocument') ||
		type.includes('application/x-amf') ||
		type.includes('application/vnd.ms-pki.stl') ||
		type.includes('application/x-tgif')
	) {
		return ItemCategory.graphic
	}
	if (type.includes('application/octet-stream')) {
		if (
			file.name.endsWith('.ps1') ||
			file.name.endsWith('.psm1') ||
			file.name.endsWith('.psd1')
		) {
			return ItemCategory.script
		}
		if (
			file.name.endsWith('.ts') ||
			file.name.endsWith('.tsx') ||
			file.name.endsWith('.jsx') ||
			file.name.endsWith('.js') ||
			file.name.endsWith('.css')
		) {
			return ItemCategory.code
		}
	}

	return ItemCategory.unknown
}

/**
 * Maps Category or ItemType to their corresponding Remix icon components
 * @param value - The category or item type to get an icon for
 * @returns RemixiconComponentType - The corresponding Remix icon component
 * @enum {RemixiconComponentType} - Icons for: audio, video, photo, archive, spreadsheet, document, code, script, pdf, presentation, executable, file, folder, collection
 */

export function toIcon(value: ItemCategory | ItemType) {
	switch (value) {
		case 'audio':
			return RiMicLine
		case 'video':
			return RiClapperboardLine
		case 'image':
			return RiImageFill
		case 'archive':
			return RiArchiveStackLine
		case 'spreadsheet':
			return RiTableView
		case 'document':
			return RiFile2Line
		case 'code':
			return RiBracesLine
		case 'script':
			return RiTerminalLine
		case 'pdf':
			return RiStackedView
		case 'presentation':
			return RiSlideshow2Line
		case 'binaries':
			return RiSwap3Line
		case 'file':
			return RiFile2Line
		case 'folder':
			return RiFolderLine
		case 'collection':
			return RiStackLine
		default:
			return RiFile2Line
	}
}
/**
 * split an array into multiple array's based on the chunk size, and return a new array that containes all the chunks
 */
export function toChunkArray<T>(array: Array<T>, chunkSize: number) {
	const result: Array<T[]> = []
	for (let i = 0; i < array.length; i += chunkSize) {
		result.push(array.slice(i, i + chunkSize) as T[])
	}
	return result
}

/**
 * return the color mode from `prefers-color-scheme` or localStorage
 */
export function toColorMode() {
	// On page load or when changing themes, best to add inline in `head` to avoid FOUC
	if (
		localStorage.theme === 'dark' ||
		(!('theme' in localStorage) &&
			window.matchMedia('(prefers-color-scheme: dark)').matches)
	) {
		document.documentElement.classList.add('dark')
	} else {
		document.documentElement.classList.remove('dark')
	}

	// Whenever the user explicitly chooses light mode
	localStorage.theme = 'light'

	// Whenever the user explicitly chooses dark mode
	localStorage.theme = 'dark'

	// Whenever the user explicitly chooses to respect the OS preference
	localStorage.removeItem('theme')
}
interface FormDataConversionOptions<
	T extends Record<string, unknown>,
	K extends keyof T = keyof T
> {
	fieldName: string
	requireId?: boolean
	transform?: (obj: T, index: number) => T
	fields?: K[]
}

interface ConversionResult<T> {
	data: T[]
	errors: string[]
}

/**
 * Converts FormData entries into typed objects without mutating the original FormData
 * @param formData Original FormData object
 * @param options Configuration options
 * @returns Object containing converted data and any validation errors
 */
export function convertFormDataToObjects<
	T extends Record<string, unknown>,
	K extends keyof T = keyof T
>(
	formData: FormData,
	options: FormDataConversionOptions<T, K>
): ConversionResult<T> {
	const result: ConversionResult<T> = { data: [], errors: [] }

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
export function convertEnumToArray<T extends object>(input: T): Array<keyof T> {
	console.log('input', input)
	return Object.keys(input).map((key) => key as keyof T)
}

/**
 * Generate Id for a file based on the file name as base64 string
 */
export const generateId = (fileName: string): string => {
	return crypto.MD5(fileName).toString(crypto.enc.Base64)
}

export let toMediaFile = (file: File): MediaFile => {
	return {
		id: generateId(file.name),
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
		version: '',
		url: '',
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
 * const categorySchema = toZodArraySchema(z.nativeEnum(ItemCategory));
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
 * @returns {z.ZodEffects<z.ZodString, Array<z.infer<T>>, string>} A Zod schema that transforms a comma-separated string into an array of validated elements.
 */
export const toZodArraySchema = <T extends z.ZodTypeAny>(elementSchema: T) => {
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
 * // returns { createdAt: 'desc', owner: { name: 'asc' } }
 * toZodOrderBySchema().parse('createdAt:desc,owner.name:asc');
 *
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
 *     - `strategy: 'page'`: Requires `page` and `take`.
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
export const toZodSearchSchema = <
	TFilterSchema extends z.AnyZodObject,
	TOrderBy extends object
>(
	filterSchema: TFilterSchema
) => {
	// Base options common to all search strategies
	const baseSearchOptions = z
		.object({
			orderBy: z.record(z.string(), z.enum(['asc', 'desc'])),
			include: z.record(z.string(), z.boolean()),
		})
		.partial()

	const cursorPagination = z.object({
		strategy: z.literal('cursor'),
		cursor: z.string().optional(),
		take: z.coerce.number(),
	})

	const offsetPagination = z.object({
		strategy: z.literal('offset'),
		page: z.coerce.number(),
		take: z.coerce.number(),
	})

	const streamPagination = z.object({
		strategy: z.literal('stream'),
		take: z.coerce.number(),
	})

	let paginateUnion = z
		.union([offsetPagination, cursorPagination, streamPagination])
		.and(baseSearchOptions)
		.and(filterSchema)

	return paginateUnion 
}
