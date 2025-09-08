import {
  Prisma,
  type Subscription,
  type StoragePlan,
  type Workspace,
  type User,
  type SubscriptionHistory as SubscriptionHistoryEvent,
} from '@/prisma/client';
import { prisma } from '@/services/db';
import type { IRepository } from './IRepository';

// Define the shape of the SubscriptionHistory model for type safety
type SubscriptionHistory = {
  id: string;
  subscriptionId: string;
  event: SubscriptionHistoryEvent;
  details: Prisma.JsonValue;
  createdAt: Date;
};

class SubscriptionRepository implements IRepository<Subscription> {
  // --- Standard CRUD Methods (kept for basic operations) ---

  async findById(id: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({ where: { id } });
  }

  async findAll(): Promise<Subscription[]> {
    return prisma.subscription.findMany();
  }

  async create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return prisma.subscription.create({ data });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return prisma.subscription.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Subscription> {
    return prisma.subscription.delete({ where: { id } });
  }

  // --- Production-Ready Custom Methods ---

  async findActiveByWorkspaceId(workspaceId: string): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: {
        workspaceId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
    });
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  }

  async updateByStripeId(stripeSubscriptionId: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return prisma.subscription.update({
      where: { stripeSubscriptionId },
      data,
    });
  }

  // --- New Transactional, Multi-Model Methods ---

  /**
   * Creates a new subscription, updates the workspace's quota, and logs the event.
   * This is a transactional operation to ensure data integrity.
   * @param workspaceId The workspace being subscribed.
   * @param userId The user who initiated the subscription.
   * @param storagePlan The plan being subscribed to.
   * @param stripeSubscription The subscription data from Stripe.
   */
  async createSubscriptionAndInitializeQuota(
    workspaceId: string,
    userId: string,
    storagePlan: StoragePlan,
    stripeSubscription: { stripeSubscriptionId: string; status: SubscriptionStatus; currentPeriodEnd: Date }
  ): Promise<Subscription> {
    const { stripeSubscriptionId, status, currentPeriodEnd } = stripeSubscription;

    return prisma.$transaction(async (tx) => {
      // 1. Create the Subscription
      const newSubscription = await tx.subscription.create({
        data: {
          workspaceId,
          userId,
          storagePlanId: storagePlan.id,
          stripeSubscriptionId,
          status,
          currentPeriodEnd,
        },
      });

      // 2. Update the Workspace's Quota
      await tx.quota.update({
        where: { workspaceId },
        data: {
          storage: storagePlan.maxStorage,
          files: storagePlan.maxFiles,
          // Reset usage if needed, or handle as per business logic
          storageUsage: 0,
          filesUsage: 0,
        },
      });

      // 3. Log the creation event
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: newSubscription.id,
          event: SubscriptionHistoryEvent.CREATED,
          details: {
            plan: storagePlan.name,
            userId,
          },
        },
      });

      return newSubscription;
    });
  }

  /**
   * Changes a subscription's plan, updates the quota, and logs the event.
   * Handles upgrades/downgrades within a single transaction.
   * @param stripeSubscriptionId The Stripe ID of the subscription to change.
   * @param newPlan The new storage plan.
   */
  async changeSubscriptionPlan(stripeSubscriptionId: string, newPlan: StoragePlan): Promise<Subscription> {
    return prisma.$transaction(async (tx) => {
      // 1. Get the current subscription to identify the old plan
      const currentSubscription = await tx.subscription.findUniqueOrThrow({
        where: { stripeSubscriptionId },
        include: { storagePlan: true },
      });

      // 2. Update the subscription to point to the new plan
      const updatedSubscription = await tx.subscription.update({
        where: { stripeSubscriptionId },
        data: {
          storagePlanId: newPlan.id,
        },
      });

      // 3. Update the associated workspace's quota
      await tx.quota.update({
        where: { workspaceId: updatedSubscription.workspaceId },
        data: {
          storage: newPlan.maxStorage,
          files: newPlan.maxFiles,
        },
      });

      // 4. Log the change event
      const event =
        newPlan.maxStorage > currentSubscription.storagePlan.maxStorage
          ? SubscriptionHistoryEvent.UPGRADED
          : SubscriptionHistoryEvent.DOWNGRADED;

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: updatedSubscription.id,
          event,
          details: {
            fromPlan: currentSubscription.storagePlan.name,
            toPlan: newPlan.name,
          },
        },
      });

      return updatedSubscription;
    });
  }

  /**
   * Sets a subscription to be canceled and logs the event in the history.
   * This is now a transactional operation.
   */
  async setAsCanceled(stripeSubscriptionId: string, cancelAt: Date): Promise<Subscription> {
    return prisma.$transaction(async (tx) => {
      // 1. Update the subscription status
      const canceledSubscription = await tx.subscription.update({
        where: { stripeSubscriptionId },
        data: {
          status: SubscriptionStatus.CANCELED,
          cancelAt,
          canceledAt: new Date(),
        },
      });

      // 2. Log the cancellation event
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: canceledSubscription.id,
          event: SubscriptionHistoryEvent.CANCELED,
          details: {
            reason: 'User initiated cancellation.', // Could be parameterized
          },
        },
      });

      return canceledSubscription;
    });
  }
}

// Export a singleton instance for use throughout your application
export const subscriptionRepository = new SubscriptionRepository();
