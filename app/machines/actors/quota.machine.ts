import { createMachine, sendTo, assign, setup } from 'xstate'
import type { UserQuota } from './types'

export interface QuotaContext {
  userId: string
  quota: UserQuota
}
type QuotaEvent =
  | { type: 'CHECK_QUOTA'; requiredSpace: number; fileId: string }
  | { type: 'UPDATE_QUOTA'; delta: number }
  | { type: 'PLAN_CHANGED'; newPlan: UserQuota['plan'] }

export const quotaMachine = setup({
  types: {
    context: {} as QuotaContext,
    events: {} as QuotaEvent,
    input: {} as { userId: string },
  },
}).createMachine({
  id: 'quota-manager',
  context: ({ input }) => ({
    userId: input.userId,
    quota: {
      userId: input.userId,
      totalSpace: 100 * 1024 * 1024,
      usedSpace: 30 * 1024 * 1024,
      freeSpace: 70 * 1024 * 1024,
      plan: 'free',
    },
  }),
  initial: 'ready',
  states: {
    ready: {
      on: {
        CHECK_QUOTA: {
          actions: [
            sendTo(
              ({ system }) => system.get('upload-queue'),
              ({ context, event }) => {
                const requiredSpace = event.requiredSpace || 0
                const hasSpace = context.quota.freeSpace >= requiredSpace

                if (hasSpace) {
                  // Create and register multipart actor
                  return {
                    type: 'START_UPLOAD',
                    fileId: event.fileId,
                  }
                } else {
                  return {
                    type: 'SKIP_UPLOAD',
                    fileId: event.fileId,
                  }
                }
              }
            ),
          ],
        },
        UPDATE_QUOTA: {
          actions: [
            assign({
              quota: ({ context, event }) => {
                const newUsedSpace = context.quota.usedSpace + event.delta
                const newFreeSpace = context.quota.totalSpace - newUsedSpace

                return {
                  ...context.quota,
                  usedSpace: newUsedSpace,
                  freeSpace: newFreeSpace,
                }
              },
            }),
          ],
        },
      },
    },
  },
})
