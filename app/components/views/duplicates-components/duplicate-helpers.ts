import type { DuplicateCopy, DuplicateGroup, ResolveRule } from './types'

export const RESOLVE_RULES: { id: ResolveRule; label: string; hint: string }[] =
  [
    {
      id: 'newest',
      label: 'Keep newest',
      hint: 'Most recently modified copy wins',
    },
    {
      id: 'original',
      label: 'Keep original',
      hint: 'Earliest added — the copy others came from',
    },
    {
      id: 'filed',
      label: 'Keep filed copy',
      hint: 'Prefer a sorted folder over Downloads or Desktop',
    },
  ]

/** Folders that collect files by accident rather than by intent. */
const LOOSE_ROOTS = ['downloads', 'desktop', 'inbox']

export function isLooseFolder(folderPath: string) {
  const root = folderPath.split('/')[0]?.toLowerCase() ?? ''
  return LOOSE_ROOTS.includes(root)
}

const RULE_SCORE: Record<ResolveRule, (copy: DuplicateCopy) => number> = {
  newest: (copy) => Date.parse(copy.modifiedAt),
  original: (copy) => -Date.parse(copy.addedAt),
  // Prefer a sorted folder; among equals prefer the earliest arrival.
  filed: (copy) =>
    (isLooseFolder(copy.folderPath) ? 0 : 1e12) -
    Date.parse(copy.addedAt) / 1e6,
}

/**
 * The copy a rule would keep. Used only to seed the selection — an explicit
 * tap always wins, and the user may keep several copies.
 */
export function resolveByRule(
  group: DuplicateGroup,
  rule: ResolveRule
): DuplicateCopy {
  const score = RULE_SCORE[rule] ?? RULE_SCORE.filed
  return group.copies.reduce(
    (best, copy) => (score(copy) > score(best) ? copy : best),
    group.copies[0]
  )
}

export const RISK_LABEL: Record<DuplicateGroup['risk'], string> = {
  exact: 'Exact copy',
  near: 'Same file, different rendition',
  conflict: 'Contents differ',
}
