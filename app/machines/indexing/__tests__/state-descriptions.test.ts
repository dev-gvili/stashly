/**
 * Fails when any state in the indexing machines has no `description`.
 *
 * Descriptions are what the Stately editor shows next to each state; without
 * them the chart says what a state is called but not what it does or why. This
 * keeps that from eroding as states are added. The thumbnail machines have
 * their own copy of this check in `app/machines/thumbnail/__tests__/`.
 */
import { describe, it, expect } from 'vitest'
import { createMachine, type AnyStateMachine } from 'xstate'
import { indexingItemMachine } from '../indexing-item.machine'
import { indexingQueueMachine } from '../indexing-queue.machine'

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
  it('reports a nested state with no description', () => {
    const machine = createMachine({
      description: 'root',
      initial: 'a',
      states: {
        a: { description: 'has one', initial: 'b', states: { b: {} } },
      },
    })

    expect(statesWithoutDescription(machine)).toEqual(['a.b'])
  })

  it.each([
    ['indexingItem', indexingItemMachine],
    ['indexingQueue', indexingQueueMachine],
  ] as const)('every state in %s has a description', (_, machine) => {
    expect(statesWithoutDescription(machine)).toEqual([])
  })
})
