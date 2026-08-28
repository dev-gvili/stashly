import { useCallback, useMemo, useState } from 'react'
import { resolveByRule } from './duplicate-helpers'
import type {
  DuplicateGroup,
  DuplicateTriageViewProps,
  ResolveRule,
} from './types'

interface HistoryEntry {
  index: number
  groupId: string | null
  reclaimedBytes: number
}

/**
 * Triage state: one group at a time, a rule that seeds the selection, and a
 * history so "previous group" also un-queues whatever that group decided.
 *
 * Selection is a Set of item ids per group rather than a single index — several
 * copies can legitimately be worth keeping (a raw original and a web export),
 * and the last remaining keeper cannot be unchecked, so a group can never
 * resolve to nothing.
 */
export function useDuplicateTriage({
  groups,
  initialRule = 'filed',
  onResolveGroup,
  onFinish,
}: Pick<
  DuplicateTriageViewProps,
  'groups' | 'initialRule' | 'onResolveGroup' | 'onFinish'
>) {
  const [rule, setRuleState] = useState<ResolveRule>(initialRule)
  const [index, setIndex] = useState(0)
  const [selection, setSelection] = useState<Record<string, string[]>>({})
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [reclaimed, setReclaimed] = useState<Record<string, number>>({})

  const group: DuplicateGroup | undefined = groups[index]

  const seeded = useMemo(
    () => (group ? [resolveByRule(group, rule).item.id] : []),
    [group, rule]
  )
  const kept = group ? (selection[group.id] ?? seeded) : []

  const isKept = useCallback((itemId: string) => kept.includes(itemId), [kept])

  const toggleKeep = useCallback(
    (itemId: string) => {
      if (!group) return
      setSelection((current) => {
        const existing = current[group.id] ?? seeded
        const next = existing.includes(itemId)
          ? existing.filter((id) => id !== itemId)
          : [...existing, itemId]
        // Never allow an empty keep set.
        return { ...current, [group.id]: next.length > 0 ? next : existing }
      })
    },
    [group, seeded]
  )

  /** Changing the rule re-seeds every group the user has not touched yet. */
  const setRule = useCallback((next: ResolveRule) => {
    setRuleState(next)
    setSelection({})
  }, [])

  const dropped = group
    ? group.copies.filter((copy) => !kept.includes(copy.item.id))
    : []
  // `Item.size` is a bigint on the server model, so coerce before summing —
  // mixing bigint into a number accumulator throws at runtime.
  const droppedBytes = dropped.reduce(
    (total, copy) => total + Number(copy.item.size ?? 0),
    0
  )

  const advance = useCallback(
    (entry: HistoryEntry) => {
      setHistory((current) => [...current, entry])
      if (entry.groupId)
        setReclaimed((current) => ({
          ...current,
          [entry.groupId!]: entry.reclaimedBytes,
        }))
      if (index + 1 >= groups.length) onFinish?.()
      setIndex((current) => Math.min(groups.length - 1, current + 1))
    },
    [groups.length, index, onFinish]
  )

  const keepSelection = useCallback(() => {
    if (!group) return
    if (dropped.length > 0) {
      onResolveGroup?.({
        groupId: group.id,
        keptItemIds: kept,
        deletedItemIds: dropped.map((copy) => copy.item.id),
      })
    }
    advance({
      index,
      groupId: dropped.length > 0 ? group.id : null,
      reclaimedBytes: droppedBytes,
    })
  }, [advance, dropped, droppedBytes, group, index, kept, onResolveGroup])

  const nextGroup = useCallback(() => {
    advance({ index, groupId: null, reclaimedBytes: 0 })
  }, [advance, index])

  const previousGroup = useCallback(() => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((current) => current.slice(0, -1))
    setIndex(last.index)
    if (last.groupId) {
      setReclaimed((current) => {
        const next = { ...current }
        delete next[last.groupId!]
        return next
      })
    }
  }, [history])

  return {
    rule,
    setRule,
    group,
    index,
    total: groups.length,
    kept,
    isKept,
    toggleKeep,
    selectedCount: kept.length,
    droppedCount: dropped.length,
    reclaimedBytes: Object.values(reclaimed).reduce(
      (total, value) => total + value,
      0
    ),
    canGoBack: history.length > 0,
    keepSelection,
    nextGroup,
    previousGroup,
  }
}
