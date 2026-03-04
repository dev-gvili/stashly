import { useSearchParams } from "react-router";

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
