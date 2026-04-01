import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { useSearchParams } from 'react-router'
import { useMachine } from '@xstate/react'
import selectionMachine from '../../machines/selection/selection.machine'
import {
  addQueryParamValue,
  getQueryParamArray,
  hasQueryParamValue,
  removeQueryParamValue,
} from '../../utils/query-params'

type SelectionContextType = {
  items: string[]
  lastChecked: string | null
  setLastChecked: (id: string | null) => void
  isChecked: (id: string, paramName?: string) => boolean
  onMouseDown: (e: React.MouseEvent) => void
  onCheckedChange: (
    id: string,
    checked: boolean | 'indeterminate',
    paramName?: string
  ) => void
}

const SelectionContext = createContext<SelectionContextType | undefined>(
  undefined
)

export const SelectionProvider = ({
  items,
  children,
}: {
  items: string[]
  children: ReactNode
}) => {
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const shiftKeyRef = useRef(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // XState machine to compute selection changes
  const [state, send] = useMachine(selectionMachine)

  // keep machine items in sync
  useEffect(() => {
    send({ type: 'SET_ITEMS', items })
  }, [items, send])

  // detect initial selection param name (prefer 'selectedItems' then 'ids')
  useEffect(() => {
    const paramCandidates = ['selectedItems', 'ids']
    const found = paramCandidates.find((p) => searchParams.has(p)) ?? 'ids'
    const selected = getQueryParamArray(searchParams, found)
    send({ type: 'SET_SELECTED', selected, paramName: found })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // when machine selection changes, reflect it to URL search params
  useEffect(() => {
    const param = state.context.paramName ?? 'ids'
    const selected = state.context.selectedIds ?? []
    const existing = getQueryParamArray(searchParams, param)
    const eq =
      selected.length === existing.length &&
      selected.every((v) => existing.includes(v))
    if (!eq) {
      const newParams = new URLSearchParams(searchParams)
      if (selected.length === 0) {
        newParams.delete(param)
      } else {
        newParams.set(param, selected.join(','))
      }
      setSearchParams(newParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.context.selectedIds, state.context.paramName])

  // when URL params change externally, sync to machine
  useEffect(() => {
    const param = state.context.paramName ??
      (searchParams.has('selectedItems') ? 'selectedItems' : 'ids')
    const selected = getQueryParamArray(searchParams, param)
    const current = state.context.selectedIds ?? []
    const eq =
      selected.length === current.length &&
      selected.every((v) => current.includes(v))
    if (!eq) {
      send({ type: 'SET_SELECTED', selected, paramName: param })
    }
  }, [searchParams])

  const isChecked = useCallback(
    (id: string, paramName = 'selectedItems') => {
      // prefer machine state, fall back to URL params
      const inMachine = state.context.selectedIds?.includes(id)
      if (inMachine) return true
      return hasQueryParamValue(searchParams, paramName, id)
    },
    [searchParams, state.context.selectedIds]
  )

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    shiftKeyRef.current = e.shiftKey
  }, [shiftKeyRef])

  const onCheckedChange = useCallback(
    (
      id: string,
      checked: boolean | 'indeterminate',
      paramName = 'selectedItems'
    ) => {
      const checkedBool = checked === 'indeterminate' ? true : (checked as boolean)
      send({ type: 'TOGGLE', id, checked: checkedBool, shiftKey: shiftKeyRef.current, paramName })
      shiftKeyRef.current = false
    },
    [send]
  )

  return (
    <SelectionContext.Provider
      value={{
        items,
        lastChecked,
        setLastChecked,
        isChecked,
        onMouseDown,
        onCheckedChange,
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export const useSelection = () => useContext(SelectionContext)
