import type { Route } from './+types/home'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { useId } from 'react'
import type { ShouldRevalidateFunction } from 'react-router'
import { getQueryParamArray } from '@/utils/query-params'
import { FilesEmptyState } from '@/components/states/files-empty-state'
import { SuggestionsView } from '@/components/views/suggestions-view'
import { getSuggestedItems } from '@/utils/item-actions.server'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ matches }: Route.MetaArgs) {
  let userName = matches[1].loaderData?.user.name
  return [
    { title: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}` },
    { description: 'Stash' },
    {
      name: 'og:title',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
    {
      name: 'og:description',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
  ]
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  formAction,
  defaultShouldRevalidate,
}) => {
  let current = currentUrl.searchParams
  let next = nextUrl.searchParams

  console.log({ nextUrl })
  console.log({ currentUrl })
  ;['sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })
  let currentSelectedItems = getQueryParamArray(current, 'selectedItems')
  let nextSelectedItems = getQueryParamArray(next, 'selectedItems')
  if (currentSelectedItems.length !== nextSelectedItems.length) {
    return false
  }
  return defaultShouldRevalidate
}

export async function loader({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) {
    throw redirect('/auth/signin')
  }

  // let searchParams = new URL(request.url).searchParams
  // searchParams.set('currentUserId', session.user.id)
  // searchParams.set('parentId', session.user.rootId)

  // let parsedParams = parseSearchParams({
  //   schema: itemFilterSchema,
  //   searchParams,
  // })

  // let filters = buildItemFilters(parsedParams)
  const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
    userId: session.user.id,
    driveId: session.user.driveId,
    rootId: session.user.rootId,
    maxFolders: 6,
    maxFiles: 50,
  })

  return {
    suggestedFolders,
    suggestedFiles,
    user: session.user,
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  let id = useId()
  const { suggestedFolders, suggestedFiles } = loaderData
  if (!suggestedFolders && !suggestedFiles) {
    return <FilesEmptyState />
  }
  return (
    <SuggestionsView
      key={id}
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
    />
  )
}
