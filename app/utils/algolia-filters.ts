import { z } from 'zod'

/**
 * A single filter definition for Algolia.
 * @template T - The type of the filter's own value.
 * @template TParams - The full params object type (from schema).
 */
type AlgoliaFilter<T, TParams> = {
  schema: z.ZodType<T>
  apply: (value: unknown, params: TParams) => string | string[]
}

/**
 * Factory function for creating a specific model's filter string.
 * @template TParams - The full params object type (from zod schema).
 * @returns A function that takes a Zod schema and a filter function,
 * and returns a Filter definition.
 */
export const createAlgoliaFilter = <TParams = Record<string, unknown>>() => {
  return <T>(
    schema: z.ZodType<T>,
    filterFn: (value: T, params: TParams) => string | string[]
  ): AlgoliaFilter<T, TParams> => ({
    schema,
    apply: (value: unknown, params: TParams) =>
      filterFn(schema.parse(value), params),
  })
}

/**
 * FilterBuilder class to manage and build complex Algolia filter strings.
 * @template TFilters - Record of available filters for the model.
 * @template TParams - Full params type from Zod schema.
 */
export class AlgoliaFilterBuilder<
  TFilters extends Record<string, AlgoliaFilter<any, TParams>>,
  TParams,
> {
  private conditions: string[] = []

  constructor(
    private availableFilters: TFilters,
    private params: TParams
  ) {}

  addFilter<TKey extends keyof TFilters>(key: TKey, value: unknown): this {
    if (
      value !== undefined &&
      value !== null &&
      (Array.isArray(value) ? value.length > 0 : true)
    ) {
      try {
        const filterResult = this.availableFilters[key].apply(
          value,
          this.params
        )
        if (Array.isArray(filterResult)) {
          this.conditions.push(...filterResult)
        } else {
          this.conditions.push(filterResult)
        }
      } catch (error) {
        console.error(`Invalid value for filter '${String(key)}':`, error)
      }
    }
    return this
  }

  build(): string {
    return this.conditions.join(' AND ')
  }
}

/**
 * Factory to build a type-safe Algolia filter builder function.
 */
interface BuildAlgoliaFiltersFactoryInput<TSchema extends z.ZodType<any>> {
  schema: TSchema
  filters: Record<string, AlgoliaFilter<unknown, z.infer<TSchema>>>
}

/**
 *  Builds a type-safe filter builder function for Algolia.
 *
 * @template TSchema - The Zod schema type for the full params object.
 * @returns A function that takes the full params object and returns the Algolia filter string.
 */
export const buildAlgoliaFiltersFactory = <TSchema extends z.ZodType<any>>({
  filters,
  schema,
}: BuildAlgoliaFiltersFactoryInput<TSchema>) => {
  return (params: z.infer<typeof schema>): string => {
    const builder = new AlgoliaFilterBuilder<typeof filters, z.infer<TSchema>>(
      filters,
      params
    )

    const keys = Object.keys(params) as Array<keyof typeof params>
    for (const key of keys) {
      if (key in filters) {
        builder.addFilter(key as keyof typeof filters, params[key])
      }
    }

    return builder.build()
  }
}
