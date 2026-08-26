import React, { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigation, useSearchParams } from 'react-router'
import { useSelector } from '@xstate/react'
import { createActor } from 'xstate'
import selectionMachine from '@/machines/selection/selection.machine'
import { getQueryParamArray, hasQueryParamValue } from '@/utils/query-params'

// Module-scope actor: single source of truth for selection state.
// Started once at module-load time so every consumer (provider, toolbar,
// item cards) subscribes to the same instance via useSelector.
//
// NOTE: this module must never be re-exported through `@/hooks/index.ts` —
// that barrel is eagerly imported, which would start the actor during SSR.
export const selectionActor = createActor(selectionMachine).start()

/**
 * Selector handed to `useSelector` — pulls the whole machine context out of a
 * snapshot. Declared at module scope so its identity is stable across renders;
 * an inline arrow would resubscribe every time.
 *
 * @param s - Snapshot of the module-scope selection actor.
 *
 * @example
 * // Subscribe to the full selection context
 * const context = useSelector(selectionActor, selectContext)
 *
 * @example
 * // Also works against a one-off read
 * selectContext(selectionActor.getSnapshot()).selectedIds
 */
const selectContext = (s: ReturnType<typeof selectionActor.getSnapshot>) =>
  s.context

/**
 * Multi-select state for item lists, backed by the module-scope selection actor.
 * Works from any component — no provider required — and falls back to reading
 * the `?selectedItems=` URL param for callers rendered outside a
 * `<SelectionProvider>`, where URL sync isn't running. Tracks the shift key on
 * mouse-down so the machine can extend a range from the last checked row.
 *
 * @example
 * // Checkbox on an item card
 * const { isChecked, onCheckedChange, onMouseDown } = useSelection()
 * <Checkbox checked={isChecked(item.id)} onMouseDown={onMouseDown}
 *           onCheckedChange={(c) => onCheckedChange(item.id, c)} />
 *
 * @example
 * // Header "select all" tri-state checkbox
 * const { allSelected, someSelected, toggleAll } = useSelection()
 * <Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false}
 *           onCheckedChange={() => toggleAll()} />
 *
 * @example
 * // Bulk action toolbar driven by the current selection
 * const { selectedIds, unselectAll } = useSelection()
 * {selectedIds.length > 0 && (
 *   <Toolbar count={selectedIds.length} onClear={() => unselectAll()} />
 * )}
 */
export const useSelection = () => {
  const context = useSelector(selectionActor, selectContext)
  const [searchParams] = useSearchParams()
  const shiftKeyRef = useRef(false)

  const items = context.items ?? []
  const selectedIds = context.selectedIds ?? []
  const allSelected =
    items.length > 0 && items.every((id) => selectedIds.includes(id))
  const someSelected = selectedIds.length > 0 && !allSelected

  // Prefer actor state; fall back to URL params for callers rendered
  // outside any SelectionProvider (URL sync may not be running).
  const isChecked = useCallback(
    (id: string, paramName: string = 'selectedItems') => {
      if (selectedIds.includes(id)) return true
      return hasQueryParamValue(searchParams, paramName, id)
    },
    [searchParams, selectedIds]
  )

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    shiftKeyRef.current = e.shiftKey
  }, [])

  const onCheckedChange = useCallback(
    (
      id: string,
      checked: boolean | 'indeterminate',
      paramName = 'selectedItems'
    ) => {
      const checkedBool =
        checked === 'indeterminate' ? true : (checked as boolean)
      selectionActor.send({
        type: 'TOGGLE',
        id,
        checked: checkedBool,
        shiftKey: shiftKeyRef.current,
        paramName,
      })
      shiftKeyRef.current = false
    },
    []
  )

  const setLastChecked = useCallback(
    (id: string | null) => selectionActor.send({ type: 'SET_LAST_CHECKED', id }),
    []
  )

  const selectAll = useCallback(
    (paramName?: string) =>
      selectionActor.send({ type: 'SELECT_ALL', paramName }),
    []
  )

  const unselectAll = useCallback(
    (paramName?: string) =>
      selectionActor.send({ type: 'UNSELECT_ALL', paramName }),
    []
  )

  const toggleAll = useCallback(
    (paramName?: string) =>
      selectionActor.send({
        type: allSelected ? 'UNSELECT_ALL' : 'SELECT_ALL',
        paramName,
      }),
    [allSelected]
  )

  return {
    items,
    selectedIds,
    allSelected,
    someSelected,
    lastChecked: context.lastChecked,
    setLastChecked,
    isChecked,
    onMouseDown,
    onCheckedChange,
    selectAll,
    unselectAll,
    toggleAll,
  }
}

/**
 * Registers the current route's item IDs with the selection actor. Call it from
 * any route that owns a list — without it the machine has no universe to select
 * from, so `selectAll` and shift-range selection have nothing to work against.
 *
 * @param items - Item IDs in the order they're rendered; shift-range selection
 *   uses this order.
 *
 * @example
 * // In a folder route that renders a paginated list
 * const { items } = usePagination<StashItem>()
 * useRegisterSelectionItems(items.map((i) => i.id))
 *
 * @example
 * // Memoize the array so the effect doesn't re-fire every render
 * const ids = useMemo(() => items.map((i) => i.id), [items])
 * useRegisterSelectionItems(ids)
 */
export const useRegisterSelectionItems = (items: string[]) => {
  // Keyed on the *contents*, not the array identity. Every call site passes an
  // inline `items.map((i) => i.id)`, which is a fresh array on every render —
  // with `[items]` as the dep this effect re-sent SET_ITEMS each render, the
  // machine's `assign` handed back a new context object, `useSelector` saw a
  // changed snapshot and re-rendered, and the cycle repeated forever. On the
  // trash route that spun `useSelectionURLSync` below into writing the URL over
  // and over, which is what produced hundreds of loader GETs.
  const key = items.join(',')
  useEffect(() => {
    selectionActor.send({ type: 'SET_ITEMS', items: key ? key.split(',') : [] })
  }, [key])
}

/**
 * Two-way sync between the `?selectedItems=` URL param and the selection actor:
 * seeds the actor on mount, writes changes back to the URL, and clears the
 * selection when the route changes.
 *
 * Internal — the only intended caller is `<SelectionProvider>` in
 * `@/components/stash/selection`, because each route owns its own param and
 * remounts on navigation. Exported only so that component can reach it across
 * the module boundary. Never writes the URL mid-navigation, which would
 * interrupt the pending transition and race `usePagination`'s submit.
 *
 * @example
 * // The one intended call site
 * export function SelectionProvider({ children }: PropsWithChildren) {
 *   useSelectionURLSync()
 *   return <>{children}</>
 * }
 *
 * @example
 * // Wrap a route's list so its selection survives a refresh and is shareable
 * <SelectionProvider><FolderGrid items={items} /></SelectionProvider>
 */
export const useSelectionURLSync = () => {
  let navigation = useNavigation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const context = useSelector(selectionActor, selectContext)

  // reset selection on navigation (e.g. when leaving the route)
  useEffect(() => {
    if (
      location.pathname !== navigation.location?.pathname &&
      navigation.state === 'loading'
    ) {
      selectionActor.send({
        type: 'UNSELECT_ALL',
        paramName: context.paramName,
      })
    }
  }, [location, navigation])

  // seed actor from URL on mount
  useEffect(() => {
    const paramCandidates = ['selectedItems', 'ids']
    const found =
      paramCandidates.find((p) => searchParams.has(p)) ?? 'selectedItems'
    const selected = getQueryParamArray(searchParams, found)
    selectionActor.send({ type: 'SET_SELECTED', selected, paramName: found })
  }, [])

  // actor → URL
  useEffect(() => {
    // Never write the URL while a navigation is in flight: the reset effect
    // above clears the actor mid-transition, and a setSearchParams here would
    // interrupt the pending navigation (and race usePagination's submit).
    // Re-runs on idle (navigation.state dep) to sync anything skipped.
    if (navigation.state !== 'idle') return
    // Read the live snapshot, not the render-captured context — on mount the
    // seed effect has already updated the actor but not yet re-rendered, so
    // `context` may still hold the previous route's selection.
    const snapshot = selectionActor.getSnapshot().context
    const param = snapshot.paramName ?? 'selectedItems'
    const selected = snapshot.selectedIds ?? []
    const existing = getQueryParamArray(searchParams, param)
    const eq =
      selected.length === existing.length &&
      selected.every((v) => existing.includes(v))
    if (!eq) {
      // Functional form: build from the latest params so concurrent writers
      // (cursor/take from usePagination) aren't clobbered by a stale snapshot.
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)
          if (selected.length === 0) newParams.delete(param)
          else newParams.set(param, selected.join(','))
          return newParams
        },
        { replace: true }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.selectedIds, context.paramName, navigation.state])

  // URL → actor
  useEffect(() => {
    const param =
      context.paramName ??
      (searchParams.has('selectedItems') ? 'selectedItems' : 'ids')
    const selected = getQueryParamArray(searchParams, param)
    const current = context.selectedIds ?? []
    const eq =
      selected.length === current.length &&
      selected.every((v) => current.includes(v))
    if (!eq) {
      selectionActor.send({ type: 'SET_SELECTED', selected, paramName: param })
    }
  }, [searchParams])
}
