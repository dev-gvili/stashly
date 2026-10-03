/**
 * Fails when any state in the thumbnail machines has no `description`.
 *
 * Same check as `app/machines/indexing/__tests__/state-descriptions.test.ts`:
 * descriptions are what the Stately editor shows next to each state, and
 * without them the chart names a state but not what it does or why.
 */
import { describe, it, expect } from 'vitest'
import type { AnyStateMachine } from 'xstate'
import { thumbnailItemMachine } from '../thumbnail-item.machine'
import { thumbnailManagerMachine } from '../thumbnail-manager.machine'

interface StateNodeLike {
  path: string[]
  description?: string
  states: Record<string, StateNodeLike>
}

/** Every state path in the machine whose description is missing or blank. */
function statesWithoutDescription(machine: AnyStateMachine): string[] {
  const missing: string[] = []
  const walk = (node: StateNodeLike) => {
    if (!node.description?.trim()) missing.push(node.path.join('.') || '(root)')
    Object.values(node.states).forEach(walk)
  }
  walk(machine.root as unknown as StateNodeLike)
  return missing
}

describe('state descriptions', () => {
  it.each([
    ['thumbnailItem', thumbnailItemMachine],
    ['thumbnailManager', thumbnailManagerMachine],
  ] as const)('every state in %s has a description', (_, machine) => {
    expect(statesWithoutDescription(machine)).toEqual([])
  })
})
