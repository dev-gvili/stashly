import { createQuota } from '@/services/quota-actions'
import { assign, fromPromise, setup } from 'xstate'
import type { User as FullUser } from '@/services/auth.types'
import type { User } from 'better-auth'
import { prisma } from '@/services/db'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { createUserBucket, s3 } from '@/services/s3'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { createSubscriptionRecord, findActiveSubscriptionByOwner, updateSubscriptionRecord } from '@/services/subscription-actions'
import { findDefaultStoragePlan } from '@/services/storagePlan-actions'
import { createDrive, findDriveByOwner } from '@/services/drive-actions'
import { updateUser } from '@/services/user-actions'
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
  /** The row's bucket when this run started: an earlier run's, or the placeholder. */
  storedBucket?: string
  rootId?: string
  error?: unknown
}

/** The `User.bucket` column default: no bucket of the user's own yet. */
const PLACEHOLDER_BUCKET = 'default-bucket'

/** Whether the row already has what onboarding writes. */
function isOnboarded(stored: { bucket: string; rootId: string | null; driveId: string | null }) {
  return !!stored.rootId && !!stored.driveId && !!stored.bucket && stored.bucket !== PLACEHOLDER_BUCKET
}

// The input for the machine
type OnboardingInput = {
  user: User
}

// Every step reuses what an earlier run created, because onboarding runs again
// on sign-in for an account a failed run left incomplete (tech-debt item 22).
// `Drive.ownerId`, `Subscription.ownerId` and `Quota.driveId` are unique, so a
// step that always created failed the second run at the first row the first
// run had made, and the account stayed broken.
export const onboardingMachine = setup({
  actors: {
    readStoredUser: fromPromise(
      async ({ input }: { input: { user: User } }) => {
        return prisma.user.findUniqueOrThrow({
          where: { id: input.user.id },
          select: { bucket: true, rootId: true, driveId: true },
        })
      }
    ),
    findDefaultStoragePlan: fromPromise(
      async ({ input }: { input: { user: User } }) => {
        return findDefaultStoragePlan()
      }
    ),
    createSubscription: fromPromise<
      Subscription,
      { user: User; storagePlan: StoragePlan }
    >(async ({ input }) => {
      // Any status: `ownerId` is unique, so a cancelled one blocks a new row too.
      const existing = await prisma.subscription.findUnique({ where: { ownerId: input.user.id } })
      if (existing) return existing
      return await createSubscriptionRecord({
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
      const existing = await findDriveByOwner(input.user.id)
      if (existing) return existing
      return await createDrive({
        name: input.bucketName,
        owner: { connect: { id: input.user.id } },
        storage: { connect: { id: input.storagePlan.id } },
      })
    }),
    createQuota: fromPromise<void, { drive: Drive; storagePlan: StoragePlan }>(
      async ({ input }) => {
        const existing = await prisma.quota.findUnique({ where: { driveId: input.drive.id } })
        if (existing) return
        await createQuota({
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
        const existing = await prisma.item.findFirst({
          where: { ownerId: input.user.id, driveId: input.drive.id, parentId: null, type: 'folder' },
          select: { id: true },
        })
        if (existing) return existing
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
      let updatedUser = await updateUser({
        userId: input.user.id,
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
    createBucket: fromPromise<string, { user: User; storedBucket: string | null }>(
      async ({ input }) => {
        // A bucket is the one thing a later run can't find by owner, so it is
        // written to the row as soon as it exists, and reused while it does.
        if (input.storedBucket && input.storedBucket !== PLACEHOLDER_BUCKET) {
          const exists = await s3
            .send(new HeadBucketCommand({ Bucket: input.storedBucket }))
            .then(() => true)
            .catch(() => false)
          if (exists) return input.storedBucket
        }
        const bucket = await createUserBucket(input.user)
        await prisma.user.update({ where: { id: input.user.id }, data: { bucket } })
        return bucket
      }
    ),
  },
  types: {
    context: {} as OnboardingContext,
    input: {} as OnboardingInput,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHsB2AjZBDAThAlqlAHQDGAFmKQNaFQCiAHvrAC50AiO+AbmAMQQ0YYoR7JqItJlwEiZSjTpMW7Il15gEY5KSzs0AbQAMAXROnEoAA7JY+A6ishGiAMzHjxAEwBOY74ALMYAjCEAHADsgdEANCAAnojhbsThgQBsAKwhGdFZAf5ZAL7F8dLYeHQKVLREKmyc3HyCwqKo4pLEFbLVFLXKzI3qzVo6eo4WhiGWSCC29o7OrggeXn4BwWFRMYHxSQghxhkhxL4ZxpFuGTcp4cbepeUYlXIk-Ur1Q2pQGi1gOBwyBwxGsABt9AAzYEAW26L168g+dQY3yamm0HV0+nwRjMFmcCwcuKccxWax8-iCoQi0TiiUQEVOWV83gygRiGV8bnCjzKIB6VSRODAOKIACEAK40MCsVqoEQ6LqCt5kEViqBSmWsTHiCYkqZmQl2YloZbJe7ENwhLLhLIZbzeKK2yL7RnGLKpDkeNyRILc7yRPnPGRC97qn5ayRygFAkHgqGw+Gh1WkCN0KOy3XYyb4o1zIlLMkWrzW232x3OqJu1beVJuX1uXy5Xw5dIhJ4ChFh4iQwhvDhgSFYSVg1gAZVYwKwMAAChDUPLFVjld3VX3UAOhyOx5Pp3OF9n9XjzPmbCai6AViE3BziFlItEgt4bxlwiEa0c8sQboEsllAibTIXxKfkVWqDct2HUcJynHAZzAecsEXWNgVBCFWGhHA4XA+RIM4bcYL3eCD2Qo8cRPAkCwvElzUOW9AnvR9AmfV93xrTIsmIYxeRvcIHQCfi2U7XDw1FH5x0ldBYDTfBrEcJd2k6KQ1z6dMiEk6TZPkklyNzU9ZnPRZaOLQ50i9SI31tZtfGbQJwk-HjTnCfjLh4ptmxZETVOFcS6E0mTuB0tB+FQ+MMKwnCfLEjUAu0xw9INPNDPmGizVMiJAOITk7XCGy7IchkEAuDI0jZFz-0ySIXMCbyUzUvyRk0RSlRU+rfI1P4xixY9UENFLCxMq9EEdSJTlCJ0eXfTJbMc85iCOSIXSdLIXweOrXgazrRlCwE0ITTCk1EtVGt+UZEsos9UuM9LhoQUbxpCSaXJCGbfBraJwiY3I3G8GJvBZYxarA6KTo1ABFSVkFYLAWpXNrNo6n5IehrALr65LjRu0k7rZW00muYIcjGrYMk-G9UmOFIIjy+ziY2xEYuRqGYd2uN0MTbDk0Rpm6BRmH0f6rHTRxlwRuyL6UnZD0QhJ0IyaKvLSx+v0mxSVlQJDHniElawIA1ABVWAATh5TucZnW9cN42cEFzHqOxuiPBiYhqs8S5CZfGJyb++8CgE2WH18KIGZ7XX9Z+I2TbCjnDq547w+tgE7YM4XLzF1YgciV37k8K52S910iqOX7uJOJ6Ml+wIQiCSJSn5VBkAgOBnFEtOhozgBaBWDk7rjbIHwfB+uUPU0UFEGh+Lr29ujPAm8RybTOLkOQ5NlQmOUetsjaVoxn0WVhuU5skAv83AA7k9mL4xfStUIxqpJtVq3vD+wI6DdzghCkNFwbZ+vNyrsnyExvI+PIjkcj3jrHWf8TY-qVxfrzDSUlApyXTn-A+jIWRcSiEGcy1U7QL2vtkV2HIlo13SABS4iCwZT1GPvOi3gqZMWuBLNkf0-yOT9MvB0b557B3PjQtMp1+ZYAYaZP6BQzgsTrB5ay885qMVpNVey5C-DBi7O1EgidI423EbjdIjFHRORcukSIDwe6MiOF9YI3JQi-SBjAmhWAwTqggAkAA8muSA+iM7ZC4gDFiwd-Cy1vEXA474rQ3HMZ6WWrJz4ZBobAaUpA4DwAdiLJ2f1Jae15DxWyV8DhhDvO+TwdZmx+HMYkkGWjexYHwGCSUIpfHkmyQTAueS8pBBrA6bOPEHR5Umucda9cgA */
  id: 'onboarding',
  types: {
    context: {} as OnboardingContext,
    input: {} as OnboardingInput,
  },
  initial: 'readingStoredUser',
  context: ({ input }) => ({
    user: input.user,
    bucketName: undefined,
    error: undefined,
  }),
  states: {
    readingStoredUser: {
      description: `
	* Reads the user row's bucket, root and drive.
	* With all three set the user is already onboarded; otherwise every step below runs, reusing what an earlier run made.
		`,
      invoke: {
        src: 'readStoredUser',
        input: ({ context }) => ({ user: context.user }),
        onDone: [
          {
            guard: ({ event }) => isOnboarded(event.output),
            target: 'alreadyOnboarded',
          },
          {
            target: 'creatingBucket',
            actions: assign({ storedBucket: ({ event }) => event.output.bucket }),
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
        input: ({ context }) => ({ user: context.user, storedBucket: context.storedBucket ?? null }),
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
