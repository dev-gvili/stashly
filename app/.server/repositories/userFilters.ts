import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import type { Notification, Permission, Account, Session, WorkspaceMember, Subscription, Comment, Invitation, Item, LockedItem, Drive, Favorite, User } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const userFilterSchema = z
  .object({
    id: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    name: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    displayName: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    email: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    image: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    emailVerified: z.object({equals: z.coerce.boolean().optional(),in: z.coerce.boolean().optional(),notIn: z.coerce.boolean().optional(),lt: z.coerce.boolean().optional(),lte: z.coerce.boolean().optional(),gt: z.coerce.boolean().optional(),gte: z.coerce.boolean().optional()}).optional(),
    createdAt: z.object({equals: z.date().optional(),in: z.date().optional(),notIn: z.date().optional(),lt: z.date().optional(),lte: z.date().optional(),gt: z.date().optional(),gte: z.date().optional(),gte: z.date().optional(),lte: z.date().optional()}).optional(),
    updatedAt: z.object({equals: z.date().optional(),in: z.date().optional(),notIn: z.date().optional(),lt: z.date().optional(),lte: z.date().optional(),gt: z.date().optional(),gte: z.date().optional(),gte: z.date().optional(),lte: z.date().optional()}).optional(),
    bucket: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    driveId: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    subscriptionId: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    storagePlanId: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    stripeCustomerId: z.object({equals: z.string().optional(),in: z.string().optional(),notIn: z.string().optional(),contains: z.string().optional(),startsWith: z.string().optional(),endsWith: z.string().optional()}).optional(),
    // notifications: z.object({equals: z.nativeEnum(Notification).optional(),in: z.nativeEnum(Notification).optional(),notIn: z.nativeEnum(Notification).optional(),lt: z.nativeEnum(Notification).optional(),lte: z.nativeEnum(Notification).optional(),gt: z.nativeEnum(Notification).optional(),gte: z.nativeEnum(Notification).optional()}).optional(),
    // permissions: z.object({equals: z.nativeEnum(Permission).optional(),in: z.nativeEnum(Permission).optional(),notIn: z.nativeEnum(Permission).optional(),lt: z.nativeEnum(Permission).optional(),lte: z.nativeEnum(Permission).optional(),gt: z.nativeEnum(Permission).optional(),gte: z.nativeEnum(Permission).optional()}).optional(),
    // accounts: z.object({equals: z.nativeEnum(Account).optional(),in: z.nativeEnum(Account).optional(),notIn: z.nativeEnum(Account).optional(),lt: z.nativeEnum(Account).optional(),lte: z.nativeEnum(Account).optional(),gt: z.nativeEnum(Account).optional(),gte: z.nativeEnum(Account).optional()}).optional(),
    // sessions: z.object({equals: z.nativeEnum(Session).optional(),in: z.nativeEnum(Session).optional(),notIn: z.nativeEnum(Session).optional(),lt: z.nativeEnum(Session).optional(),lte: z.nativeEnum(Session).optional(),gt: z.nativeEnum(Session).optional(),gte: z.nativeEnum(Session).optional()}).optional(),
    // workspaces: z.object({equals: z.nativeEnum(WorkspaceMember).optional(),in: z.nativeEnum(WorkspaceMember).optional(),notIn: z.nativeEnum(WorkspaceMember).optional(),lt: z.nativeEnum(WorkspaceMember).optional(),lte: z.nativeEnum(WorkspaceMember).optional(),gt: z.nativeEnum(WorkspaceMember).optional(),gte: z.nativeEnum(WorkspaceMember).optional()}).optional(),
    // subscriptions: z.object({equals: z.nativeEnum(Subscription).optional(),in: z.nativeEnum(Subscription).optional(),notIn: z.nativeEnum(Subscription).optional(),lt: z.nativeEnum(Subscription).optional(),lte: z.nativeEnum(Subscription).optional(),gt: z.nativeEnum(Subscription).optional(),gte: z.nativeEnum(Subscription).optional()}).optional(),
    // comments: z.object({equals: z.nativeEnum(Comment).optional(),in: z.nativeEnum(Comment).optional(),notIn: z.nativeEnum(Comment).optional(),lt: z.nativeEnum(Comment).optional(),lte: z.nativeEnum(Comment).optional(),gt: z.nativeEnum(Comment).optional(),gte: z.nativeEnum(Comment).optional()}).optional(),
    // invitations: z.object({equals: z.nativeEnum(Invitation).optional(),in: z.nativeEnum(Invitation).optional(),notIn: z.nativeEnum(Invitation).optional(),lt: z.nativeEnum(Invitation).optional(),lte: z.nativeEnum(Invitation).optional(),gt: z.nativeEnum(Invitation).optional(),gte: z.nativeEnum(Invitation).optional()}).optional(),
    // items: z.object({equals: z.nativeEnum(Item).optional(),in: z.nativeEnum(Item).optional(),notIn: z.nativeEnum(Item).optional(),lt: z.nativeEnum(Item).optional(),lte: z.nativeEnum(Item).optional(),gt: z.nativeEnum(Item).optional(),gte: z.nativeEnum(Item).optional()}).optional(),
    // lockedItems: z.object({equals: z.nativeEnum(LockedItem).optional(),in: z.nativeEnum(LockedItem).optional(),notIn: z.nativeEnum(LockedItem).optional(),lt: z.nativeEnum(LockedItem).optional(),lte: z.nativeEnum(LockedItem).optional(),gt: z.nativeEnum(LockedItem).optional(),gte: z.nativeEnum(LockedItem).optional()}).optional(),
    // drive: z.object({equals: z.nativeEnum(Drive).optional(),in: z.nativeEnum(Drive).optional(),notIn: z.nativeEnum(Drive).optional(),lt: z.nativeEnum(Drive).optional(),lte: z.nativeEnum(Drive).optional(),gt: z.nativeEnum(Drive).optional(),gte: z.nativeEnum(Drive).optional()}).optional(),
    // favorites: z.object({equals: z.nativeEnum(Favorite).optional(),in: z.nativeEnum(Favorite).optional(),notIn: z.nativeEnum(Favorite).optional(),lt: z.nativeEnum(Favorite).optional(),lte: z.nativeEnum(Favorite).optional(),gt: z.nativeEnum(Favorite).optional(),gte: z.nativeEnum(Favorite).optional()}).optional(),
  })
  .partial()

const createUserFilter = createFilter<
  Prisma.UserWhereInput,
  z.infer<typeof userFilterSchema>
>()

export const userFilters = {
  id: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (id) => ({ id })),
  name: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (name) => ({ name })),
  displayName: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (displayName) => ({ displayName })),
  email: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (email) => ({ email })),
  image: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (image) => ({ image })),
  emailVerified: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (emailVerified) => ({ emailVerified })),
  createdAt: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional(),gte: z.any().optional(),lte: z.any().optional()}).optional(), (createdAt) => ({ createdAt })),
  updatedAt: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional(),gte: z.any().optional(),lte: z.any().optional()}).optional(), (updatedAt) => ({ updatedAt })),
  bucket: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (bucket) => ({ bucket })),
  driveId: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (driveId) => ({ driveId })),
  subscriptionId: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (subscriptionId) => ({ subscriptionId })),
  storagePlanId: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (storagePlanId) => ({ storagePlanId })),
  stripeCustomerId: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),contains: z.string().optional(),startsWith: z.any().optional(),endsWith: z.any().optional()}).optional(), (stripeCustomerId) => ({ stripeCustomerId })),
  notifications: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (notifications) => ({ notifications })),
  permissions: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (permissions) => ({ permissions })),
  accounts: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (accounts) => ({ accounts })),
  sessions: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (sessions) => ({ sessions })),
  workspaces: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (workspaces) => ({ workspaces })),
  subscriptions: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (subscriptions) => ({ subscriptions })),
  comments: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (comments) => ({ comments })),
  invitations: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (invitations) => ({ invitations })),
  items: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (items) => ({ items })),
  lockedItems: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (lockedItems) => ({ lockedItems })),
  drive: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (drive) => ({ drive })),
  favorites: createUserFilter(z.object({equals: z.any().optional(),in: z.any().optional(),notIn: z.any().optional(),lt: z.any().optional(),lte: z.any().optional(),gt: z.any().optional(),gte: z.any().optional()}).optional(), (favorites) => ({ favorites })),
}

export const buildUserFilters = buildFiltersFactory({
  filters: userFilters,
  schema: userFilterSchema,
})

export const userFilterDocs = {
  "id": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "name": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "displayName": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "email": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "image": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "emailVerified": {
    "type": "Boolean",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "createdAt": {
    "type": "DateTime",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte",
      "gte",
      "lte"
    ]
  },
  "updatedAt": {
    "type": "DateTime",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte",
      "gte",
      "lte"
    ]
  },
  "bucket": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "driveId": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "subscriptionId": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "storagePlanId": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "stripeCustomerId": {
    "type": "String",
    "operators": [
      "equals",
      "in",
      "notIn",
      "contains",
      "startsWith",
      "endsWith"
    ]
  },
  "notifications": {
    "type": "Notification",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "permissions": {
    "type": "Permission",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "accounts": {
    "type": "Account",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "sessions": {
    "type": "Session",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "workspaces": {
    "type": "WorkspaceMember",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "subscriptions": {
    "type": "Subscription",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "comments": {
    "type": "Comment",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "invitations": {
    "type": "Invitation",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "items": {
    "type": "Item",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "lockedItems": {
    "type": "LockedItem",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "drive": {
    "type": "Drive",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  },
  "favorites": {
    "type": "Favorite",
    "operators": [
      "equals",
      "in",
      "notIn",
      "lt",
      "lte",
      "gt",
      "gte"
    ]
  }
}

