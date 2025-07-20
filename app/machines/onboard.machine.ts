import { assign, createMachine, fromPromise, setup } from 'xstate'
import type { User } from 'better-auth'
import { prisma } from '../services/db.server'
import { S3Service } from '../services/s3.server'
import { toQuota } from '../services/subscription.utils'

// The context (extended state) for the machine
interface OnboardingContext {
	user: User
	bucketName?: string
	error?: unknown
}

// The input for the machine
type OnboardingInput = {
	user: User
}

export const onboardingMachine = setup({
	actors: {
		checkExistingDrive: fromPromise(
			async ({ input }: { input: { user: User } }) => {
				return prisma.drive.findFirst({
					where: { ownerId: input.user.id },
				})
			}
		),
		runDBTransaction: fromPromise(
			async ({
				input,
			}: {
				input: { user: User; bucketName: string }
			}) => {
				return prisma.$transaction(async (tx) => {
					const storagePlan = await tx.storagePlan.findFirstOrThrow({
						where: { type: 'free' },
					})
					const subscription = await tx.subscription.create({
						data: {
							userId: input.user.id,
							storagePlanType: storagePlan.type,
							storagePlanId: storagePlan.id,
							status: 'active',
							type: 'free',
							isCurrent: true,
						},
					})
					await tx.drive.create({
						data: {
							name: input.bucketName,
							ownerId: input.user.id,
							driveType: 'personal',
							quota: {
								create: {
									total: toQuota(storagePlan.type),
									remaining: toQuota(storagePlan.type),
									used: 0,
									deleted: 0,
									state: 'normal',
								},
							},
						},
					})
					await tx.user.update({
						where: { id: input.user.id },
						data: {
							bucket: input.bucketName,
							subscriptionId: subscription.id,
							storagePlanId: storagePlan.id,
						},
					})
				})
			}
		),
		createS3Bucket: fromPromise<string, { user: User }>(
			async ({ input }) => {
				const s3Service = new S3Service()
				return await s3Service.createUserBucket(input.user)
			}
		),
	},
	types: {
		context: {} as OnboardingContext,
		input: {} as OnboardingInput,
	},
	guards: {
		isOnboarded: ({ context }) => !!context.bucketName,
	},
}).createMachine({
	id: 'onboarding',
	types: {
		context: {} as OnboardingContext,
		input: {} as OnboardingInput,
	},
	initial: 'checkingExistingDrive',
	context: ({ input }) => ({
		user: input.user,
		bucketName: undefined,
		error: undefined,
	}),
	states: {
		checkingExistingDrive: {
			invoke: {
				src: 'checkExistingDrive',
				input: ({ context }) => ({ user: context.user }),
				onDone: [
					{
						guard: 'isOnboarded',
						target: 'alreadyOnboarded',
					},
					{
						target: 'creatingS3Bucket',
					},
				],
				onError: {
					target: 'failure',
					actions: assign({ error: ({ event }) => event.error }),
				},
			},
		},
		creatingS3Bucket: {
			invoke: {
				src: 'createS3Bucket',
				input: ({ context }) => ({ user: context.user }),
				onDone: {
					target: 'onboardingUserInDB',
					actions: assign({
						bucketName: ({ event }) => event.output,
					}),
				},
				onError: {
					target: 'failure',
					actions: assign({ error: ({ event }) => event.error }),
				},
			},
		},
		onboardingUserInDB: {
			invoke: {
				src: 'runDBTransaction',
				input: ({ context }) => ({
					user: context.user,
					bucketName: context.bucketName!,
				}),
				onDone: 'success',
				onError: {
					target: 'failure',
					actions: assign({ error: ({ event }) => event.error }),
				},
			},
		},
		alreadyOnboarded: {
			type: 'final',
		},
		success: {
			type: 'final',
		},
		failure: {
			type: 'final',
		},
	},
})
