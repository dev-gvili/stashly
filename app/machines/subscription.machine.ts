import { setup, assign, assertEvent, fromPromise } from 'xstate'
import type { Subscription } from '@/prisma/client'
import {
	fetchSubscriptionActor,
	updateSubscriptionActor,
	cancelSubscriptionActor,
} from './subscription.actors'
import type {
	SubscriptionContext,
	SubscriptionEvents,
	SubscriptionInput,
	SubscriptionOutput,
} from './machine.types'
import { stripe } from '../.server/stripe'

export const machine = setup({
	types: {
		context: {} as SubscriptionContext,
		events: {} as SubscriptionEvents,
		input: {} as SubscriptionInput,
		output: {} as SubscriptionOutput,
	},
	actions: {
		assignSubscription: function ({ context, event }, params) {
			// Add your action code here
		},
		assignError: function ({ context, event }, params) {
			// Add your action code here
			// ...
		},
		assignStripeCustomerId: function ({ context, event }, params) {
			// Add your action code here
		},
		assignCheckoutSessionId: function ({ context, event }, params) {
			// Add your action code here
		},
	},
	actors: {
		fetchSubscription: fetchSubscriptionActor,
		updateSubscription: updateSubscriptionActor,
		cancelSubscription: cancelSubscriptionActor,
		createStripeCustomerAccount: fromPromise(async () => {
			// ...
		}),
		createCheckoutSession: fromPromise(async ({ input }) => {
			const success_url = `${input.origin}/api/billing/newSubscription`
			const cancel_url = `${input.origin}/dashboard/billing`
			const session = await stripe.checkout.sessions.create({
				payment_method_types: ['card'],
				billing_address_collection: 'required',
				customer,
				line_items: [
					{
						price: input.priceId,
						quantity: 1,
					},
				],
				mode: 'subscription',
				allow_promotion_codes: true,
				success_url,
				cancel_url,
			})
			return session.id
		}),
	},
}).createMachine({
	/** @xstate-layout N4IgpgJg5mDOIC5SwK4CNYGMBOBLADgC64D2AdgHS4QA2YAxAGICiAKgMIASA+gMoCqAIV7sASgEkACq3EB5AHIBtAAwBdRKHwlYuYuQ0gAHogCMygOwBmCuYCcygEzKAbFYcBWF+4A0IAJ6Ils4mFJYALM4AHA62TmHuQe7OAL7JvqgYOAR6lDQkAIYQuGRQ9BDkYFRkAG4kANaVAGZghJgAFrzoWHhEpGQq6kggWjo5BsYIJuYmDhRRtrYm7gvKU74BCGHhodMRU-PODg4paSAZ3dl9FHmFxaVg2Ngk2BT4NPmEjc8AthTNrR0ulleuQBgYRro+uNTNNZvNFst7Gt-IEwrNzIiwrZzA4zCZIuYTukgT0chRUJhMHBYPR+JIACIAQVYzD4QhEEmkciUanB2kh+iGEymlncFHckQltki4UWzls60Qznl4siBK2yjC5giDlSxMypKuFKpsBp7EZ8nYzAAMmzhGIpDIFGChhCxkLELjLLYKPZlQlLOYgyYTJZFQhopEKFqCRjnGETGFHLY9WcSZdyOSUJTqfQxMxmazeKxOazGex2LJ+PJWC7NPz3aBhbC5pEFksVsiNu4PL7I-FE5ZlLFIqnzsCyQ8nth6KI2KIAJp14YNqEehAOdVzBK2BMY-GRMKRcNHWbuBMWSz45RJLG607jw2ZlD4CAfO5lCpVWoNCgvt+EGAnQGhm-S8q6q6Ck2MIzK27aIqs5jhu4Qa+kGDhDgstjuPi7hjumIKUP+74lPQU7PK87yfD8f6vh8QEETky5umu0GTC28IdkiSEogg0w+o4ziBqsorHDM+EgYRFCYPkZBUjQNAfuUZCVMUP6VDJclgDQwEXIRzGQWQ0IbkszgUJEZjBHYSQijxGxWGZkSuDh7gobYrhCRJelkpp8mKaR5EvG8HxfNgvy+dpukTn0BmjKxRieoSISCfuV5apYx68XYYQUI4ljhPukrKMOXnRZmOBgCRUC8IQPRgIylIkCgZCEJ+KnfvUGnYJVgE1XVDWYE1LWxQKRnrmEaK+q49iWMc0pLOE4ZmFYuXytqaoWUJnkPoxVwVVVfUEPVjXNa1gWUSFNH7b1tVHQNQ2ECNjYJZsk3uXYyizfKFkJGE4YWRQGEJBZWKyu5lilU+lDXXc7BtGAmB1E1hC8NSfRtapNSddJ3X0XDCNIygKNo6C4H1nFUEvct1gfU4rizZ4zg+Lxu4hLiMS2Ikrm7ve+reXtuPECU+OI8jqOmuj53BdRYU4z1YAi4TxMS6Tgzk6NxnUzY9h024jPMxsZj2NGGXKqK+JRHhO2SWS+QAO75JCJSSPkfjfGALX0JIjILgAsswNZshWzC8LwT3xc2sGcQhXaIBZyhzIGaq4jKcTmJDoEUPbjtC1ALtux7rXe37AesNwjCMuI1r8HO4eU5HcJtginZ2Ygu5mTM54oaKdj4iYqSnGQJAQHABiPqBfIU2NbEALTOOGM9ilhy8r9hGdSdQdCTxr67YTl8qiZEN5OVs4ZBCEV4eYmCSeBY69kjcRQlNvz3CuEIRHue+IOFqThHGfgZfSInNtqZQ0Qlj3yNNmE08AIJT2Mk4JY5lhySmcpuHsYZeLRATokcwbZ4jxh-kSNMNsriBRfhHQIn0xTHAJImeIWohJLWHGKI+BJXCfQ8FidO1t+bPjornCh9dTCzVmJzDKSYT5TAcK3BA8YzKIJxCYKIooIijl4WVaGsk-J3CEdPF6GFoihDbNeWabgMLhl7jYDCtChIRDcpA8qgs7iHXwMdQap09HGTROGUGuVsKihQjhHEzgXCOOhs44W8NRZE3FjoSmLFhFyNQtEDCn0dTyhDMw4IgN5THCxMqNsKFwlZwdk7POrt3YtS8euRMOStjREDBidyThZEtNye9Tmu53o8NSEAA */
	context: ({ input }) => ({
		subscription: null,
		error: null,
		userId: input.userId,
		stripeAccountId: null,
		checkoutSessionId: null,
	}),
	id: 'subscription',
	initial: 'idle',
	states: {
		idle: {
			on: {
				FETCH_SUBSCRIPTION: {
					target: 'loading',
				},
			},
		},
		loading: {
			invoke: {
				id: 'fetchSubscription',
				input: {},
				onDone: {
					target: 'success',
					actions: {
						type: 'assignSubscription',
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
				src: 'fetchSubscription',
			},
		},
		success: {
			on: {
				UPDATE_SUBSCRIPTION: {
					target: 'updating',
				},
				CANCEL_SUBSCRIPTION: {
					target: 'cancelling',
				},
				CREATE_STRIPE_ACCOUNT: {
					target: 'creatingStripeAccount',
				},
			},
		},
		error: {
			on: {
				RETRY: {
					target: 'loading',
				},
			},
		},
		updating: {
			invoke: {
				id: 'updateSubscription',
				input: {},
				onDone: {
					target: 'success',
					actions: {
						type: 'assignSubscription',
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
				src: 'updateSubscription',
			},
		},
		cancelling: {
			invoke: {
				id: 'cancelSubscription',
				input: {},
				onDone: {
					target: 'success',
					actions: {
						type: 'assignSubscription',
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
				src: 'cancelSubscription',
			},
		},
		creatingStripeAccount: {
			invoke: {
				id: 'createStripeAccount',
				input: {},
				onDone: {
					target: 'creatingCheckoutSession',
					actions: {
						type: 'assignStripeCustomerId',
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
				src: 'createStripeCustomerAccount',
			},
		},
		creatingCheckoutSession: {
			invoke: {
				id: 'createCheckoutSession',
				input: {
					priceId: '',
					customerId: '',
				},
				onDone: {
					target: 'awaitingPayment',
					actions: {
						type: 'assignCheckoutSessionId',
					},
				},
				onError: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
				src: 'createCheckoutSession',
			},
		},
		awaitingPayment: {
			on: {
				PAYMENT_SUCCESS: {
					target: 'success',
					actions: {
						type: 'assignSubscription',
					},
				},
				PAYMENT_FAILURE: {
					target: 'error',
					actions: {
						type: 'assignError',
					},
				},
			},
		},
	},
})
