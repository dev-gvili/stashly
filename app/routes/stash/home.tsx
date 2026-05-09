import type { Route } from './+types/home'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { useId } from 'react'
import type { ShouldRevalidateFunction } from 'react-router'
import { getQueryParam, getQueryParamArray } from '@/utils/query-params'
import { FilesEmptyState } from '@/components/states/files-empty-state'
import { SuggestionsView } from '@/components/views/suggestions-view'
import { getSuggestedItems } from '@/services/item-actions'

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
  formData,
  defaultShouldRevalidate,
}) => {
  let currentSelectedItems = getQueryParamArray(
    currentUrl.searchParams,
    'selectedItems'
  )
  let nextSelectedItems = getQueryParamArray(
    nextUrl.searchParams,
    'selectedItems'
  )

  ;['favorites', 'sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })

  if (
    formData?.get('intent') === 'move_items' ||
    formData?.get('intent') === 'trash_items'
  ) {
    return true
  }

  if (
    currentSelectedItems.some((item) => !nextSelectedItems.includes(item)) &&
    currentUrl.pathname === nextUrl.pathname
  ) {
    return false
  }

  return defaultShouldRevalidate
}

export async function loader({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) {
    throw redirect('/auth/signin')
  }

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
