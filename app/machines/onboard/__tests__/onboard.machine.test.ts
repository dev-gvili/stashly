import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import type { User } from 'better-auth'
import { prisma } from '@/services/db'
import type { StoragePlan } from '@/prisma/client'
import { onboardingMachine } from '@/machines/onboard/onboard.machine'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from '../../../.server/__tests__/helpers/wipe-test-users'

// Hoisted with `vi.mock`, which runs before this module's own statements.
const { buckets, createUserBucket } = vi.hoisted(() => {
  /** Buckets the fake storage knows; `HeadBucket` finds only these. */
  const buckets = new Set<string>()
  const createUserBucket = vi.fn(async (user: { id: string }) => {
    const name = `stashly-test-${user.id.slice(-8).toLowerCase()}`
    buckets.add(name)
    return name
  })
  return { buckets, createUserBucket }
})

// Stubbed whole: the machine reaches subscription-actions, whose Stripe client
// throws at load without STRIPE_SECRET_KEY, which CI doesn't set.
vi.mock('@/services/stripe', () => ({ stripe: {} }))

vi.mock('@/services/s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/s3')>()),
  createUserBucket: (user: { id: string }) => createUserBucket(user),
  s3: {
    send: async (command: { input: { Bucket: string } }) => {
      if (!buckets.has(command.input.Bucket)) throw new Error('NotFound')
      return {}
    },
  },
}))

/**
 * Onboarding runs again on sign-in for an account it left incomplete
 * (tech-debt item 22), so each step must reuse what an earlier run created.
 * `Drive.ownerId`, `Subscription.ownerId` and `Quota.driveId` are unique: a
 * step that always creates fails the second run at the first row the first
 * run made. Needs a live database (CI provides one). Storage is faked (no
 * Tigris) and the plan lookup is stubbed (CI's database has no seeded plan).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

const users: string[] = []
let plan: StoragePlan

beforeAll(async () => {
  plan = await prisma.storagePlan.create({
    data: {
      id: uid('StoragePlan'),
      name: 'Onboarding test',
      tag: `onboard-test-${Date.now()}`,
      type: 'free',
      // The drive's plan relation is keyed on the three limits, so make them
      // unique to this run.
      storageLimit: BigInt(1_000_000_000 + Math.floor(Math.random() * 1_000_000)),
      workspaceLimit: 1,
      memberLimit: 1,
      features: [],
    },
  })
})

afterAll(async () => {
  await wipeTestUsers(users)
  await prisma.storagePlan.delete({ where: { id: plan.id } })
})

async function newUser(): Promise<User> {
  const id = uid('User')
  users.push(id)
  const row = await prisma.user.create({
    data: { id, name: 'Onboarding test', email: `onboard-${id}@test.local`, emailVerified: true },
  })
  return row as unknown as User
}

/** Runs the machine to its final state, with the plan lookup stubbed. */
async function onboard(user: User) {
  createUserBucket.mockClear()
  const machine = onboardingMachine.provide({
    actors: { findDefaultStoragePlan: fromPromise(async () => plan) },
  })
  const actor = createActor(machine, { input: { user } }).start()
  const snapshot = await waitFor(actor, (s) => s.status === 'done', { timeout: 15_000 })
  return { state: snapshot.value, error: snapshot.context.error, bucketsCreated: createUserBucket.mock.calls.length }
}

async function resources(userId: string) {
  const [user, drives, subscriptions, quotas, roots] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.drive.findMany({ where: { ownerId: userId } }),
    prisma.subscription.findMany({ where: { ownerId: userId } }),
    prisma.quota.findMany({ where: { drive: { ownerId: userId } } }),
    prisma.item.findMany({ where: { ownerId: userId, parentId: null, type: 'folder' } }),
  ])
  return { user, drives, subscriptions, quotas, roots }
}

describe('onboardingMachine', () => {
  it('onboards a new user end to end', async () => {
    const user = await newUser()
    const run = await onboard(user)
    expect(run.error).toBeUndefined()
    expect(run.state).toBe('success')

    const { user: row, drives, subscriptions, quotas, roots } = await resources(user.id)
    expect([drives.length, subscriptions.length, quotas.length, roots.length]).toEqual([1, 1, 1, 1])
    expect(row.bucket).toBe(`stashly-test-${user.id.slice(-8).toLowerCase()}`)
    expect(row.driveId).toBe(drives[0].id)
    expect(row.rootId).toBe(roots[0].id)
    expect(row.subscriptionId).toBe(subscriptions[0].id)
  })

  it('finishes an onboarding that stopped before the root folder, reusing what it made', async () => {
    const user = await newUser()
    // A first run that created the bucket, subscription, drive and quota, then
    // failed: the bucket is on the row, the rest is found by owner.
    buckets.add('stashly-test-first-run')
    await prisma.user.update({ where: { id: user.id }, data: { bucket: 'stashly-test-first-run' } })
    const subscription = await prisma.subscription.create({
      data: { id: uid('Subscription'), ownerId: user.id, storagePlanId: plan.id, status: 'active' },
    })
    const drive = await prisma.drive.create({
      data: {
        id: uid('Drive'),
        name: 'stashly-test-first-run',
        ownerId: user.id,
        storageLimit: plan.storageLimit,
        workspaceLimit: plan.workspaceLimit,
        memberLimit: plan.memberLimit,
      },
    })
    await prisma.quota.create({
      data: { id: uid('Quota'), driveId: drive.id, total: plan.storageLimit, used: 0, deleted: 0, status: 'normal' },
    })

    const run = await onboard(user)
    expect(run.error).toBeUndefined()
    expect(run.state).toBe('success')

    const { user: row, drives, subscriptions, quotas, roots } = await resources(user.id)
    expect([drives.length, subscriptions.length, quotas.length, roots.length]).toEqual([1, 1, 1, 1])
    expect(row.driveId).toBe(drive.id)
    expect(row.subscriptionId).toBe(subscription.id)
    expect(row.rootId).toBe(roots[0].id)
    expect(row.bucket).toBe('stashly-test-first-run')
    expect(run.bucketsCreated).toBe(0)
  })

  it('writes a new bucket to the row before the later steps run', async () => {
    const user = await newUser()
    // The plan lookup fails after the bucket exists: the next run must find it.
    const machine = onboardingMachine.provide({
      actors: {
        findDefaultStoragePlan: fromPromise(async (): Promise<StoragePlan> => {
          throw new Error('no plan')
        }),
      },
    })
    const actor = createActor(machine, { input: { user } }).start()
    expect((await waitFor(actor, (s) => s.status === 'done')).value).toBe('failure')
    const { user: row } = await resources(user.id)
    expect(row.bucket).toBe(`stashly-test-${user.id.slice(-8).toLowerCase()}`)

    const retry = await onboard(user)
    expect(retry.state).toBe('success')
    expect(retry.bucketsCreated).toBe(0)
  })

  it('creates a new bucket when the stored one is gone', async () => {
    const user = await newUser()
    await prisma.user.update({ where: { id: user.id }, data: { bucket: 'stashly-test-deleted' } })
    const run = await onboard(user)
    expect(run.state).toBe('success')
    expect(run.bucketsCreated).toBe(1)
    expect((await resources(user.id)).user.bucket).toBe(`stashly-test-${user.id.slice(-8).toLowerCase()}`)
  })

  it('creates nothing for a user who is already onboarded', async () => {
    const user = await newUser()
    expect((await onboard(user)).state).toBe('success')
    const before = await resources(user.id)

    const again = await onboard(user)
    expect(again.state).toBe('alreadyOnboarded')
    expect(again.bucketsCreated).toBe(0)
    expect(await resources(user.id)).toEqual(before)
  })
})
