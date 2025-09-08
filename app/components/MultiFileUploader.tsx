import React, { useRef } from 'react'
import { useMachine } from '@xstate/react'
import { fileMachine } from '@/machines/fileUploadMachine'
import { assign, createMachine, type AnyStateMachine } from 'xstate'
import { authClient } from '../services/auth.client'

export function MultiFileUploader() {
	let session = authClient?.useSession()
	if (!session) return
	const fileInput = useRef<HTMLInputElement>(null)
	const [uploads, send] = useMachine(createMachine({
			
				id: 'multi',
				context: {
					files: [] as File[],
					uploadRefs: {} as any,
					userId: session.data?.user.id,
				},
				initial: 'idle',
				states: {
					idle: {
						on: {
							ADD: { actions: 'addFiles' },
							START: 'uploading',
						},
					},
					uploading: {
						entry: 'spawnAll',
						on: { PAUSE_ALL: 'paused', CANCEL_ALL: 'cancelled' },
					},
					paused: {
						on: {
							RESUME_ALL: 'uploading',
							CANCEL_ALL: 'cancelled',
						},
					},
					cancelled: { type: 'final' },
				},
			},
			{
				actions: {
					addFiles: assign({
						files: ({ context, event }) => [
							...context.files,
							...event.files,
						],
					}),
					spawnAll: assign(({ context, spawn }) => {
						const uploadRefs: any = {}
						context.files.forEach((file) => {
							uploadRefs[file.name] = spawn(fileMachine, {
								input: {
									file,
									bucket: session.data?.user.bucket || '',
									userId: context.userId!,
								},
							})
						})
						return { uploadRefs }
					}),
				},
			}
		)
	)

	const onAdd = () => {
		const files = Array.from(fileInput.current!.files!)
		send({ type: 'ADD', files })
	}

	const startAll = () => send({ type: 'START' })
	const pauseAll = () => send({ type: 'PAUSE_ALL' })
	const resumeAll = () => send({ type: 'RESUME_ALL' })
	const cancelAll = () => send({ type: 'CANCEL_ALL' })

	return (
		<div>
			<input type="file" multiple ref={fileInput} />
			<button onClick={onAdd}>Add</button>
			<button onClick={startAll}>Start All</button>
			<button onClick={pauseAll}>Pause All</button>
			<button onClick={resumeAll}>Resume All</button>
			<button onClick={cancelAll}>Cancel All</button>

			<ul>
				{uploads?.context?.files.map((file) => {
					const child = uploads.context.uploadRefs[file.name]
					const state = child.getSnapshot()

					return (
						<li key={file.name}>
							{file.name} — {state.context.progress}%
							{state.matches('uploading') && (
								<button onClick={() => child.send('PAUSE')}>
									Pause
								</button>
							)}
							{state.matches('paused') && (
								<button onClick={() => child.send('RESUME')}>
									Resume
								</button>
							)}
							{state.matches('failure') && (
								<button onClick={() => child.send('RETRY')}>
									Retry
								</button>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
