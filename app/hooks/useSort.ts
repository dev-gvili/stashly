import { useSearchParams } from "react-router";

/**
 * Simple URL-driven sort helper for `orderBy` / `direction` search params.
 * Prefer @link [SortPill](../components/filters/sort-pill.tsx) for the full
 * Stashly sort UI — this hook is the low-level primitive underneath it.
 * Exposes `sortAsc` / `sortDesc` / `sortNone`, each of which rewrites the URL
 * in place (`replace: true`) so sorting doesn't stack history entries.
 *
 * @example
 * // Sort by name ascending
 * const { sortAsc } = useSort()
 * <button onClick={() => sortAsc('name')}>A → Z</button>
 *
 * @example
 * // Sort by size descending
 * const { sortDesc } = useSort()
 * <button onClick={() => sortDesc('size')}>Largest first</button>
 *
 * @example
 * // Clear sorting entirely
 * const { sortNone } = useSort()
 * <button onClick={sortNone}>Default order</button>
 */
export function useSort() {
  let [searchParams, setSearchParams] = useSearchParams();
  const sortDesc = (column: string) => {
    if (searchParams.has("orderBy")) {
      searchParams.delete("orderBy");
      searchParams.delete("direction");
    }
    searchParams.append("orderBy", `${column}`);
    searchParams.append("direction", "desc");
    setSearchParams(searchParams, { replace: true });
  };
  const sortAsc = (column: string) => {
    if (searchParams.has("orderBy")) {
      searchParams.delete("orderBy");
      searchParams.delete("direction");
    }
    searchParams.append("orderBy", `${column}`);
    searchParams.append("direction", "asc");
    setSearchParams(searchParams, { replace: true });
  };
  const sortNone = () => {
    searchParams.delete("orderBy");
    searchParams.delete("direction");
    setSearchParams(searchParams, { replace: true });
  };

  return {
    sortAsc,
    sortDesc,
    sortNone,
  };
}
