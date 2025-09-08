import { assertEvent, setup } from 'xstate'
import type { QuotaContext, QuotaEvents, QuotaOutput } from './machine.types'
import { verifyQuota, findQuota, updateQuota } from './quota.actors'

export const quotaMachine = setup({
	types: {
		context: {} as QuotaContext,
		events: {} as QuotaEvents,
		output: {} as QuotaOutput,
	},
	actions: {
		assignQuota: (_, params: { quota: QuotaOutput['quota'] }) => ({
			quota: params.quota,
		}),
		assignError: (_, params: { error: Error }) => ({
			error: params.error,
		}),
	},
	actors: {
		check: verifyQuota,
		find: findQuota,
		update: updateQuota,
	},
}).createMachine({
	id: 'quota',
	context: {
		quota: {
			driveId: '',
			id: '',
			deleted: BigInt(0),
			total: BigInt(0),
			used: BigInt(0),
			remaining: BigInt(0),
			state: 'normal',
		},
		error: undefined,
	},
	initial: 'idle',
	states: {
		idle: {
			on: {
				'@quota.check': {
					target: 'check',
				},
				'@quota.find': {
					target: 'find',
				},
				'@quota.update': {
					target: 'update',
				},
			},
		},
		check: {
			invoke: {
				id: '@stashly.quota.check',
				src: 'check',
				input: ({ event }) => {
					assertEvent(event, '@quota.check')
					return { ...event }
				},
				onDone: {
					target: 'success',
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
						params: ({ event }) => ({
							error: event.error as Error,
						}),
					},
				},
			},
		},
		find: {
			invoke: {
				id: '@stashly.quota.find',
				src: 'find',
				input: ({ event }) => {
					assertEvent(event, '@quota.find')
					return { ...event }
				},
				onDone: {
					target: 'success',
					actions: {
						type: 'assignQuota',
						params: ({ event }) => ({ quota: event.output }),
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
						params: ({ event }) => ({
							error: event.error as Error,
						}),
					},
				},
			},
		},
		update: {
			invoke: {
				id: '@stashly.quota.update',
				src: 'update',
				input: ({ event }) => {
					assertEvent(event, '@quota.update')
					return { ...event }
				},
				onDone: {
					target: 'success',
					actions: {
						type: 'assignQuota',
						params: ({ event }) => ({ quota: event.output }),
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
						params: ({ event }) => ({
							error: event.error as Error,
						}),
					},
				},
			},
		},
		success: {
			always: {
				target: 'idle',
			},
		},
		error: {
			always: {
				target: 'idle',
			},
		},
	},
})
