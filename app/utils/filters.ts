import { z } from 'zod'
/**
 * A single filter definition.
 * @template T - The type of the filter's own value.
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TParams - The full params object type (from schema).
 */
type Filter<T, TWhereInput, TParams> = {
  schema: z.ZodType<T>
  apply: (value: unknown, params: TParams) => TWhereInput
}

/**
 * Factory function for creating a specific model's WhereInput type.
 * @template TWhereInput - Prisma WhereInput type.
 * @template TParams - The full params object type (from zod schema).
 * @returns A function that takes a Zod schema and a filter function,
 * and returns a Filter definition.
 * @see {@link Filter} for details.
 * @example
 * const createItemFilter = createFilter<Prisma.ItemWhereInput, z.infer<typeof itemFilterSchema>>()
 * const idFilter = createItemFilter(z.string(), (id) => ({ id }))
 */
export const createFilter = <
  TWhereInput,
  TParams = Record<string, unknown>,
>() => {
  return <T>(
    schema: z.ZodType<T>,
    filterFn: (value: T, params: TParams) => TWhereInput
  ): Filter<T, TWhereInput, TParams> => ({
    schema,
    apply: (value: unknown, params: TParams) =>
      filterFn(schema.parse(value), params),
  })
}

/**
 * FilterBuilder class to manage and build complex filters.
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TFilters - Record of available filters for the model.
 * @template TParams - Full params type from Zod schema.
 * @example
 * // Example usage:
 * const builder = new FilterBuilder<Prisma.ItemWhereInput, typeof itemFilters, z.infer<typeof itemFilterSchema>>(itemFilters, params)
 * builder.addFilter('id', 'some-id')
 * const whereInput = builder.build()
 * // whereInput can be used in a Prisma query
 * @see {@link Filter} for details.
 */
export class FilterBuilder<
  TWhereInput,
  TFilters extends Record<string, Filter<any, TWhereInput, TParams>>,
  TParams,
> {
  private filters: Map<keyof TFilters, TWhereInput> = new Map()
  private conditions: TWhereInput[] = []

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
        this.filters.set(
          key,
          this.availableFilters[key].apply(value, this.params)
        )
        this.rebuildConditions()
      } catch (error) {
        console.error(`Invalid value for filter '${String(key)}':`, error)
      }
    }
    return this
  }

  private rebuildConditions(): void {
    this.conditions = Array.from(this.filters.values())
  }

  build(): TWhereInput {
    if (this.conditions.length === 0) {
      return [] as TWhereInput
    }
    return { AND: this.conditions } as TWhereInput
  }
}

/**
 * Factory to build a type‑safe filter builder function.
 */
interface BuildFiltersFactoryInput<
  TWhereInput,
  TSchema extends z.ZodType<any>,
> {
  schema: TSchema
  filters: Record<string, Filter<unknown, TWhereInput, z.infer<TSchema>>>
}

/**
 *  Builds a type-safe filter builder function.
 *
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TSchema - The Zod schema type for the full params object.
 * @returns A function that takes the full params object and returns the Prisma WhereInput.
 */
export const buildFiltersFactory = <
  TWhereInput,
  TSchema extends z.ZodType<any>,
>({
  filters,
  schema,
}: BuildFiltersFactoryInput<TWhereInput, TSchema>) => {
  return (params: z.infer<typeof schema>): TWhereInput => {
    const builder = new FilterBuilder<
      TWhereInput,
      typeof filters,
      z.infer<TSchema>
    >(filters, params)

    const keys = Object.keys(params) as Array<keyof typeof params>
    for (const key of keys) {
      if (key in filters) {
        builder.addFilter(key as keyof typeof filters, params[key])
      }
    }

    return builder.build()
  }
}
