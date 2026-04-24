import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export async function createThumbnail(itemId: string, hexColor: string) {
  const existing = await prisma.thumbnail.findFirst({
    where: { itemId, view: 'grid', size: 'medium' },
  })
  if (existing) return existing

  try {
    return await prisma.thumbnail.create({
      data: {
        id: toObjectId(getPrefixForModel('Thumbnail')),
        itemId,
        view: 'grid',
        size: 'medium',
        stage: 0,
        url: hexColor,
      },
    })
  } catch (e: unknown) {
    // P2002 = unique constraint violation (lost race) — return the winner's record
    if ((e as { code?: string })?.code === 'P2002') {
      return prisma.thumbnail.findFirstOrThrow({
        where: { itemId, view: 'grid', size: 'medium' },
      })
    }
    throw e
  }
}

export async function updateThumbnail(
  itemId: string,
  stage: number,
  content: Buffer,
  width?: number,
  height?: number,
) {
  return prisma.thumbnail.updateMany({
    where: { itemId, view: 'grid', size: 'medium' },
    data: { stage, content: new Uint8Array(content), width, height },
  })
}

export async function getThumbnailByItemId(itemId: string) {
  return prisma.thumbnail.findFirst({
    where: { itemId, view: 'grid', size: 'medium' },
    select: { stage: true, content: true, url: true },
  })
}
