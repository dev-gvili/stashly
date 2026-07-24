import { auth } from '@/.server/auth'
import { GridLayout } from '@/components/views/grid-view'
import { FileCard } from '@/components/core-components/file-card'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { prisma } from '@/services/db'
import type { Route } from './+types/shares'
import { redirect } from 'react-router'
import { usePagination } from '@/hooks/usePagination'
import { itemVariants } from '@/components/views/variants'
import { motion } from 'framer-motion'
import { Fragment } from 'react/jsx-runtime'
import { SelectionProvider } from '../../components/stash/selection'
import { LoadMoreItems } from '../../components/core-components/buttons'
import { useId } from 'react'
import { ShareIcon } from '@/components/icons'
import { GenericEmptyState } from '@/components/states/generic-empty-state'

// ---------------------------------------------------------------------------
// Loader — fetch items accessible to the current user via share permissions
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/signin')

  const userId = session.user.id
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limit = 50

  // Find all items the user has permission to access (excluding items they own)
  const permissions = await prisma.permission.findMany({
    where: {
      users: { some: { id: userId } },
      // Filter to permissions linked to items the user doesn't own and are active
      item: {
        is: {
          ownerId: { not: userId },
          status: 'normal',
        },
      },
      // Only non-expired permissions
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      // Exclude soft-deleted permissions
      deletedAt: null,
    },
    select: { itemId: true },
    distinct: ['itemId'],
  })

  const sharedItemIds = permissions
    ?.map((p) => p.itemId)
    .filter((id): id is string => id !== null)

  if (sharedItemIds.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    }
  }

  // Paginate shared items
  const take = limit + 1
  const items = await prisma.item.findMany({
    where: {
      id: { in: sharedItemIds },
      status: 'normal',
    },
    include: {
      file: true,
      folder: true,
      thumbnails: true,
      locked: true,
      favorites: {
        select: {
          id: true,
          favoritedBy: {
            select: {
              name: true,
              displayName: true,
              image: true,
              id: true,
            },
          },
        },
      },
      parent: {
        include: {
          file: true,
          folder: true,
          favorites: {
            select: {
              id: true,
              favoritedBy: {
                select: {
                  displayName: true,
                  image: true,
                  name: true,
                  id: true,
                },
              },
            },
          },
          locked: true,
          thumbnails: {
            where: {
              size: {
                equals: 'large',
              },
            },
            select: {
              url: true,
              width: true,
              height: true,
              size: true,
              view: true,
              id: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = items.length === take
  const page = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return { items: page, nextCursor, hasMore }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default ({ loaderData }: Route.ComponentProps) => {
  const id = useId()
  const { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50, '')

  if (items.length === 0 && !isLoading) {
    return (
      <GenericEmptyState
        icon={<ShareIcon className="size-20" />}
        title="Nothing shared with you yet"
        description="Items shared with you via links or direct invitations will appear here."
      />
    )
  }

  return (
    <Fragment key={id}>
      <SelectionProvider items={items?.map((i) => i.id)}>
        <GridLayout>
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              transition={{ duration: 0.2 }}
            >
              {item.type === 'folder' ? (
                <FolderCardTab {...item} />
              ) : (
                <FileCard item={item} showActions={false} />
              )}
            </motion.div>
          ))}
        </GridLayout>
      </SelectionProvider>
      <div className="col-span-full flex justify-center items-center h-full py-4">
        <LoadMoreItems
          loadMore={loadMore}
          isLoading={isLoading}
          hasMore={hasMore}
        />
      </div>
    </Fragment>
  )
}
