import { z } from 'zod'

/**
 * A single filter definition.
 * The `apply` function can now be async.
 */
type Filter<T, TWhereInput, TParams> = {
  schema: z.ZodType<T>
  apply: (value: unknown, params: TParams) => TWhereInput | Promise<TWhereInput>
}

/**
 * Factory for creating a specific model's WhereInput type.
 */
export const createFilter = <
  TWhereInput,
  TParams = Record<string, unknown>,
>() => {
  return <T>(
    schema: z.ZodType<T>,
    filterFn: (value: T, params: TParams) => TWhereInput | Promise<TWhereInput>
  ): Filter<T, TWhereInput, TParams> => ({
    schema,
    apply: (value: unknown, params: TParams) =>
      filterFn(schema.parse(value), params),
  })
}

/**
 * FilterBuilder class to manage and build complex filters, now with async support.
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

  async addFilter<TKey extends keyof TFilters>(
    key: TKey,
    value: unknown
  ): Promise<this> {
    if (
      value !== undefined &&
      value !== null &&
      (Array.isArray(value) ? value.length > 0 : true)
    ) {
      try {
        const condition = await this.availableFilters[key].apply(
          value,
          this.params
        )
        this.filters.set(key, condition)
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
      return {} as TWhereInput
    }
    return { AND: this.conditions } as TWhereInput
  }
}

/**
 * Factory to build a type‑safe async filter builder function.
 */
interface BuildFiltersFactoryInput<
  TWhereInput,
  TSchema extends z.ZodType<any>,
> {
  schema: TSchema
  filters: Record<string, Filter<unknown, TWhereInput, z.infer<TSchema>>>
}

/**
 *  Builds a type-safe async filter builder function.
 */
export const buildFiltersFactory = <
  TWhereInput,
  TSchema extends z.ZodType<any>,
>({
  filters,
  schema,
}: BuildFiltersFactoryInput<TWhereInput, TSchema>) => {
  return async (params: z.infer<typeof schema>): Promise<TWhereInput> => {
    const builder = new FilterBuilder<
      TWhereInput,
      typeof filters,
      z.infer<TSchema>
    >(filters, params)

    const keys = Object.keys(params) as Array<keyof typeof params>
    for (const key of keys) {
      if (key in filters) {
        await builder.addFilter(key as keyof typeof filters, params[key])
      }
    }

    return builder.build()
  }
}
