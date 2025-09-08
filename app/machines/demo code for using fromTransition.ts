import { fromTransition, type AnyActorLogic, log } from 'xstate'

const toggleLogic = fromTransition((state, event) => {
	if (event.type === 'toggle') {
		return state === 'paused' ? 'playing' : 'paused'
	}

	return state
}, 'paused')

function withLogging<T extends AnyActorLogic>(actorLogic: T) {
	// The transition function in an XState actor logic can return not just the
	// next state, but also an array of "actions" (side-effects) to execute.
	// The return type is: `[nextState, actions]`

	const enhancedLogic = {
		...actorLogic,
		transition: (state, event, actorCtx) => {
			console.log('State before transition:', state)

			// 1. Get the next state and any existing actions from the original logic.
			// Note: `fromTransition` logic always returns an empty array for actions,
			// but a robust wrapper should handle cases where there might be existing actions.
			const [nextState, existingActions] =
				actorLogic.transition(state, event, actorCtx)

			// 2. If the state hasn't changed, we don't need to add a new action.
			if (state === nextState) {
				return [state, existingActions]
			}

			// 3. Create a new action. `log()` is a built-in XState action creator
			// that is useful for debugging. This action will be executed by the actor
			// when the state transition commits.
			const newAction = log(`Transitioned to ${nextState} on ${event.type}`)

			// 4. Return the next state with the new action added to any existing ones.
			return [nextState, [...existingActions, newAction]]
		},
	} satisfies T

	return enhancedLogic
}

const loggingToggleLogic = withLogging(toggleLogic)
