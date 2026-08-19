import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  addQueryParamValue,
  getQueryParamArray,
  hasQueryParam,
  removeQueryParam,
} from '@/utils'
import {
  MULTI_KEYS,
  FLAG_KEYS,
  QUERY_KEY,
  SEARCH_MODE_KEY,
  CURSOR_KEY,
  CATEGORIES,
  STATUSES,
  TYPES,
} from '@/utils/filter-data'
import type {
  ActiveChip,
  FilterSourceKey,
  FilterState,
  FilterToggleKey,
  FlagKey,
  SearchMode,
  UseFilters,
} from '@/types/filter.types'

const SOURCE_LOOKUP: Record<FilterSourceKey, typeof CATEGORIES> = {
  category: CATEGORIES,
  status: STATUSES,
  type: TYPES,
}

/**
 * Derives a `FilterState` snapshot from URL search params.
 * Multi-select keys (`category`, `status`, `type`) are comma-separated single params.
 * Flag keys (`locked`, `favorited`) are presence-based (`?favorited=true`).
 *
 * @example
 * readState(new URLSearchParams('category=image,pdf&favorited=true'))
 * // → { category: ['image', 'pdf'], status: [], type: [], flags: ['favorited'], query: '', searchMode: 'fuzzy' }
 */
export function readState(searchParams: URLSearchParams): FilterState {
  const state: FilterState = {
    category: [],
    status: [],
    type: [],
    flags: [],
    query: '',
    searchMode: 'fuzzy',
  }
  MULTI_KEYS.forEach((k) => {
    const param = searchParams.get(k)
    state[k] = param ? param.split(',').filter(Boolean) : []
  })
  FLAG_KEYS.forEach((f) => {
    if (searchParams.has(f)) state.flags.push(f)
  })
  state.query = searchParams.get(QUERY_KEY) ?? ''
  const mode = searchParams.get(SEARCH_MODE_KEY)
  state.searchMode = mode === 'semantic' ? 'semantic' : 'fuzzy'
  return state
}

/**
 * URL-driven filter state hook for the stash item list.
 * All state lives in the URL — shareable and survives page refreshes.
 * Every mutation automatically drops the `cursor` param to reset pagination.
 *
 * @returns A `UseFilters` object with state + mutation helpers + derived `chips`.
 *
 * @example
 * // Toggle a category filter on/off
 * const { toggleMulti } = useFilters()
 * <button onClick={() => toggleMulti('category', 'image')}>Images</button>
 *
 * @example
 * // Switch search mode between fuzzy and semantic
 * const { state, setSearchMode } = useFilters()
 * <Toggle pressed={state.searchMode === 'semantic'} onPressedChange={(on) => setSearchMode(on ? 'semantic' : 'fuzzy')} />
 *
 * @example
 * // Render active chips (icon + label) without re-deriving in the component
 * const { chips } = useFilters()
 * {chips.map((c) => <Chip key={c.key}>{c.icon && <c.icon />}{c.label}</Chip>)}
 */
export function useFilters(): UseFilters {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => readState(searchParams), [searchParams])

  const mutate = (fn: (params: URLSearchParams) => URLSearchParams | void) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        fn(next)
        next.delete(CURSOR_KEY)
        return next
      },
      { replace: true }
    )

  const toggleMulti = (key: FilterToggleKey, val: string) =>
    mutate((p) => {
      if (FLAG_KEYS.includes(key as FlagKey) || key === 'flags') {
        const flag = key === 'flags' ? val : key
        hasQueryParam(p, flag)
          ? removeQueryParam(p, flag)
          : addQueryParamValue(p, flag, 'true')
        return
      }
      const current = getQueryParamArray(p, key) ?? []
      const next = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val]
      next.length > 0 ? p.set(key, next.join(',')) : p.delete(key)
    })

  const setMulti = (key: FilterToggleKey, vals: string[]) =>
    mutate((p) => {
      if (key === 'flags') {
        FLAG_KEYS.forEach((f) => removeQueryParam(p, f))
        vals.forEach((f) => addQueryParamValue(p, f, 'true'))
        return
      }
      p.delete(key)
      if (vals.length > 0) p.set(key, vals.join(','))
    })

  const applyDraft = (draft: Pick<FilterState, FilterSourceKey>) =>
    mutate((p) => {
      MULTI_KEYS.forEach((k) => {
        p.delete(k)
        if (draft[k].length > 0) p.set(k, draft[k].join(','))
      })
    })

  const clear = (key: FilterToggleKey) =>
    mutate((p) => {
      if (key === 'flags') {
        FLAG_KEYS.forEach((f) => p.delete(f))
        return
      }
      p.delete(key)
    })

  const clearAll = () =>
    mutate((p) => {
      ;[...MULTI_KEYS, ...FLAG_KEYS, QUERY_KEY].forEach((k) => p.delete(k))
    })

  const setQuery = (q: string) =>
    mutate((p) => {
      if (q) p.set(QUERY_KEY, q)
      else p.delete(QUERY_KEY)
    })

  const setSearchMode = (mode: SearchMode) =>
    mutate((p) => {
      if (mode === 'fuzzy') p.delete(SEARCH_MODE_KEY)
      else p.set(SEARCH_MODE_KEY, mode)
    })

  const chips: ActiveChip[] = useMemo(() => {
    const out: ActiveChip[] = []
    ;(['category', 'status', 'type'] as FilterSourceKey[]).forEach((group) => {
      state[group].forEach((value) => {
        const meta = SOURCE_LOOKUP[group].find((x) => x.id === value)
        out.push({
          key: `${group}-${value}`,
          group,
          value,
          icon: meta?.icon,
          label: meta?.label ?? value,
        })
      })
    })
    return out
  }, [state.category, state.status, state.type])

  const total =
    state.category.length +
    state.status.length +
    state.type.length +
    state.flags.length

  return {
    state,
    toggleMulti,
    setMulti,
    applyDraft,
    clear,
    clearAll,
    setQuery,
    setSearchMode,
    chips,
    total,
    searchParams,
  }
}
