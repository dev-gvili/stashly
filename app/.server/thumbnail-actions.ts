import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export async function createThumbnail(itemId: string, hexColor: string) {
  return prisma.thumbnail.upsert({
    where: { itemId_view_size: { itemId, view: 'grid', size: 'medium' } },
    create: {
      id: toObjectId(getPrefixForModel('Thumbnail')),
      itemId,
      view: 'grid',
      size: 'medium',
      stage: 0,
      url: hexColor,
    },
    update: {},
  })
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
