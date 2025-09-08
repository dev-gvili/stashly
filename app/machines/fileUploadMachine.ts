import { assign, spawnChild, setup, type ActorRefFrom } from 'xstate'
import { multipartActor } from './multipartActor'

export interface FileCtx {
	file: File
	progress: number
	error?: string
	bucket: string
	actor?: ActorRefFrom<typeof multipartActor>
}

export type FileEvt =
	| { type: 'START'; file: File }
	| { type: 'PAUSE' }
	| { type: 'RESUME' }
	| { type: 'PROGRESS'; progress: number }
	| { type: 'DONE' }
	| { type: 'FAIL'; error: string }
	| { type: 'CANCEL' }
	| { type: 'RETRY' }

export const fileMachine = setup({
	types: {
		context: {} as FileCtx,
		events: {} as FileEvt,
		input: {} as { bucket: string, userId: string, file: File },
	},
	actors: {
		multipartActor,
	},
	actions: {
		spawnMultipart: assign(({ context, spawn }) => {
			const actor = spawn('multipartActor', {
				id: context.file.name,
				input: {
					file: context.file,
					bucket: context.bucket,
					key: context.file.name,
					// mediaFile: context.
					chunkSize: 5 * 1024 * 1024, // 5 MB per part
				},
			})
			return { actor }
		}),

		stopMultipart: ({ context }) => {
			context.actor?.send({ type: 'abort' })
		},
	},
}).createMachine({
	/** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMBVADug9gIYQB0qEmAxAMoAqAggEq0DaADALqKg76yoAXVPgB23EAA9EARgBs0kmwCcs2QCZpAVjYAOHbJ1q1AGhABPRAGYALDsW3N1gOyW2beZqUBfL6bSZcAmISAFc8IghUEShKAAVGAHkAcUYAUWpqdi4kEF5+IVFxKQRLaWtFNRtZFzY1JSdpaVMLBDVHRTYnNU63Nkb5Sx8-DGxw4LCgyOjKABEEgDlUrPE8wWExHOLNSztDNqN9DWdmmR1yw2qG2VrDSx2hkH9RydCxqZiAMXoASQAZZZyqwKG1AWx2JD2mgO6jKThOCGsuhImhRTjOTlkKLUlweT0CEVekyiMVi9Cw1CWnBWfDWhU2iG2uyMULUh1h8OkrhI1VK1mxSj6bFcalxI3x4zexMoAGF6PNpal-lTATTgUUGeDIdCjnDzFY2JoSLzrCadkpujtZKKAm8SDhCCFYJBKGlqFgALKU7I8VXrdUIRkQ5na9l6hA6BSVbbqDw2PpW3yPMW2+2O52y+WKgE+-J++nh6R2OR1VQ6eqOeQctqKAVyawxpR3TrW54E5CEDAhABOYBdqVojAAmtncr66aCGVCSPWUbJzTtrJpZPDLJ4SI0dG56wKMZYlNYfImRPgIHBxHi3tTc+PJIgALTLsN3w1KV9KHTbaSstT1tROFviqQ5CYFetIgreCImGGlhOGw3LKO4pTVEo0hOJoAG2hMETEqBar5n+Cj6Jy7ieN0mi6i0q6WNy2LEYYaHmv+iYXi8qZOhAuF5hOCA8tOCFltUZRCo+LRfoa7h9N0zi2GwM4YS8sAhAAxkpcDwCq17gcUqjUbosnyBGf6qJoHI6NRqLvnojI-nc8lth26DdmAnE3tpsi6Zu9aFl+GKYvCfKGtsdw2HymIfn+dnBEphAiKp6CYBxGlgf6+6ESaTgZRlMGbhRiAlkaZmcku7kaOo6GHkAA */
	id: 'fileUpload',
	initial: 'idle',
	context: ({ input }) => ({
		file: input.file,
		bucket: input.bucket,
		progress: 0,
		userId: input.userId,
	}),
	states: {
		idle: {
			on: {
				START: {
					target: 'uploading',
					actions: assign({
						file: ({ event }) => event.file,
						progress: () => 0,
					}),
				},
			},
		},

		uploading: {
			entry: 'spawnMultipart',
			exit: 'stopMultipart',
			on: {
				PROGRESS: {
					actions: assign({
						progress: ({ event }) => event.progress,
					}),
				},
				DONE: 'success',
				FAIL: {
					target: 'failure',
					actions: assign({
						error: ({ event }) => event.error,
					}),
				},
				PAUSE: 'paused',
				CANCEL: 'cancelled',
			},
		},

		paused: {
			on: {
				RESUME: 'uploading',
				CANCEL: 'cancelled',
			},
		},

		success: { type: 'final' },

		failure: {
			on: { RETRY: 'uploading' },
		},

		cancelled: { type: 'final' },
	},
})
