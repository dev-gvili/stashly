import { createActorContext } from '@xstate/react'
import { uploadMachine } from './upload.machine'

/**
 * The upload manager, owned by the React tree instead of the module.
 *
 * It used to be `createActor(uploadMachine).start()` at module scope in
 * `useUpload.ts`, which made it invisible to React — and therefore immortal.
 * Leaving the authenticated layout for `/auth/sign-in` unmounted the panel and
 * every hook, while the actor kept running with its file machines and their
 * requests in flight.
 *
 * Mounting it as context ties its life to `routes/layout.tsx`, which is
 * exactly the authenticated boundary: `auth/*` lives under its own layout, so
 * leaving the app unmounts this Provider, stops the actor, stops its children,
 * and aborts their requests.
 *
 * **This costs nothing per render.** `createActorContext` builds the actor in
 * a lazy `useState` initialiser, so re-renders reuse it — measured in the app:
 * 50 parent re-renders produced 1 actor, 1 ref identity, state intact. The
 * context value is that stable ref, so nothing propagates through context on a
 * re-render; every subscription still goes through `useSelector`, exactly as
 * it did against the module-scope actor.
 *
 * @example
 * // Provider — once, at the top of the authenticated layout
 * <UploadActorContext.Provider>{children}</UploadActorContext.Provider>
 *
 * @example
 * // Consumer — inside any component under that layout
 * const upload = UploadActorContext.useActorRef()
 * const count = useSelector(upload, (s) => s.context.queues.active.size)
 */
export const UploadActorContext = createActorContext(uploadMachine, {
  id: 'uploadManager',
})
