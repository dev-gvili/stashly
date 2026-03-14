import { quotaRepository } from '@/services/repositories/QuotaRepository'
import { assign, fromPromise, setup } from 'xstate'
import type { User as FullUser } from '@/services/auth.types'
import type { User } from 'better-auth'
import { prisma } from '@/services/db'
import { S3Service } from '@/services/s3'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { subscriptionRepository } from '@/services/repositories/SubscriptionRepository'
import { storagePlanRepository } from '@/services/repositories/StoragePlanRepository'
import { userRepository } from '@/.server/repositories/userRepository'
import type {
  Drive,
  Item,
  Quota,
  StoragePlan,
  Subscription,
} from '@/prisma/browser'
import { createFolder } from '../../.server/item-actions'
// import { toQuotaTotalSize } from '@/services/subscription.utils'

// The context (extended state) for the machine
interface OnboardingContext {
  user: User
  storagePlan?: StoragePlan
  subscription?: Subscription
  drive?: Drive
  fullUser?: FullUser
  quota?: Omit<Quota, 'createdAt' | 'updatedAt'>
  bucketName?: string
  rootId?: string
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
    findDefaultStoragePlan: fromPromise(
      async ({ input }: { input: { user: User } }) => {
        return storagePlanRepository.findDefault()
      }
    ),
    createSubscription: fromPromise<
      Subscription,
      { user: User; storagePlan: StoragePlan }
    >(async ({ input }) => {
      return await subscriptionRepository.create({
        id: toObjectId(getPrefixForModel('Subscription')),
        owner: {
          connect: {
            id: input.user.id,
          },
        },
        storagePlan: {
          connect: {
            id: input.storagePlan.id,
          },
        },
        status: 'active',
      })
    }),
    createDrive: fromPromise<
      Drive,
      { user: User; bucketName: string; storagePlan: StoragePlan }
    >(async ({ input }) => {
      return await prisma.drive.create({
        data: {
          id: toObjectId(getPrefixForModel('Drive')),
          name: input.bucketName,
          owner: {
            connect: {
              id: input.user.id,
            },
          },
          storage: {
            connect: {
              id: input.storagePlan.id,
            },
          },
        },
      })
    }),
    createQuota: fromPromise<void, { drive: Drive; storagePlan: StoragePlan }>(
      async ({ input }) => {
        await quotaRepository.create({
          id: toObjectId(getPrefixForModel('Quota')),
          total: input.storagePlan.storageLimit,
          driveId: input.drive.id,
          storagePlanId: input.storagePlan.id,
          used: 0,
          deleted: 0,
          status: 'normal',
        })
      }
    ),
    createRootFolder: fromPromise<{ id: string }, { drive: Drive; user: User }>(
      async ({ input }) => {
        let rootFolder = await createFolder(
          'root',
          null,
          input.user.id,
          input.drive.id
        )
        let { id } = rootFolder
        return { id }
      }
    ),
    updateUser: fromPromise<
      FullUser,
      {
        user: User
        bucketName: string
        subscription: Subscription
        storagePlan: StoragePlan
        drive: Drive
        rootId: string
      }
    >(async ({ input }) => {
      let updatedUser = await userRepository.update({
        where: { id: input.user.id },
        data: {
          bucket: input.bucketName,
          subscriptionId: input.subscription.id,
          storagePlanId: input.storagePlan.id,
          driveId: input.drive.id,
          rootId: input.rootId,
        },
      })
      return updatedUser as FullUser
    }),
    createBucket: fromPromise<string, { user: User }>(async ({ input }) => {
      const s3Service = new S3Service()
      return await s3Service.createUserBucket(input.user)
    }),
  },
  types: {
    context: {} as OnboardingContext,
    input: {} as OnboardingInput,
  },
  guards: {
    isOnboarded: ({ context }) => !!context.bucketName,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHsB2AjZBDAThAlqlAHQDGAFmKQNaFQCiAHvrAC50AiO+AbmAMQQ0YYoR7JqItJlwEiZSjTpMW7Il15gEY5KSzs0AbQAMAXROnEoAA7JY+A6ishGiAMzHjxAEwBOY74ALMYAjCEAHADsgdEANCAAnojhbsThgQBsAKwhGdFZAf5ZAL7F8dLYeHQKVLREKmyc3HyCwqKo4pLEFbLVFLXKzI3qzVo6eo4WhiGWSCC29o7OrggeXn4BwWFRMYHxSQghxhkhxL4ZxpFuGTcp4cbepeUYlXIk-Ur1Q2pQGi1gOBwyBwxGsABt9AAzYEAW26L168g+dQY3yamm0HV0+nwRjMFmcCwcuKccxWax8-iCoQi0TiiUQEVOWV83gygRiGV8bnCjzKIB6VSRODAOKIACEAK40MCsVqoEQ6LqCt5kEViqBSmWsTHiCYkqZmQl2YloZbJe7ENwhLLhLIZbzeKK2yL7RnGLKpDkeNyRILc7yRPnPGRC97qn5ayRygFAkHgqGw+Gh1WkCN0KOy3XYyb4o1zIlLMkWrzW232x3OqJu1beVJuX1uXy5Xw5dIhJ4ChFh4iQwhvDhgSFYSVg1gAZVYwKwMAAChDUPLFVjld3VX3UAOhyOx5Pp3OF9n9XjzPmbCai6AViE3BziFlItEgt4bxlwiEa0c8sQboEsllAibTIXxKfkVWqDct2HUcJynHAZzAecsEXWNgVBCFWGhHA4XA+RIM4bcYL3eCD2Qo8cRPAkCwvElzUOW9AnvR9AmfV93xrTIsmIYxeRvcIHQCfi2U7XDw1FH5x0ldBYDTfBrEcJd2k6KQ1z6dMiEk6TZPkklyNzU9ZnPRZaOLQ50i9SI31tZtfGbQJwk-HjTnCfjLh4ptmxZETVOFcS6E0mTuB0tB+FQ+MMKwnCfLEjUAu0xw9INPNDPmGizVMiJAOITk7XCGy7IchkEAuDI0jZFz-0ySIXMCbyUzUvyRk0RSlRU+rfI1P4xixY9UENFLCxMq9EEdSJTlCJ0eXfTJbMc85iCOSIXSdLIXweOrXgazrRlCwE0ITTCk1EtVGt+UZEsos9UuM9LhoQUbxpCSaXJCGbfBraJwiY3I3G8GJvBZYxarA6KTo1ABFSVkFYLAWpXNrNo6n5IehrALr65LjRu0k7rZW00muYIcjGrYMk-G9UmOFIIjy+ziY2xEYuRqGYd2uN0MTbDk0Rpm6BRmH0f6rHTRxlwRuyL6UnZD0QhJ0IyaKvLSx+v0mxSVlQJDHniElawIA1ABVWAATh5TucZnW9cN42cEFzHqOxuiPBiYhqs8S5CZfGJyb++8CgE2WH18KIGZ7XX9Z+I2TbCjnDq547w+tgE7YM4XLzF1YgciV37k8K52S910iqOX7uJOJ6Ml+wIQiCSJSn5VBkAgOBnFEtOhozgBaBWDk7rjbIHwfB+uUPU0UFEGh+Lr29ujPAm8RybTOLkOQ5NlQmOUetsjaVoxn0WVhuU5skAv83AA7k9mL4xfStUIxqpJtVq3vD+wI6DdzghCkNFwbZ+vNyrsnyExvI+PIjkcj3jrHWf8TY-qVxfrzDSUlApyXTn-A+jIWRcSiEGcy1U7QL2vtkV2HIlo13SABS4iCwZT1GPvOi3gqZMWuBLNkf0-yOT9MvB0b557B3PjQtMp1+ZYAYaZP6BQzgsTrB5ay885qMVpNVey5C-DBi7O1EgidI423EbjdIjFHRORcukSIDwe6MiOF9YI3JQi-SBjAmhWAwTqggAkAA8muSA+iM7ZC4gDFiwd-Cy1vEXA474rQ3HMZ6WWrJz4ZBobAaUpA4DwAdiLJ2f1Jae15DxWyV8DhhDvO+TwdZmx+HMYkkGWjexYHwGCSUIpfHkmyQTAueS8pBBrA6bOPEHR5Umucda9cgA */
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
      description: `
	* Checks if the user already has an existing drive (S3 bucket) associated with their account.
	* This determines if the onboarding process needs to create new resources or if the user is already onboarded.
		`,
      invoke: {
        src: 'checkExistingDrive',
        input: ({ context }) => ({ user: context.user }),
        onDone: [
          {
            guard: 'isOnboarded',
            target: 'alreadyOnboarded',
          },
          {
            target: 'creatingBucket',
          },
        ],
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    creatingBucket: {
      description: `
	* Creates a new S3 bucket for the user.
	* The bucket name is generated based on the user's ID.`,
      invoke: {
        src: 'createBucket',
        input: ({ context }) => ({ user: context.user }),
        onDone: {
          target: 'findingDefaultStoragePlan',
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
    findingDefaultStoragePlan: {
      description: `
	* Finds the default storage plan (e.g., "free" plan) for the user.	
	* This plan is used to initialize the user's subscription and quota.`,
      invoke: {
        src: 'findDefaultStoragePlan',
        input: ({ context }) => ({ user: context.user }),
        onDone: {
          actions: assign({ storagePlan: ({ event }) => event.output }),
          target: 'creatingSubscription',
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    creatingSubscription: {
      description: `
	* Creates a new subscription for the user based on the default storage plan.
	* This links the user to their chosen plan and sets up billing if applicable.
			 `,
      invoke: {
        src: 'createSubscription',
        input: ({ context }) => ({
          user: context.user,
          storagePlan: context.storagePlan!,
        }),
        onDone: {
          actions: assign({ subscription: ({ event }) => event.output }),
          target: 'creatingDrive',
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    creatingDrive: {
      description: `
	* Creates a new drive (S3 bucket representation in DB) for the user.
	* This links the user's account to their storage and associates it with the chosen storage plan.
	* The drive name is derived from the user's bucket name.
			 `,
      invoke: {
        src: 'createDrive',
        input: ({ context }) => ({
          user: context.user,
          bucketName: context.bucketName!,
          storagePlan: context.storagePlan!,
        }),
        onDone: {
          actions: assign({ drive: ({ event }) => event.output }),
          target: 'creatingQuota', // This was a bug, should be updatingUser
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    creatingQuota: {
      description: `
	* Creates a new quota entry for the user's drive.
	* This sets the initial storage limits based on the chosen storage plan.
	* The quota tracks used, deleted, and total storage.
			 `,
      invoke: {
        src: 'createQuota',
        input: ({ context }) => ({
          drive: context.drive!,
          storagePlan: context.storagePlan!,
        }),
        onDone: { target: 'creatingRootFolder' },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    creatingRootFolder: {
      description: `
	* Creates a new root folder for the user's drive.
     `,
      invoke: {
        src: 'createRootFolder',
        input: ({ context }) => ({
          drive: context.drive!,
          user: context.user,
        }),
        onDone: {
          actions: assign({ rootId: ({ event }) => event.output.id }),
          target: 'updatingUser',
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    updatingUser: {
      description: `
	* Updates the user record in the database with the newly created bucket name,
	* subscription ID, storage plan ID, and drive ID.
	* This completes the onboarding process by linking all created resources to the user.
	`,
      invoke: {
        src: 'updateUser',
        input: ({ context }) => ({
          user: context.user,
          bucketName: context.bucketName!,
          subscription: context.subscription!,
          storagePlan: context.storagePlan!,
          drive: context.drive!,
          rootId: context.rootId!,
        }),
        onDone: {
          actions: assign({ fullUser: ({ event }) => event.output }),
          target: 'success',
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    // onboardingUserInDB: {
    //   invoke: {
    //     src: "runDBTransaction",
    //     input: ({ context }) => ({
    //       user: context.user,
    //       bucketName: context.bucketName!,
    //     }),
    //     onDone: "success",
    //     onError: {
    //       target: "failure",
    //       actions: assign({ error: ({ event }) => event.error }),
    //     },
    //   },
    // },
    alreadyOnboarded: {
      description: `
	* This state is reached if the user already has an existing drive, meaning they are already onboarded.
		`,
      type: 'final',
    },
    success: {
      description: `
	* This state is reached when the onboarding process is successful. 
		`,
      type: 'final',
    },
    failure: {
      description: `
	* This state is reached when the onboarding process has failed due to an error.
	* The 'error' context property will contain details about the failure.
	* Appropriate error handling and user feedback should be implemented when this state is reached.`,
      type: 'final',
    },
  },
})
