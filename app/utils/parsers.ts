import { parse } from 'qs'
import { z } from 'zod'
import { presignedUrl } from '@/schemas/machine.schemas'

type ParseSearchParamsConfig<T extends z.ZodTypeAny> = {
  schema: T
} & (
  | {
      request: Request
      searchParams?: never
    }
  | {
      request?: never
      searchParams: URLSearchParams
    }
)

export function parseSearchParams<T extends z.ZodTypeAny>(
  config: ParseSearchParamsConfig<T>
): z.infer<T> {
  // Get search params string from either request or URLSearchParams
  const searchParamsString = config.request
    ? new URL(config.request.url).searchParams.toString()
    : config.searchParams.toString()

  // Parse search params using qs library
  const parsedParams = parse(decodeURIComponent(searchParamsString), {
    decoder: (value) => {
      // Handle boolean values
      if (value === 'true') return true
      if (value === 'false') return false
      // Return original value for other types
      return value
    },
  })

  // Validate and transform using provided schema
  const result = config.schema.safeParse(parsedParams)

  if (!result.success) {
    throw new Error(`Invalid search params: ${result.error.message}`)
  }

  return result.data
}

/**
 * Parse form data using zod schema
 */

interface ParseFormDataOptions<T extends z.ZodTypeAny> {
  schema: T
}

/**
 * Smart form data parser that automatically handles nested and flat structures
 */
export async function parseFormData<T extends z.ZodTypeAny>({
  request,
  schema,
}: {
  request: Request
} & ParseFormDataOptions<T>): Promise<z.infer<T>> {
  const contentType = request.headers.get('content-type') || ''
  let parsed: unknown

  if (contentType.includes('application/x-www-form-urlencoded')) {
    // Handle URL-encoded data (typically nested objects using qs syntax)
    const text = await request.text()
    parsed = parse(decodeURIComponent(text), {
      arrayLimit: 100,
      depth: 5,
      decoder(str) {
        if (str === 'true') return true
        if (str === 'false') return false
        if (str === 'null') return null
        if (str === 'undefined') return undefined
        if (str.includes('+')) return str.replace(/\+/g, ' ')
        const num = Number(str)
        if (!Number.isNaN(num) && str.trim() !== '') return num
        return str
      },
    })
  } else {
    // Handle multipart/form-data or plain FormData
    const formData = await request.formData()
    const entries = Array.from(formData.entries())

    // Check if any key contains [] or . to detect nested structure
    const hasNestedSyntax = entries.some(
      ([key]) => key.includes('[') || key.includes('.')
    )

    if (hasNestedSyntax) {
      // Convert FormData to qs-like structure
      const params = new URLSearchParams()
      for (const [key, value] of entries) {
        params.append(key, typeof value === 'string' ? value : String(value))
      }
      parsed = parse(params.toString())
    } else {
      // Handle flat structure
      const data: Record<string, unknown> = {}
      for (const [key, value] of entries) {
        if (key in data) {
          data[key] = Array.isArray(data[key])
            ? [...(data[key] as unknown[]), value]
            : [data[key], value]
        } else {
          data[key] = value
        }
      }
      parsed = data
    }
  }

  // Validate with schema
  const result = schema.safeParse(parsed)

  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`)
  }

  return result.data as z.infer<T>
}

// parse file extension from filename
export function parseFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

export function parseEtag(etag: string) {
  // Step 1: Remove escape characters around quotes
  let cleaned = etag.replace(/\\"/g, '"')

  // Step 2: Remove outer quotes (single or double)
  cleaned = cleaned.replace(/^["']|["']$/g, '')

  // Step 3: Add a single pair of double quotes back
  return `"${cleaned}"`
}

/**
 * Parse presigned URL and validate it, using the zod schema
 * @see {@link presignedUrl} schema in app/machines/schema.zod.ts
 * @param url
 *
 * @example
 * ```ts
 * const parsedUrl = parsePresignedUrl('https://example-bucket.s3.amazonaws.com/my-object.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20231101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20231101T000000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=EXAMPLESIGNATURE1234567890abcdef');
 * void 0; // true
 * void 0; // Validated URL string
 * ```
 */
export function parsePresignedUrl(url: string) {
  return presignedUrl.safeParse(url)
}

/**
 * A positive integer from the query string, or `undefined`. Anything else —
 * absent, `0`, a word someone typed over the URL — means "no target", which
 * leaves a viewer at the top of the file.
 */
export function parseNumberParam(raw: string | null): number | undefined {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : undefined
}
