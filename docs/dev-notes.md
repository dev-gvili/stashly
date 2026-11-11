# Developer notes

Short notes on the data model and code patterns that the code alone doesn't
make obvious. Conventions for day-to-day work are in `CLAUDE.md` and the
subsystem skills; the full schema profile is
[data_profile_stashly _prisma_schema.md](data_profile_stashly%20_prisma_schema.md).

## Item and its facets

Files, folders and collections are all rows of `Item`
(`prisma/models/item.prisma`), told apart by `type` (`file`, `folder`,
`collection`). Type-specific data lives in one-to-one facet tables keyed by
`itemId` (`prisma/models/facet.prisma` and neighbours): `File` (bucket, key,
mime type, hash), `Folder` (`childCount`, `inclusiveChildCount`), `Image`,
`Video`, `Audio`, `Pdf`, `Markdown`. A collection is an `Item` with
`type = 'collection'`; membership is the `CollectionMember` self-relation.

The folder tree is `Item.parentId`. Item status is `normal`, `archived`,
`trashed`, `locked` or `shared`; `normal` is the live state.

## Counters the database keeps

These columns are written by triggers, never by application code:

| Column | Kept by |
|---|---|
| `Item.size`, `Item.inclusiveSize` on folders | `update_size()`, plus the statement-level `item_status_change` trigger for trash and restore |
| `Folder.childCount`, `Folder.inclusiveChildCount` | `update_child_count()` |
| a collection's `Item.size` | `update_collection_size()`, `sync_item_size_to_collections()` |
| `Quota.used` for uploads | `stashly_charge_upload()` |

`size` counts live descendants only and `inclusiveSize` counts trashed ones
too, so a trashed folder has `size` 0. While the database is busy, uploads go
through the `ItemSizeDelta` / `QuotaDelta` logs and reach their folders within
about 250 ms (`app/.server/size-rollup.ts`). The functions are re-issued with
`CREATE OR REPLACE` across migrations, so an old migration shows an old
definition; the schema profile lists the current one for each. CLAUDE.md →
Development has the rules for tests that read these values.

## Typing patterns

- **Overloads on a discriminant.** `paginate` and `searchFactory`
  (`app/utils/pagination.ts`, `app/utils/search.ts`) take an options object
  that is a discriminated union on `strategy` (`offset` / `cursor` / `stream`),
  and the return type follows it. Separate interfaces merged together don't
  narrow; the union does.
- **`DbDelegate`** stands in for a Prisma model delegate, so the generic
  helpers type-check against any model and can be tested with a plain object.
- **Filters.** One `*.filters.ts` per model in `app/utils/filters/`, built with
  `createFilter` and `buildFiltersFactory`. A schema key without a filter adds
  no constraint, silently; see [search.md](search.md#filters).
- **BigInt.** Sizes and quota values are `BigInt`. JSON has no BigInt, so a
  resource route sends them through an output schema with `z.coerce.number()`
  (CLAUDE.md → Schemas and Types).
