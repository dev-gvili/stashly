import { ItemType, ItemStatus } from '@/prisma/browser'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { prisma } from '@/services/db'

// --- 1. CREATE COLLECTION ---
/**
 * Creates a new Collection.
 * This involves creating a base Item record with type='collection'
 * and a linked Collection facet record.
 */
export async function createCollection(
  name: string,
  ownerId: string,
  driveId: string,
  parentId: string | null = null
) {
  return await prisma.$transaction(async (tx) => {
    // Create the Item and the nested Collection record in one go
    const newItem = await tx.item.create({
      data: {
        id: toObjectId(getPrefixForModel('Item')),
        name,
        type: ItemType.collection,
        category: 'unknown', // Collections don't fit standard file categories
        status: ItemStatus.normal,
        ownerId,
        driveId,
        parentId,
        size: 0,
        // Create the Collection facet relationship
        collection: {
          create: {
            name: name, // Duplicated name for index efficiency on Collection table
            size: 0,
          },
        },
      },
      include: {
        collection: true,
      },
    })

    return newItem
  })
}

// --- 2. RENAME COLLECTION ---
/**
 * Renames a collection.
 * Updates both the base Item name and the Collection facet name to ensure consistency.
 */
export async function renameCollection(collectionId: string, newName: string) {
  return await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.item.update({
      where: { id: collectionId },
      data: {
        name: newName,
        collection: {
          update: {
            name: newName,
          },
        },
      },
      include: { collection: true },
    })

    return updatedItem
  })
}

// --- 3. DELETE COLLECTION ---
/**
 * Soft deletes a collection by moving the base Item to trash.
 * The Collection facet remains but is effectively hidden via the Item status.
 */
export async function trashCollection(collectionId: string) {
  return await prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.trashed },
  })
}

/**
 * Hard deletes a collection.
 * Prisma's `onDelete: Cascade` ensures the Collection record and
 * all CollectionItem associations are automatically removed.
 */
export async function deleteCollection(collectionId: string) {
  return await prisma.item.delete({
    where: { id: collectionId },
  })
}

// --- 4. MANAGE COLLECTION ITEMS ---

/**
 * Adds an existing Item to a Collection.
 * Also atomically updates the Collection's total size.
 */
export async function addItemToCollection(
  collectionId: string,
  itemId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch the item to get its size
    const itemToAdd = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { size: true },
    })

    // 2. Create the association in the junction table
    const association = await tx.collectionItem.create({
      data: {
        id: toObjectId(getPrefixForModel('CollectionItem')),
        collectionId,
        itemId,
      },
    })

    // 3. Increment the collection's total size
    await tx.collection.update({
      where: { id: collectionId },
      data: {
        size: { increment: itemToAdd.size },
      },
    })

    return association
  })
}

/**
 * Removes an Item from a Collection.
 * Also atomically updates the Collection's total size.
 */
export async function removeItemFromCollection(
  collectionId: string,
  itemId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch the item to get its size (needed for decrement)
    const itemToRemove = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { size: true },
    })

    // 2. Delete the association
    // Using the composite unique key [collectionId, itemId]
    const deletedAssociation = await tx.collectionItem.delete({
      where: {
        collectionId_itemId: {
          collectionId,
          itemId,
        },
      },
    })

    // 3. Decrement the collection's total size
    await tx.collection.update({
      where: { id: collectionId },
      data: {
        size: { decrement: itemToRemove.size },
      },
    })

    return deletedAssociation
  })
}

// --- 5. GET COLLECTION CONTENT ---

/**
 * Retrieves items inside a collection using cursor-based pagination.
 * Queries the `CollectionItem` junction table and includes the related `Item` data.
 * * @param collectionId The ID of the collection
 * @param limit Pagination limit (default 50)
 * @param cursor The ID of the *CollectionItem* (link) to start after
 */
export async function getCollectionItems(
  collectionId: string,
  limit: number = 50,
  cursor?: string
) {
  const links = await prisma.collectionItem.findMany({
    where: { collectionId },
    take: limit + 1, // Fetch one extra to detect if there's a next page
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }, // Most recently added items first
    include: {
      item: true, // Fetch the actual Item details
    },
  })

  // If we got more items than the limit, we have a next page
  let items: (typeof links)[number]['item'][] = []
  let data = links.slice(0, limit)
  let nextCursor: string | undefined = undefined

  if (links.length > limit) {
    const nextLink = links.pop() // Remove the extra item
    nextCursor = nextLink?.id || undefined
  }

  // Flatten the result to return an array of Items, not CollectionItems
  items = data.map((link) => link.item)

  return {
    items,
    nextCursor,
  }
}
