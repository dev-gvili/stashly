import { sessionContext } from '@/.server/middleware/context'
import type { DuplicateGroup } from '@/components/views/duplicates-components'
import { DuplicateTriageView } from '@/components/views/duplicates-components'
import { resolveDuplicatesApiRouteInput } from '@/schemas/api.schemas'
import { trashItems } from '@/services/item-actions'
import { getDuplicateGroups } from '@/services/storage-actions'
import { parseFormData } from '@/utils/parsers'
import { useCallback } from 'react'
import {
  href,
  Link,
  redirect,
  useFetcher,
  useNavigate,
  type ShouldRevalidateFunction,
} from 'react-router'
import type { Route } from './+types/duplicates'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const groups = await getDuplicateGroups(session.user.id)

  // `Item.size` and `reclaimableBytes` are bigints on the server model; the
  // view formats numbers, so the conversion happens once, here.
  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      risk: group.risk,
      reclaimableBytes: Number(group.reclaimableBytes),
      copies: group.copies.map((copy) => ({
        item: {
          id: copy.id,
          name: copy.name,
          size: Number(copy.size),
          extension: copy.extension,
          thumbnails: copy.thumbnails,
        },
        folderPath: copy.folderPath,
        addedAt: copy.addedAt.toISOString(),
        modifiedAt: copy.modifiedAt.toISOString(),
        checksum: copy.hash,
      })),
    })) satisfies DuplicateGroup[],
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  const input = await parseFormData({
    request,
    schema: resolveDuplicatesApiRouteInput,
  })

  // Soft delete only — `trashItems` flips status and adjusts quota, so every
  // copy stays restorable from Trash. Never `deleteItems` here.
  await trashItems(input.itemIds, session.user.id)
  return { ok: true, trashed: input.itemIds.length }
}

/**
 * The triage list is a snapshot the user works through.
 *
 * React Router revalidates every active loader after a fetcher submission, so
 * without this each committed group would re-run the grouping query, drop the
 * group just resolved, and shift every index beneath the cursor the view holds
 * internally — the screen would skip a group on every keep. The list refreshes
 * on the next navigation instead.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  defaultShouldRevalidate,
}) => (formMethod === 'POST' ? false : defaultShouldRevalidate)

export default function DuplicatesPage({
  loaderData,
  params,
}: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>()
  const navigate = useNavigate()
  const storageTo = href('/:me/stash/storage', { me: params.me })

  const handleResolveGroup = useCallback(
    ({ deletedItemIds }: { deletedItemIds: string[] }) => {
      if (deletedItemIds.length === 0) return
      // Indexed keys so `parseFormData`'s qs pass rebuilds a real array; a
      // repeated flat key would collapse to the last value.
      const payload: Record<string, string> = { intent: 'resolve_group' }
      deletedItemIds.forEach((id, i) => {
        payload[`itemIds[${i}]`] = id
      })
      fetcher.submit(payload, { method: 'POST' })
    },
    [fetcher]
  )

  const handleFinish = useCallback(() => {
    navigate(storageTo)
  }, [navigate, storageTo])

  return (
    <div className="mx-auto flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-input pb-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="font-stashly truncate text-xl font-semibold">
            Resolve duplicates
          </h1>
          <span className="font-stashly hidden text-sm text-muted-foreground md:inline">
            / {loaderData.groups.length} groups
          </span>
        </div>
        <Link
          to={storageTo}
          className="font-stashly shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          Back to storage
        </Link>
      </header>

      <DuplicateTriageView
        groups={loaderData.groups}
        onResolveGroup={handleResolveGroup}
        onFinish={handleFinish}
        className="flex-1"
      />
    </div>
  )
}
