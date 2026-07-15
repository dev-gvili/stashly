import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { createActor } from 'xstate'
import { useSelector } from '@xstate/react'
import selectionMachine from '../../machines/selection/selection.machine'
import {
  getQueryParamArray,
  hasQueryParamValue,
} from '../../utils/query-params'
import { useNavigation } from 'react-router'

// Module-scope actor: single source of truth for selection state.
// Started once at module-load time so every consumer (provider, toolbar,
// item cards) subscribes to the same instance via useSelector.
export const selectionActor = createActor(selectionMachine).start()

const selectContext = (
  s: ReturnType<typeof selectionActor.getSnapshot>
) => s.context

// Public hook — works from any component, no provider required.
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

// Hook to register the current route's item IDs into the actor.
// Call from any route that owns a list of items.
export const useRegisterSelectionItems = (items: string[]) => {
  useEffect(() => {
    selectionActor.send({ type: 'SET_ITEMS', items })
  }, [items])
}

// URL ↔ actor sync. Lives inside SelectionProvider because each route
// owns its own ?selectedItems= param and remounts on navigation.
const useSelectionURLSync = () => {
  let navigation = useNavigation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const context = useSelector(selectionActor, selectContext)
  
  // reset selection on navigation (e.g. when leaving the route)
  useEffect(() => {
    if (location.pathname !== navigation.location?.pathname && navigation.state === 'loading') {
      selectionActor.send({ type: 'UNSELECT_ALL', paramName: context.paramName })
    }
  }, [location, navigation])

  // seed actor from URL on mount
  useEffect(() => {
    const paramCandidates = ['selectedItems', 'ids']
    const found = paramCandidates.find((p) => searchParams.has(p)) ?? 'selectedItems'
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

// Lightweight wrapper that registers a route's items and mounts URL sync.
// No React context — useSelection() reads directly from the module actor,
// so consumers above this in the tree (e.g. AppToolbar) work too.
export const SelectionProvider = ({
  items,
  children,
}: {
  items: string[]
  children: ReactNode
}) => {
  useRegisterSelectionItems(items)
  useSelectionURLSync()
  return <>{children}</>
}
