import { parse } from 'qs'
import { z } from 'zod'
import { presignedUrl } from '@/schemas/machine.schemas'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'

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

  // `toString()` writes a space as `+`, so the string must be decoded by qs,
  // which splits on `&` first and then turns `+` into a space and `%XX` into
  // its character. Decoding the whole string up front (as this used to) left
  // every space as a literal `+` and split values on an encoded `&` or `=`.
  const parsedParams = parse(searchParamsString, {
    decoder: (str, defaultDecoder, charset, type) => {
      const decoded = defaultDecoder(str, defaultDecoder, charset)
      if (type === 'value') {
        if (decoded === 'true') return true
        if (decoded === 'false') return false
      }
      return decoded
    },
  })

  // Validate and transform using provided schema
  const result = config.schema.safeParse(parsedParams)

  if (!result.success) {
    // INVALID_INPUT so a route's `toErrorInfo` answers 400 — a bare Error read as 500.
    throw new StashlyError(
      StashlyErrorCode.INVALID_INPUT,
      `Invalid search params: ${result.error.message}`
    )
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
    // qs must see the raw body: it splits on `&` first, then decodes `+` and
    // `%XX` per value. Decoding the whole body up front split a value on an
    // encoded `&`, and the old `+` → space step then mangled a real `c++`.
    parsed = parse(text, {
      arrayLimit: 100,
      depth: 5,
      decoder(str, defaultDecoder, charset, type) {
        const value = defaultDecoder(str, defaultDecoder, charset)
        if (type === 'key') return value
        if (value === 'true') return true
        if (value === 'false') return false
        if (value === 'null') return null
        if (value === 'undefined') return undefined
        // Only when the number writes back out as the same text: "42" is 42,
        // but "007", "1.50" and "1e3" are someone's text and stay strings.
        const num = Number(value)
        if (value !== '' && String(num) === value) return num
        return value
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
    // INVALID_INPUT so a route's `toErrorInfo` answers 400 — a bare Error read as 500.
    throw new StashlyError(
      StashlyErrorCode.INVALID_INPUT,
      `Validation failed: ${result.error.message}`
    )
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
