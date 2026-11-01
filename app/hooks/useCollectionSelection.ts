import { useCallback, useEffect, useState } from 'react'

/**
 * Selection set for a list of ids. Ids that leave the list (removed, filtered
 * out) are dropped from the selection, and Escape clears it unless a dialog or
 * menu is open, so those close first.
 *
 * @param ids Memoized list of selectable ids.
 *
 * @example
 * const sel = useCollectionSelection(ids)
 * sel.toggle('itm_1'); sel.selectAll(); sel.clear()
 */
export function useCollectionSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const live = new Set(ids)
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [ids])

  const isSelecting = selected.size > 0

  useEffect(() => {
    if (!isSelecting) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'))
        return
      setSelected(new Set())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSelecting])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])
  const selectAll = useCallback(() => setSelected(new Set(ids)), [ids])

  return {
    selected,
    count: selected.size,
    isSelecting,
    allSelected: ids.length > 0 && selected.size === ids.length,
    toggle,
    clear,
    selectAll,
  }
}
