import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  useLoaderData,
  useLocation,
  useNavigation,
  useParams,
  useSearchParams,
  useSubmit,
} from 'react-router'
import { sessionService } from '../machines/session/sessionStorage.machine'
import { useSelector } from '@xstate/react'

// Generic type ensuring items have an ID for deduplication
export interface Identifiable {
  id: string
}

// The composite cursor type used by getFolderContent
export interface CompositeCursor {
  id: string
  name: string
}

// The expected shape of the data returned by the server loader (first page/subsequent pages)
export interface LoaderData<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Cursor-based infinite scroll pagination for any route loader that returns
 * `{ items, nextCursor, hasMore }`. Uses `useLoaderData` for the first page and
 * `useSubmit` (GET) to append subsequent pages via URL cursor params.
 * Resets the accumulated list automatically when filters/sort params change.
 *
 * @param limit - Items per page (default 100).
 * @param action - Loader URL to submit to (default: current route).
 * @returns `{ items, nextCursor, loadMore, isLoading, hasMore, error }`.
 *
 * @example
 * // Basic usage in a route component
 * const { items, loadMore, hasMore, isLoading } = usePagination<StashItem>(50)
 * return <>
 *   {items.map(item => <ItemCard key={item.id} {...item} />)}
 *   {hasMore && <button onClick={loadMore} disabled={isLoading}>Load more</button>}
 * </>
 *
 * @example
 * // With LoadMoreItems button component
 * const { items, loadMore, hasMore, isLoading } = usePagination<StashItem>()
 * return <><GridLayout items={items} /><LoadMoreItems hasMore={hasMore} onLoad={loadMore} /></>
 *
 * @example
 * // The loader must return the expected shape:
 * // return { items, nextCursor: lastItem?.id ?? null, hasMore: items.length === limit }
 */
export function usePagination<T extends Identifiable>(
  /** 
   * Optional limit for items per page; defaults to 100 
  */
  limit: number = 100,
  /**
   * Optional action URL for the useSubmit; defaults to current route.
   */
  action: string = '',

  initData?: LoaderData<T>["items"] // Optional initial data for better type inference
) {
  // Get initial data from the current route loader
  const initialData = useLoaderData() as LoaderData<T>
  // Get the current URL search params.
  const [searchParams] = useSearchParams()
  // Hooks for navigation and submission
  const submit = useSubmit()
  const location = useLocation()
  // Track loading more items state by monitoring navigation state
  const navigation = useNavigation()
  // Get current route params
  const routeParams = useParams()
  // State for concatenated items
  const [items, setItems] = useState<T[]>(initData || initialData.items)
  // State for the next cursor
  const [nextCursor, setNextCursor] = useState<string | null>(initialData.nextCursor)
  // State for error handling
  const [error, setError] = useState<Error | null>(null)
  // State to track if we have reached the end of the list
  const [hasMore, setHasMore] = useState(initialData.hasMore)

  // Ref to store the current items to handle cleanup correctly
  let itemsRef = useRef(items)

  // Always keep itemsRef.current up-to-date with the latest items state
  itemsRef.current = items

  // Ref to store the current route params to detect changes
  let routeParamsRef = useRef<typeof routeParams | null>(null)

  /**
   * Compute filterKey from searchParams
   * The 'filterKey' represents the base URL search params that track filtering/sorting,
   * If this string changes, it means a filter/sort has changed, and we must update.
   * We exclude any parameter that isn't relevant to filtering/sorting.
   */
  const filterKey = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    // Remove pagination-specific params that shouldn't trigger a reset
    params.delete('cursor')
    params.delete('take')
    // If you have selectedItems in the URL, we should ignore them for the filterKey
    params.delete('selectedItems')
    // any other params to exclude can be deleted here, uncomment and modify as needed
    // params.delete('anotherParamToExclude');
    return params.toString()
  }, [searchParams])

  // Ref to store the filterKey that was used to render the current `items` state.
  const currentFilterRef = useRef(filterKey)

  // Generate a ssesion storage uniqe key for that "page" request
  const storageKey = `pagination_${location.pathname}${location.search}`

  // Helper to deduplicate items based on ID
  const addUniqueItems = useCallback((newItems: T[]) => {
    setItems((currentItems) => {
      const existingIds = new Set(currentItems.map((item) => item.id))
      const uniqueNewItems = newItems.filter(
        (item) => !existingIds.has(item.id)
      )
      return [...currentItems, ...uniqueNewItems]
    })
  }, [])

  // // If the storgeKey changed or first time mount ( usally after we recived the loaderData successful )
  // useEffect(() => {
  //   // check that we are on the client / browser side ( not server )
  //   // if (typeof window === "undefined") return;
  //   try {
  //     sessionService.send({
  //       type: 'read',
  //       key: storageKey,
  //     })
  //     // trying to load saved items from the session storage
  //     const savedItems = useSelector(sessionService, (state) => state.value)
  //     // const savedItems = sessionStorage.getItem(storageKey);
  //     if (savedItems) {
  //       // if we have saved items for that storageKey load / parse / set them as the initial loaded items
  //       const parsed = JSON.parse(savedItems)
  //       if (Array.isArray(parsed)) {
  //         setItems(parsed)
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Failed to read from session storage', error)
  //   }
  // }, [storageKey, location, searchParams])

  // useEffect(() => {
  //   // This replacer handles BigInt values during JSON serialization, converting them to strings.
  //   const replacer = (key: string, value: any) => {
  //     if (typeof value === 'bigint') {
  //       return value.toString()
  //     }
  //     return value
  //   }

  //   return () => {
  //     // This cleanup function runs when the component unmounts or storageKey changes.
  //     if (typeof window === 'undefined') return
  //     try {
  //       // It attempts to save the current items to session storage.
  //       const dataToStore = JSON.stringify(items, replacer);
  //       sessionService.send({
  //         type: "write",
  //         key: storageKey,
  //         value: dataToStore,
  //       });
  //       // sessionStorage.setItem(storageKey, dataToStore);
  //     } catch (error) {
  //       console.error('Failed to save to session storage', error)
  //     }
  //   }
  // }, [storageKey, location, searchParams])
  
  /**
   * Reset on Folder Change
   * If the folderId route param changes, we reset the pagination state.
   * This is important when navigating between different folders,
   * ensuring that items from the previous folder do not persist.
   */
  useEffect(() => {
    if (
      routeParams.folderId &&
      routeParams.folderId !== routeParamsRef.current?.folderId
    ) {
      routeParamsRef.current = routeParams
      setItems(initialData.items)
      setNextCursor(initialData.nextCursor)
      setHasMore(initialData.hasMore)
      return
    }
  }, [location, routeParams])

  /**
   * RESET LOGIC (triggered by location.state changes)
   * If location.state has _isRedirect or reset flag, we reset to initial loader data.
   * This handles cases where navigation causes a full reset of the pagination state,
   * such as after redirects or explicit resets.
   */
  useEffect(() => {
    if (
      location.state?._isRedirect || // react-router built-in state flag to indicate redirect
      location.state?.reset // custom state flag to force reset
    ) {
      setItems(initialData.items)
      setNextCursor(initialData.nextCursor)
      setHasMore(initialData.hasMore)
      return
    }
  }, [location])

  /**
   * Merge or Reset on searchParams change
   * If the filterKey changes (indicating a filter/sort change),
   * we either reset the items (if filterKey changed) or merge new items
   * (if filterKey is the same, indicating pagination load).
   */
  useEffect(() => {
    // If the filterKey has changed, we reset to initial loader data.
    if (
      filterKey !== currentFilterRef.current &&
      !location.state?._isRedirect &&
      !location.state?.reset
    ) {
      currentFilterRef.current = filterKey
      setItems(initialData.items)
      setNextCursor(null)
      setHasMore(initialData.hasMore)
      return
    }

    // If the filterKey is the same, we are loading more items for the same filter, so we merge.
    if (filterKey === currentFilterRef.current) {
      addUniqueItems(initialData.items)
      setNextCursor(initialData.nextCursor)
      setHasMore(initialData.hasMore)
    }
  }, [searchParams, location])

  /**
   * loadMore function
   * Constructs the new URL with the cursor and submits a GET request to the loader.
   */
  const loadMore = useCallback(() => {
    // Prevent fetching if already loading or if there is no more data
    if (!initialData.nextCursor || navigation.state !== 'idle') return

    // Clear any previous errors
    setError(null)

    try {
      // 1. Get current search parameters
      const params = new URLSearchParams(searchParams)

      // 2. Add cursor parameters for the next page
      params.set('cursor', initialData.nextCursor)

      // 3. Set the limit for the next fetch
      params.set('take', limit.toString())

      // 4. Use useSubmit to trigger the loader with the updated params
      // This performs a "GET" against the current route's loader.
      submit(params, { method: 'GET', action: action, replace: true, })
    } catch (err) {
      console.error('Pagination Error:', err)
      setError(
        err instanceof Error ? err : new Error('Failed to load more items')
      )
    }
  }, [searchParams, location])

  return {
    items, // The concatenated list of unique items
    nextCursor, // The cursor for the next fetch request
    loadMore, // Function to trigger the next fetch
    isLoading: navigation.state === 'loading', // Loading state indicator
    hasMore, // Boolean indicating if more items are available
    error, // Error object if fetch fails
  }
}
