import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export async function createThumbnail(
  itemId: string,
  hexColor: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  // First, validate that the item exists
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true }
  })
  if (!item) {
    throw new Error(`Item with id ${itemId} not found`)
  }

  const existing = await prisma.thumbnail.findFirst({
    where: { itemId, view: view as any, size: size as any },
  })
  if (existing) return existing

  try {
    return await prisma.thumbnail.create({
      data: {
        id: toObjectId(getPrefixForModel('Thumbnail')),
        itemId,
        view: view as any,
        size: size as any,
        stage: 0,
        url: hexColor,
      },
    })
  } catch (e: unknown) {
    // P2002 = unique constraint violation (lost race) — return the winner's record
    if ((e as { code?: string })?.code === 'P2002') {
      return prisma.thumbnail.findFirstOrThrow({
        where: { itemId, view: view as any, size: size as any },
      })
    }
    throw e
  }
}

export async function updateThumbnail(
  itemId: string,
  stage: number,
  url: string,
  width?: number,
  height?: number,
  view: string = 'grid',
  size: string = 'medium'
) {
  return prisma.thumbnail.updateMany({
    where: { itemId, view: view as any, size: size as any },
    data: { stage, url, width, height },
  })
}

export async function getThumbnailByItemId(
  itemId: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  return prisma.thumbnail.findFirst({
    where: { itemId, view: view as any, size: size as any },
    select: { stage: true, content: true, url: true },
  })
}
